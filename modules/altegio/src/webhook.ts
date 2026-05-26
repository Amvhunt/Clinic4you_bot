import crypto from 'crypto';
import logger from '@bot/logger';

export interface WebhookPayload {
  event?: string;
  entity?: string;
  action?: string;
  resource?: string;
  data?: Record<string, any>;
  created_at?: string;
  timestamp?: string;
  [key: string]: any;
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
  location_id?: string;
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
    if (!this.secret) {
      logger.warn('ALTEGIO_WEBHOOK_SECRET is empty; webhook signature verification is disabled');
      return true;
    }

    try {
      const computed = crypto
        .createHmac('sha256', this.secret)
        .update(payload)
        .digest('hex');
      const normalizedSignature = signature.replace(/^sha256=/, '');

      if (computed.length !== normalizedSignature.length) {
        return false;
      }

      const isValid = crypto.timingSafeEqual(
        Buffer.from(computed),
        Buffer.from(normalizedSignature)
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
      const type = this.resolveEventType(payload);
      if (!type) {
        logger.warn(`Unknown webhook event: ${payload?.event || payload?.action || 'unknown'}`);
        return null;
      }

      const data = this.normalizeBookingData(payload);
      if (!data) {
        logger.warn('Webhook payload does not contain booking data');
        return null;
      }

      return {
        type,
        data,
        timestamp: new Date(payload.created_at || payload.timestamp || Date.now()),
      };
    } catch (error) {
      logger.error('Failed to parse webhook payload:', error);
      return null;
    }
  }

  private static resolveEventType(payload: WebhookPayload): BookingEvent['type'] | null {
    const event = payload?.event || payload?.type;
    if (event === 'booking_created' || event === 'booking_updated' || event === 'booking_cancelled') {
      return event;
    }

    const entity = payload?.entity || payload?.resource || payload?.object;
    if (entity && entity !== 'record' && entity !== 'booking' && entity !== 'appointment') {
      return null;
    }

    const action = String(payload?.action || payload?.operation || '').toLowerCase();
    if (['create', 'created', 'add', 'added'].includes(action)) return 'booking_created';
    if (['update', 'updated', 'edit', 'edited'].includes(action)) return 'booking_updated';
    if (['delete', 'deleted', 'cancel', 'cancelled', 'canceled'].includes(action)) {
      return 'booking_cancelled';
    }

    return null;
  }

  private static normalizeBookingData(payload: WebhookPayload): BookingWebhookData | null {
    const data = payload.data || payload.record || payload.booking || payload.appointment || payload;

    if (data.booking_id && data.client_id && data.start_datetime) {
      return {
        booking_id: String(data.booking_id),
        client_id: String(data.client_id),
        staff_id: String(data.staff_id),
        service_id: String(data.service_id),
        service_name: String(data.service_name),
        start_datetime: String(data.start_datetime),
        finish_datetime: String(data.finish_datetime),
        old_start_datetime: data.old_start_datetime,
        old_finish_datetime: data.old_finish_datetime,
        location_id: data.location_id ? String(data.location_id) : undefined,
      };
    }

    const recordId = data.id || payload.record_id || payload.entity_id || payload.object_id;
    const start = data.datetime || data.date || data.start_datetime;
    const lengthSeconds = Number(data.length || data.seance_length || 0);
    const finish = data.finish_datetime || (start
      ? new Date(new Date(start).getTime() + lengthSeconds * 1000).toISOString()
      : undefined);
    const service = data.services?.[0] || data.service || {};
    const client = data.client || {};
    const staff = data.staff || {};

    if (!recordId) return null;

    return {
      booking_id: String(recordId),
      client_id: String(client.id || data.client_id || ''),
      staff_id: String(data.staff_id || staff.id || ''),
      service_id: String(service.id || data.service_id || ''),
      service_name: String(service.title || service.name || data.service_name || 'Услуга'),
      start_datetime: start ? String(start) : '',
      finish_datetime: finish ? String(finish) : '',
      old_start_datetime: data.old_start_datetime,
      old_finish_datetime: data.old_finish_datetime,
      location_id: String(data.company_id || data.location_id || payload.location_id || ''),
    };
  }
}
