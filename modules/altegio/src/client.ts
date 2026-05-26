import axios, { AxiosInstance } from 'axios';
import logger from '@bot/logger';

export interface AltegioUser {
  id: string | number;
  first_name?: string;
  last_name?: string;
  name?: string;
  surname?: string;
  display_name?: string;
  phone: string;
  email?: string;
}

export interface AltegioService {
  id: string | number;
  name?: string;
  title?: string;
  duration: number; // minutes
}

export interface AltegioBooking {
  id: string | number;
  created_at: string;
  start_datetime: string;
  finish_datetime: string;
  status: string;
  client_id: string | number;
  staff_id: string | number;
  service: AltegioService;
  raw?: Record<string, any>;
}

export interface AltegioClientConfig {
  partnerToken: string;
  userToken: string;
  locationId: string | number;
}

export class AltegioClient {
  private client: AxiosInstance;
  private locationId: string | number;
  private baseUrl = 'https://api.alteg.io/api/v1';
  private failureCount = 0;
  private circuitOpenedUntil = 0;
  private readonly failureThreshold = 5;
  private readonly circuitOpenMs = 60_000;

  constructor(config: AltegioClientConfig) {
    this.locationId = config.locationId;
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Accept: 'application/vnd.api.v2+json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.partnerToken}, User ${config.userToken}`,
      },
    });
  }

  async getClient(clientId: string | number): Promise<AltegioUser> {
    try {
      this.assertCircuitClosed();
      const response = await this.client.get(`/client/${this.locationId}/${clientId}`);
      this.recordSuccess();
      return response.data.data;
    } catch (error) {
      this.recordFailure();
      logger.error('Failed to get Altegio client:', error);
      throw error;
    }
  }

  async getBooking(bookingId: string | number): Promise<AltegioBooking> {
    try {
      this.assertCircuitClosed();
      const response = await this.client.get(`/record/${this.locationId}/${bookingId}`);
      this.recordSuccess();
      return this.normalizeBooking(response.data.data);
    } catch (error) {
      this.recordFailure();
      logger.error('Failed to get Altegio booking:', error);
      throw error;
    }
  }

  async getStaff(staffId: string | number) {
    try {
      this.assertCircuitClosed();
      const response = await this.client.get(`/staff/${this.locationId}/${staffId}`);
      this.recordSuccess();
      return response.data.data;
    } catch (error) {
      this.recordFailure();
      logger.error('Failed to get Altegio staff:', error);
      throw error;
    }
  }

  private assertCircuitClosed() {
    if (Date.now() < this.circuitOpenedUntil) {
      throw new Error('Altegio circuit breaker is open');
    }
  }

  private recordSuccess() {
    this.failureCount = 0;
    this.circuitOpenedUntil = 0;
  }

  private recordFailure() {
    this.failureCount += 1;
    if (this.failureCount >= this.failureThreshold) {
      this.circuitOpenedUntil = Date.now() + this.circuitOpenMs;
      logger.error('Altegio circuit breaker opened', {
        failureCount: this.failureCount,
        circuitOpenMs: this.circuitOpenMs,
      });
    }
  }

  private normalizeBooking(record: Record<string, any>): AltegioBooking {
    const start = record.datetime || record.date;
    const lengthSeconds = Number(record.length || record.seance_length || 0);
    const finish = start
      ? new Date(new Date(start).getTime() + lengthSeconds * 1000).toISOString()
      : '';
    const service = record.services?.[0] || {};

    return {
      id: record.id,
      created_at: record.create_date || record.created_at || new Date().toISOString(),
      start_datetime: start,
      finish_datetime: record.finish_datetime || finish,
      status: record.deleted ? 'cancelled' : 'confirmed',
      client_id: record.client?.id || record.client_id,
      staff_id: record.staff_id || record.staff?.id,
      service: {
        id: service.id,
        name: service.title || service.name,
        title: service.title,
        duration: Math.round(lengthSeconds / 60),
      },
      raw: record,
    };
  }
}
