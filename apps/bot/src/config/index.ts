import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '..', '..', '.env'),
  path.resolve(__dirname, '..', '..', '..', '..', '.env'),
  path.resolve(__dirname, '..', '..', '..', '.env'),
];

const envPath = envPaths.find((candidate) => fs.existsSync(candidate));
dotenv.config(envPath ? { path: envPath } : undefined);

export const config = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || '',
    adminChatId: process.env.ADMIN_CHAT_ID || '',
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL || '',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/clinic_bot',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  altegio: {
    partnerToken: process.env.ALTEGIO_PARTNER_TOKEN || process.env.ALTEGIO_API_KEY || '',
    userToken: process.env.ALTEGIO_USER_TOKEN || '',
    locationId: process.env.ALTEGIO_LOCATION_ID || '',
    webhookSecret: process.env.ALTEGIO_WEBHOOK_SECRET || '',
  },
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
  },
  ai: {
    enabled: process.env.AI_ENABLED !== 'false',
  },
  i18n: {
    defaultLocale: process.env.DEFAULT_LOCALE || 'ru',
    supportedLocales: (process.env.SUPPORTED_LOCALES || 'ru,ua,en').split(','),
  },
  app: {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000'),
  },
};

if (!config.telegram.token) {
  throw new Error('TELEGRAM_BOT_TOKEN is not set in environment variables');
}

if (
  config.app.env === 'production' &&
  (!config.altegio.partnerToken || !config.altegio.userToken || !config.altegio.locationId)
) {
  throw new Error(
    'ALTEGIO_PARTNER_TOKEN, ALTEGIO_USER_TOKEN and ALTEGIO_LOCATION_ID must be set in environment variables'
  );
}
