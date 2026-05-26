import logger from '@bot/logger';
import prisma from '@bot/database';
import { WebhookVerifier, WebhookParser, AltegioClient, BookingWebhookData } from '@bot/altegio';
import { enqueueNotification, enqueueReminder } from '@bot/notifications';
import { validateWebhookPayload, ValidationError } from '@bot/validation';
import { Request, Response } from 'express';
import { config } from '../config';

const altegioClient = new AltegioClient(config.altegio.apiKey);
const webhookVerifier = new WebhookVerifier(config.altegio.webhookSecret);

/**
 * Handle Altegio webhook requests
 */
export async function handleAltegioWebhook(req: Request, res: Response) {
  try {
    // Verify webhook signature
    const signature = req.headers['x-signature'] as string;
    if (!signature) {
      logger.warn('Missing X-Signature header');
      return res.status(401).json({ ok: false, error: 'Missing signature' });
    }

    const payload = JSON.stringify(req.body);

    if (!webhookVerifier.verifySignature(payload, signature)) {
      logger.warn('Invalid webhook signature');
      return res.status(401).json({ ok: false, error: 'Invalid signature' });
    }

    // Validate webhook payload structure
    let validatedPayload;
    try {
      validatedPayload = validateWebhookPayload(req.body);
    } catch (validationError) {
      logger.warn(`Webhook validation failed: ${validationError}`);
      return res.status(400).json({ ok: false, error: 'Invalid payload' });
    }

    // Parse event
    const event = WebhookParser.parseBookingEvent(validatedPayload);
    if (!event) {
      return res.status(400).json({ ok: false, error: 'Invalid event' });
    }

    logger.info(`Processing Altegio webhook: ${event.type}`, {
      bookingId: event.data.booking_id,
    });

    // Handle event
    switch (event.type) {
      case 'booking_created':
        await handleBookingCreated(event.data);
        break;
      case 'booking_updated':
        await handleBookingUpdated(event.data);
        break;
      case 'booking_cancelled':
        await handleBookingCancelled(event.data);
        break;
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    logger.error('Webhook processing error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}

/**
 * Handle new booking created
 */
async function handleBookingCreated(data: BookingWebhookData) {
  try {
    // Get client info from Altegio
    const altegioClient_data = await altegioClient.getClient(data.client_id);

    // Find or create user in DB
    let user = await prisma.user.findUnique({
      where: { altegioUserId: data.client_id },
    });

    if (!user) {
      logger.error(
        `User not found for Altegio client ${data.client_id} - skipping webhook processing. ` +
          `User must add bot in Telegram first.`
      );
      // Return 200 to acknowledge webhook, but skip processing
      // TODO: Implement link Telegram<->Altegio flow or call verification
      return;
    }

    // Create appointment record
    const appointment = await prisma.appointment.create({
      data: {
        telegramUserId: user.telegramId,
        altegioBookingId: data.booking_id,
        serviceName: data.service_name,
        specialist: data.staff_id,
        startTime: new Date(data.start_datetime),
        endTime: new Date(data.finish_datetime),
        status: 'confirmed',
      },
    });

    logger.info(`Appointment created: ${appointment.id}`, {
      userId: user.id,
      bookingId: data.booking_id,
    });

    // Queue notifications
    const locale = user.locale || 'ru';

    // Immediate confirmation
    await enqueueNotification({
      telegramUserId: user.telegramId,
      type: 'confirmation',
      appointmentId: appointment.id,
      content: `
Сервис: ${data.service_name}
Дата/Время: ${new Date(data.start_datetime).toLocaleString('ru-RU')}
      `,
      locale,
    });

    // 24-hour reminder (86400000 ms)
    await enqueueReminder({
      telegramUserId: user.telegramId,
      appointmentId: appointment.id,
      reminderType: '24h',
      scheduledFor: new Date(new Date(data.start_datetime).getTime() - 24 * 60 * 60 * 1000),
    });

    // 2-hour reminder (7200000 ms)
    await enqueueReminder({
      telegramUserId: user.telegramId,
      appointmentId: appointment.id,
      reminderType: '2h',
      scheduledFor: new Date(new Date(data.start_datetime).getTime() - 2 * 60 * 60 * 1000),
    });

    // Admin notification
    if (config.telegram.adminChatId) {
      await enqueueNotification({
        telegramUserId: config.telegram.adminChatId,
        type: 'admin_new',
        appointmentId: appointment.id,
        content: `
Клиент: ${user.firstName} ${user.lastName}
Сервис: ${data.service_name}
Дата/Время: ${new Date(data.start_datetime).toLocaleString('ru-RU')}
        `,
        locale: 'ru',
      });
    }
  } catch (error) {
    logger.error('Failed to handle booking_created:', error);
    throw error;
  }
}

/**
 * Handle booking update (time change)
 */
async function handleBookingUpdated(data: BookingWebhookData) {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { altegioBookingId: data.booking_id },
      include: { user: true },
    });

    if (!appointment) {
      logger.warn(`Appointment not found for booking ${data.booking_id}`);
      return;
    }

    // Update appointment
    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        startTime: new Date(data.start_datetime),
        endTime: new Date(data.finish_datetime),
        reminder24Sent: false, // Reset reminder flags
        reminder2Sent: false,
      },
    });

    logger.info(`Appointment updated: ${appointment.id}`, {
      oldTime: appointment.startTime,
      newTime: updated.startTime,
    });

    // Notify user about time change
    if (appointment.user.telegramId) {
      await enqueueNotification({
        telegramUserId: appointment.user.telegramId,
        type: 'reminder_24h', // Use as update notification
        appointmentId: appointment.id,
        content: `
Время записи изменено!
Новое время: ${new Date(data.start_datetime).toLocaleString('ru-RU')}
        `,
        locale: appointment.user.locale,
      });
    }

    // Notify admin
    if (config.telegram.adminChatId) {
      await enqueueNotification({
        telegramUserId: config.telegram.adminChatId,
        type: 'admin_new',
        appointmentId: appointment.id,
        content: `
Изменение времени записи
Клиент: ${appointment.user.firstName} ${appointment.user.lastName}
Старое время: ${appointment.startTime.toLocaleString('ru-RU')}
Новое время: ${new Date(data.start_datetime).toLocaleString('ru-RU')}
        `,
        locale: 'ru',
      });
    }
  } catch (error) {
    logger.error('Failed to handle booking_updated:', error);
    throw error;
  }
}

