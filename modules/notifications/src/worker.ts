import { Worker, Job } from 'bullmq';
import { Telegraf } from 'telegraf';
import prisma from '@bot/database';
import logger from '@bot/logger';
import { enqueueNotification, NotificationJobData, ReminderJobData } from './queue';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN || '');
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

// Notification messages by type
const getNotificationMessage = (
  type: NotificationJobData['type'],
  content: string,
  locale: string = 'ru'
): string => {
  const messages: Record<string, Record<string, string>> = {
    ru: {
      confirmation: '✅ Запись подтверждена!\n\n{content}',
      reminder_24h: '⏰ Напоминание: ваша запись через 24 часа\n\n{content}',
      reminder_2h: '⏰ Напоминание: ваша запись через 2 часа!\n\n{content}',
      admin_new: '🆕 Новая запись:\n\n{content}',
      admin_update: '🔄 Изменение записи:\n\n{content}',
      admin_cancel: '❌ Отмена записи:\n\n{content}',
      client_update: '🔄 Время записи изменено\n\n{content}',
      client_cancel: '❌ Ваша запись отменена\n\n{content}',
    },
    ua: {
      confirmation: '✅ Запис підтверджена!\n\n{content}',
      reminder_24h: '⏰ Нагадування: ваша запис через 24 години\n\n{content}',
      reminder_2h: '⏰ Нагадування: ваша запис через 2 години!\n\n{content}',
      admin_new: '🆕 Нова запис:\n\n{content}',
      admin_update: '🔄 Зміна запису:\n\n{content}',
      admin_cancel: '❌ Скасування запису:\n\n{content}',
      client_update: '🔄 Час запису змінено\n\n{content}',
      client_cancel: '❌ Ваш запис скасовано\n\n{content}',
    },
    en: {
      confirmation: '✅ Appointment confirmed!\n\n{content}',
      reminder_24h: '⏰ Reminder: your appointment in 24 hours\n\n{content}',
      reminder_2h: '⏰ Reminder: your appointment in 2 hours!\n\n{content}',
      admin_new: '🆕 New appointment:\n\n{content}',
      admin_update: '🔄 Appointment changed:\n\n{content}',
      admin_cancel: '❌ Appointment cancelled:\n\n{content}',
      client_update: '🔄 Appointment time changed\n\n{content}',
      client_cancel: '❌ Your appointment was cancelled\n\n{content}',
    },
  };

  const template = messages[locale]?.[type] || messages.ru[type];
  return template.replace('{content}', content);
};

// Notification worker
export const notificationWorker = new Worker(
  'notifications',
  async (job: Job<NotificationJobData>) => {
    try {
      const { telegramUserId, type, content, locale = 'ru', appointmentId } = job.data;

      logger.info(`Processing notification job: ${job.id}`, {
        userId: telegramUserId,
        type,
      });

      // Build message
      const message = getNotificationMessage(type, content, locale);

      // Send via Telegram
      const result = await bot.telegram.sendMessage(telegramUserId, message, {
        parse_mode: 'HTML',
      });

      // Log in database
      if (appointmentId) {
        await prisma.notification.create({
          data: {
            telegramUserId,
            appointmentId,
            type,
            content,
            locale,
            sentAt: new Date(),
            deliveredAt: result?.message_id ? new Date() : null,
          },
        });

        // Update appointment reminder status
        if (type === 'reminder_24h') {
          await prisma.appointment.update({
            where: { id: appointmentId },
            data: { reminder24Sent: true },
          });
        } else if (type === 'reminder_2h') {
          await prisma.appointment.update({
            where: { id: appointmentId },
            data: { reminder2Sent: true },
          });
        }
      } else {
        await prisma.notification.create({
          data: {
            telegramUserId,
            type,
            content,
            locale,
            sentAt: new Date(),
            deliveredAt: result?.message_id ? new Date() : null,
          },
        });
      }

      logger.info(`Notification sent: ${job.id}`, {
        userId: telegramUserId,
        messageId: result?.message_id,
      });

      return { success: true, messageId: result?.message_id };
    } catch (error) {
      logger.error(`Notification job failed: ${job.id}`, error);

      // Log failure
      if (job.data.appointmentId) {
        await prisma.notification.create({
          data: {
            telegramUserId: job.data.telegramUserId,
            appointmentId: job.data.appointmentId,
            type: job.data.type,
            content: job.data.content,
            locale: job.data.locale || 'ru',
            failureReason: error instanceof Error ? error.message : 'Unknown error',
            retryCount: job.attemptsMade,
          },
        });
      }

      throw error;
    }
  },
  { connection: redisConnection, concurrency: 5 }
);

export const reminderWorker = new Worker(
  'reminders',
  async (job: Job<ReminderJobData>) => {
    const { telegramUserId, appointmentId, reminderType } = job.data;

    logger.info(`Processing reminder job: ${job.id}`, {
      userId: telegramUserId,
      appointmentId,
      reminderType,
    });

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { user: true },
    });

    if (!appointment) {
      logger.warn(`Reminder skipped; appointment not found: ${appointmentId}`);
      return { skipped: true, reason: 'appointment_not_found' };
    }

    if (appointment.status === 'cancelled') {
      logger.info(`Reminder skipped for cancelled appointment: ${appointmentId}`);
      return { skipped: true, reason: 'appointment_cancelled' };
    }

    const content = [
      `Сервис: ${appointment.serviceName}`,
      appointment.specialist ? `Специалист: ${appointment.specialist}` : null,
      `Дата/Время: ${appointment.startTime.toLocaleString('ru-RU')}`,
    ].filter(Boolean).join('\n');

    await enqueueNotification({
      telegramUserId,
      type: reminderType === '24h' ? 'reminder_24h' : 'reminder_2h',
      appointmentId,
      content,
      locale: appointment.user.locale,
    });

    return { success: true };
  },
  { connection: redisConnection, concurrency: 5 }
);

// Worker event handlers
notificationWorker.on('completed', (job) => {
  logger.debug(`Notification job completed: ${job.id}`);
});

notificationWorker.on('failed', (job, error) => {
  logger.error(`Notification job failed after retries: ${job?.id}`, error);
});

notificationWorker.on('error', (error) => {
  logger.error('Notification worker error:', error);
});

reminderWorker.on('completed', (job) => {
  logger.debug(`Reminder job completed: ${job.id}`);
});

reminderWorker.on('failed', (job, error) => {
  logger.error(`Reminder job failed after retries: ${job?.id}`, error);
});

reminderWorker.on('error', (error) => {
  logger.error('Reminder worker error:', error);
});

export async function startNotificationWorker() {
  logger.info('Starting notification and reminder workers...');
  // Worker is already running once instantiated
  logger.info('Notification and reminder workers started');
}

export async function closeNotificationWorker() {
  await notificationWorker.close();
  await reminderWorker.close();
  logger.info('Notification and reminder workers closed');
}
