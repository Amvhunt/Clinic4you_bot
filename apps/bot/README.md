# Core Bot

Main Telegram bot application using Telegraf framework.

## Features

- Telegraf 4.x integration
- Graceful shutdown handling
- Health check endpoint
- Webhook support
- Polling fallback for development
- Structured logging with Winston

## Environment Variables

See `.env.example` in root directory.

## Scripts

- `npm run dev` - Start in development mode (polling)
- `npm run build` - Build TypeScript
- `npm start` - Run built bot
- `npm test` - Run tests
- `npm run lint` - Run linter
