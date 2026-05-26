import Joi from 'joi';

export const bookingWebhookDataSchema = Joi.object({
  booking_id: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
  client_id: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
  staff_id: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
  service_id: Joi.alternatives().try(Joi.string(), Joi.number()).optional(),
  service_name: Joi.string().optional(),
  start_datetime: Joi.string().isoDate().optional(),
  finish_datetime: Joi.string().isoDate().optional(),
  old_start_datetime: Joi.string().isoDate().optional(),
  old_finish_datetime: Joi.string().isoDate().optional(),
}).unknown(true);

export const webhookPayloadSchema = Joi.object({
  event: Joi.string()
    .valid('booking_created', 'booking_updated', 'booking_cancelled')
    .optional(),
  entity: Joi.string().optional(),
  resource: Joi.string().optional(),
  object: Joi.string().optional(),
  action: Joi.string().optional(),
  operation: Joi.string().optional(),
  type: Joi.string().optional(),
  created_at: Joi.string().isoDate().optional(),
  timestamp: Joi.string().isoDate().optional(),
  data: bookingWebhookDataSchema.optional(),
}).or('event', 'action', 'operation', 'type').unknown(true);

export const notificationJobSchema = Joi.object({
  telegramUserId: Joi.string().required(),
  type: Joi.string()
    .valid(
      'confirmation',
      'reminder_24h',
      'reminder_2h',
      'client_update',
      'client_cancel',
      'admin_new',
      'admin_update',
      'admin_cancel',
      'marketing'
    )
    .required(),
  appointmentId: Joi.string().optional(),
  content: Joi.string().required().max(4096),
  locale: Joi.string().valid('ru', 'ua', 'en').default('ru'),
  metadata: Joi.object().optional(),
});

export function validateWebhookPayload(payload: unknown) {
  const { error, value } = webhookPayloadSchema.validate(payload, {
    abortEarly: false,
    stripUnknown: false,
  });

  if (error) {
    const details = error.details.map((d) => `${d.path.join('.')}: ${d.message}`);
    throw new ValidationError(`Webhook validation failed: ${details.join(', ')}`);
  }

  return value;
}

export function validateNotificationJob(data: unknown) {
  const { error, value } = notificationJobSchema.validate(data, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const details = error.details.map((d) => `${d.path.join('.')}: ${d.message}`);
    throw new ValidationError(`Notification validation failed: ${details.join(', ')}`);
  }

  return value;
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
