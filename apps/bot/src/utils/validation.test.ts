/**
 * Unit tests for notification validation
 */
import { validateNotificationJob, validateWebhookPayload, ValidationError } from '@bot/validation';

describe('Notification Validation', () => {
  describe('validateNotificationJob', () => {
    const validJob = {
      telegramUserId: '123456789',
      type: 'confirmation' as const,
      appointmentId: 'apt_123',
      content: 'Your appointment is confirmed',
      locale: 'ru',
    };

    it('should validate correct notification job', () => {
      const result = validateNotificationJob(validJob);

      expect(result.telegramUserId).toBe('123456789');
      expect(result.type).toBe('confirmation');
      expect(result.content).toBe('Your appointment is confirmed');
    });

    it('should reject job without telegramUserId', () => {
      const invalid = { ...validJob, telegramUserId: undefined };

      expect(() => validateNotificationJob(invalid)).toThrow(ValidationError);
    });

    it('should reject job with invalid type', () => {
      const invalid = { ...validJob, type: 'invalid_type' };

      expect(() => validateNotificationJob(invalid)).toThrow(ValidationError);
    });

    it('should reject job with oversized content', () => {
      const invalid = { ...validJob, content: 'x'.repeat(5000) };

      expect(() => validateNotificationJob(invalid)).toThrow(ValidationError);
    });

    it('should accept optional appointmentId', () => {
      const job = { ...validJob, appointmentId: undefined };
      const result = validateNotificationJob(job);

      expect(result.appointmentId).toBeUndefined();
    });

    it('should default locale to ru', () => {
      const job = { ...validJob, locale: undefined };
      const result = validateNotificationJob(job);

      expect(result.locale).toBe('ru');
    });
  });

  describe('validateWebhookPayload', () => {
    const validPayload = {
      event: 'booking_created',
      created_at: new Date().toISOString(),
      data: {
        booking_id: 'booking_123',
        client_id: 'client_456',
        staff_id: 'staff_789',
        service_id: 'service_001',
        service_name: 'Consultation',
        start_datetime: new Date().toISOString(),
        finish_datetime: new Date(Date.now() + 3600000).toISOString(),
      },
    };

    it('should validate correct webhook payload', () => {
      const result = validateWebhookPayload(validPayload);

      expect(result.event).toBe('booking_created');
      expect(result.data.booking_id).toBe('booking_123');
    });

    it('should reject invalid event', () => {
      const invalid = { ...validPayload, event: 'unknown_event' };

      expect(() => validateWebhookPayload(invalid)).toThrow(ValidationError);
    });

    it('should allow partial webhook payload for Altegio record hydration', () => {
      const invalid = { ...validPayload, data: { booking_id: 'booking_123' } };
      const result = validateWebhookPayload(invalid);

      expect(result.data.booking_id).toBe('booking_123');
    });

    it('should keep unknown fields for Altegio webhook parser compatibility', () => {
      const withUnknown = { ...validPayload, unknownField: 'value' };
      const result = validateWebhookPayload(withUnknown);

      expect((result as any).unknownField).toBe('value');
    });
  });
});
