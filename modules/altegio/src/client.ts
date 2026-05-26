import axios, { AxiosInstance } from 'axios';
import logger from '@bot/logger';

export interface AltegioUser {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
}

export interface AltegioService {
  id: string;
  name: string;
  duration: number; // minutes
}

export interface AltegioBooking {
  id: string;
  created_at: string;
  start_datetime: string;
  finish_datetime: string;
  status: string;
  client_id: string;
  staff_id: string;
  service: AltegioService;
}

export class AltegioClient {
  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl = 'https://api.altegio.com/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async getClient(clientId: string): Promise<AltegioUser> {
    try {
      const response = await this.client.get(`/clients/${clientId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get Altegio client:', error);
      throw error;
    }
  }

  async getBooking(bookingId: string): Promise<AltegioBooking> {
    try {
      const response = await this.client.get(`/bookings/${bookingId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get Altegio booking:', error);
      throw error;
    }
  }

  async getStaff(staffId: string) {
    try {
      const response = await this.client.get(`/staff/${staffId}`);
      return response.data;
    } catch (error) {
      logger.error('Failed to get Altegio staff:', error);
      throw error;
    }
  }
}