/**
 * Handle booking cancellation
 */
async function handleBookingCancelled(data: BookingWebhookData) {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { altegioBookingId: data.booking_id },
      include: { user: true },
    });

    if (!appointment) {
      logger.warn(`Appointment not found for booking ${data.booking_id}`);
      return;
    }

    // Update status
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: 'cancelled' },
    });

    logger.info(`Appointment cancelled: ${appointment.id}`);

    // Notify user
    if (appointment.user.telegramId) {
      await enqueueNotification({
        telegramUserId: appointment.user.telegramId,
        type: 'reminder_24h', // Use as cancellation notification
        appointmentId: appointment.id,
        content: `
Ваша запись отменена:
${appointment.serviceName}
${appointment.startTime.toLocaleString('ru-RU')}
        `,
        locale: appointment.user.locale,
      });
    }

    // Notify admin
    if (config.telegram.adminChatId) {
      await enqueueNotification({
        telegramUserId: config.telegram.adminChatId,
        type: 'admin_cancel',
        appointmentId: appointment.id,
        content: `
Отмена записи
Клиент: ${appointment.user.firstName} ${appointment.user.lastName}
Сервис: ${appointment.serviceName}
        `,
        locale: 'ru',
      });
    }
  } catch (error) {
    logger.error('Failed to handle booking_cancelled:', error);
    throw error;
  }
}
