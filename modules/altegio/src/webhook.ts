import crypto from 'crypto';
import logger from '@bot/logger';

export interface WebhookPayload {
  event: string;
  data: Record<string, any>;
  created_at: string;
}

export interface BookingWebhookData {
  booking_id: string;
  client_id: string;
  staff_id: string;
  service_id: string;
  service_name: string;
  start_datetime: string;
  finish_datetime: string;
  old_start_datetime?: string;
  old_finish_datetime?: string;
}

export interface BookingEvent {
  type: 'booking_created' | 'booking_updated' | 'booking_cancelled';
  data: BookingWebhookData;
  timestamp: Date;
}

export class WebhookVerifier {
  private secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  /**
   * Verify webhook signature from Altegio
   * Altegio sends X-Signature header with HMAC-SHA256 signature
   */
  verifySignature(payload: string, signature: string): boolean {
    try {
      const computed = crypto
        .createHmac('sha256', this.secret)
        .update(payload)
        .digest('hex');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(computed),
        Buffer.from(signature)
      );

      return isValid;
    } catch (error) {
      logger.error('Webhook signature verification failed:', error);
      return false;
    }
  }
}

export class WebhookParser {
  /**
   * Parse Altegio webhook payload and extract booking event
   */
  static parseBookingEvent(payload: WebhookPayload): BookingEvent | null {
    try {
      let type: BookingEvent['type'];
      let data: BookingWebhookData;

      switch (payload.event) {
        case 'booking_created':
          type = 'booking_created';
          data = payload.data as BookingWebhookData;
          break;
        case 'booking_updated':
          type = 'booking_updated';
          data = payload.data as BookingWebhookData;
          break;
        case 'booking_cancelled':
          type = 'booking_cancelled';
          data = payload.data as BookingWebhookData;
          break;
        default:
          logger.warn(`Unknown webhook event: ${payload.event}`);
          return null;
      }

      return {
        type,
        data,
        timestamp: new Date(payload.created_at),
      };
    } catch (error) {
      logger.error('Failed to parse webhook payload:', error);
      return null;
    }
  }
}
