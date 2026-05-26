import Joi from 'joi';

// Webhook validation schemas
export const bookingWebhookDataSchema = Joi.object({
  booking_id: Joi.string().required(),
  client_id: Joi.string().required(),
  staff_id: Joi.string().required(),
  service_id: Joi.string().required(),
  service_name: Joi.string().required(),
  start_datetime: Joi.string().isoDate().required(),
  finish_datetime: Joi.string().isoDate().required(),
  old_start_datetime: Joi.string().isoDate().optional(),
  old_finish_datetime: Joi.string().isoDate().optional(),
});

export const webhookPayloadSchema = Joi.object({
  event: Joi.string()
    .valid('booking_created', 'booking_updated', 'booking_cancelled')
    .required(),
  created_at: Joi.string().isoDate().required(),
  data: bookingWebhookDataSchema.required(),
});

// Notification validation schema
export const notificationJobSchema = Joi.object({
  telegramUserId: Joi.string().required(),
  type: Joi.string()
    .valid('confirmation', 'reminder_24h', 'reminder_2h', 'admin_new', 'admin_cancel')
    .required(),
  appointmentId: Joi.string().optional(),
  content: Joi.string().required().max(4096),
  locale: Joi.string().valid('ru', 'ua', 'en').default('ru'),
  metadata: Joi.object().optional(),
});

// Validate webhook payload
export function validateWebhookPayload(payload: unknown) {
  const { error, value } = webhookPayloadSchema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const details = error.details.map((d) => `${d.path.join('.')}: ${d.message}`);
    throw new ValidationError(`Webhook validation failed: ${details.join(', ')}`);
  }

  return value;
}

// Validate notification job
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

// Custom validation error
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
