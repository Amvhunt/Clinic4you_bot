import { Queue, Worker, QueueScheduler, ConnectionOptions } from 'bullmq';
import redis from 'redis';
import logger from '@bot/logger';

const redisConnection: ConnectionOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

// Queue definitions
export const notificationQueue = new Queue('notifications', { connection: redisConnection });
export const reminderQueue = new Queue('reminders', { connection: redisConnection });
export const emailQueue = new Queue('emails', { connection: redisConnection });

// Schedulers for delayed jobs
export const notificationScheduler = new QueueScheduler('notifications', {
  connection: redisConnection,
});
export const reminderScheduler = new QueueScheduler('reminders', {
  connection: redisConnection,
});

// Queue event handlers
notificationQueue.on('error', (error) => {
  logger.error('Notification queue error:', error);
});

reminderQueue.on('error', (error) => {
  logger.error('Reminder queue error:', error);
});

// Job data interfaces
export interface NotificationJobData {
  telegramUserId: string;
  type: 'confirmation' | 'reminder_24h' | 'reminder_2h' | 'admin_new' | 'admin_cancel';
  appointmentId?: string;
  content: string;
  locale?: string;
  metadata?: Record<string, any>;
}

export interface ReminderJobData {
  telegramUserId: string;
  appointmentId: string;
  reminderType: '24h' | '2h';
  scheduledFor: Date;
}

// Add notification job to queue
export async function enqueueNotification(data: NotificationJobData, delayMs?: number) {
  try {
    const jobOptions: any = {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    };

    if (delayMs) {
      jobOptions.delay = delayMs;
    }

    const job = await notificationQueue.add('send-notification', data, jobOptions);
    logger.info(`Notification job queued: ${job.id}`, { userId: data.telegramUserId });
    return job;
  } catch (error) {
    logger.error('Failed to enqueue notification:', error);
    throw error;
  }
}

// Add reminder job to queue
export async function enqueueReminder(data: ReminderJobData) {
  try {
    const delayMs = new Date(data.scheduledFor).getTime() - Date.now();

    const job = await reminderQueue.add('send-reminder', data, {
      delay: Math.max(0, delayMs),
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: true,
    });

    logger.info(`Reminder job queued: ${job.id}`, {
      userId: data.telegramUserId,
      type: data.reminderType,
    });
    return job;
  } catch (error) {
    logger.error('Failed to enqueue reminder:', error);
    throw error;
  }
}

// Cleanup function
export async function closeQueues() {
  try {
    await notificationQueue.close();
    await reminderQueue.close();
    await emailQueue.close();
    await notificationScheduler.close();
    await reminderScheduler.close();
    logger.info('All queues closed');
  } catch (error) {
    logger.error('Error closing queues:', error);
  }
}
