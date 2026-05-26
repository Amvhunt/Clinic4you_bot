# Core Bot

Main Telegram bot application using Telegraf framework.

## Features

- Telegraf 4.x integration
- Graceful shutdown handling
- Health check endpoint
- Webhook support
- Polling fallback for development
- Structured logging with Winston
- Telegram `/menu` with AI, appointments, settings and admin mailing dry-run
- `/miniapp` and `/api/status` HTTP endpoints for quick verification

## Bot Commands

- `/menu` - open inline menu
- `/ask <question>` - ask the clinic AI assistant
- `/appointments` - show active appointments linked to Telegram ID
- `/settings` - toggle marketing mailing preference
- `/mailing_test` - admin-only mailing dry-run

## Environment Variables

See `.env.example` in root directory.

## Scripts

- `npm run dev` - Start in development mode (polling)
- `npm run build` - Build TypeScript
- `npm start` - Run built bot
- `npm test` - Run tests
- `npm run lint` - Run linter
