/**
 * Unit tests for webhook verification and parsing
 */
import { WebhookVerifier, WebhookParser, type WebhookPayload } from '@bot/altegio';
import crypto from 'crypto';

describe('Altegio Webhook', () => {
  describe('WebhookVerifier', () => {
    const secret = 'test-secret';
    const verifier = new WebhookVerifier(secret);

    it('should verify valid signature', () => {
      const payload = JSON.stringify({ event: 'booking_created' });
      const signature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      const isValid = verifier.verifySignature(payload, signature);
      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const payload = JSON.stringify({ event: 'booking_created' });
      const invalidSignature = 'invalid-signature';

      const isValid = verifier.verifySignature(payload, invalidSignature);
      expect(isValid).toBe(false);
    });

    it('should be timing-safe against attacks', () => {
      const payload = JSON.stringify({ event: 'booking_created' });
      const sig1 = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      // Alter last character
      const sig2 = sig1.substring(0, sig1.length - 1) + (sig1.at(-1) === '0' ? '1' : '0');

      const isValid1 = verifier.verifySignature(payload, sig1);
      const isValid2 = verifier.verifySignature(payload, sig2);

      expect(isValid1).toBe(true);
      expect(isValid2).toBe(false);
    });
  });

  describe('WebhookParser', () => {
    const validPayload: WebhookPayload = {
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

    it('should parse booking_created event', () => {
      const event = WebhookParser.parseBookingEvent(validPayload);

      expect(event).not.toBeNull();
      expect(event?.type).toBe('booking_created');
      expect(event?.data.booking_id).toBe('booking_123');
    });

    it('should parse booking_updated event', () => {
      const payload = { ...validPayload, event: 'booking_updated' as const };
      const event = WebhookParser.parseBookingEvent(payload);

      expect(event).not.toBeNull();
      expect(event?.type).toBe('booking_updated');
    });

    it('should parse booking_cancelled event', () => {
      const payload = { ...validPayload, event: 'booking_cancelled' as const };
      const event = WebhookParser.parseBookingEvent(payload);

      expect(event).not.toBeNull();
      expect(event?.type).toBe('booking_cancelled');
    });

    it('should return null for unknown event', () => {
      const payload = { ...validPayload, event: 'unknown_event' };
      const event = WebhookParser.parseBookingEvent(payload as any);

      expect(event).toBeNull();
    });

    it('should return null on parse error', () => {
      const event = WebhookParser.parseBookingEvent(null as any);

      expect(event).toBeNull();
    });
  });
});
