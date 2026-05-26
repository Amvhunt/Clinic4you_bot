import dotenv from 'dotenv';

dotenv.config();

export const config = {
  telegram: {
    token: process.env.TELEGRAM_BOT_TOKEN || '',
    adminChatId: process.env.ADMIN_CHAT_ID || '',
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/clinic_bot',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  altegio: {
    apiKey: process.env.ALTEGIO_API_KEY || '',
    webhookSecret: process.env.ALTEGIO_WEBHOOK_SECRET || '',
  },
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || '',
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
