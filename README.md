# Clinic Bot Monorepo

Telegram bot для клиник с поддержкой записей, уведомлений, AI и аналитики. Реализовано на Turborepo с микросервисной архитектурой.

## 📋 Фазы разработки

- **Фаза 1**: Уведомления о записях + Altegio интеграция
- **Фаза 2** (текущая): AI модуль + Mailing система + проверочное меню
- **Фаза 3**: Telegram Mini App + Admin Panel + Analytics

## 🚀 Быстрый старт

```bash
# Setup environment
cp .env.example .env
npm install
npm run db:generate --workspace=database
npm run build
npm run db:migrate --workspace=database

# Check health
curl http://localhost:3000/health
```

## 📁 Структура проекта

```
apps/          - Приложения (bot, api, admin-panel, miniapp)
modules/       - Бизнес-логика модулей
shared/        - Общие утилиты (logger, types)
database/      - Prisma ORM и миграции
docs/          - Документация
```

## 📚 Документация

- [Быстрый старт](./QUICKSTART.md) - Инструкция для начинающих
- [Архитектура](./docs/ARCHITECTURE.md) - Описание системы
- [Фаза 1 гайд](./docs/PHASE1_GUIDE.md) - Детальный план реализации
- [Фаза 2 гайд](./docs/PHASE2_GUIDE.md) - AI, рассылки и меню проверки
- [Deployment](./docs/DEPLOYMENT.md) - Поднятие на cloud ресурсах
- [Журнал изменений](./docs/CHANGELOG.md) - Что изменилось по фазам
- [Core Bot](./apps/bot/README.md) - Документация бота

## 🔧 Основные команды

```bash
npm run dev          # Start development
npm run build        # Build all packages
npm test             # Run tests
npm run lint         # Run linter
npm run db:migrate   # Database migrations
```

## 🏗️ Компоненты Фазы 2

- **Core Bot**: Telegraf + Express для webhook обработки
- **Notifications**: BullMQ worker для async уведомлений
- **Altegio**: Интеграция с booking системой
- **AI**: локальная RAG-база + OpenRouter fallback
- **Mailing**: Telegram-рассылки через очередь уведомлений
- **Database**: Prisma ORM с PostgreSQL
- **i18n**: Поддержка RU/UA/EN
- **Docker**: Полное окружение для dev и production

## 🔌 Интеграции

- **Telegram Bot API** - Отправка сообщений
- **Altegio** - Получение booking событий
- **PostgreSQL** - Хранение данных
- **Redis** - Очереди (BullMQ)
- **OpenRouter** - AI (Фаза 2)

## 🛠️ Tech Stack

- **Framework**: Telegraf 4.x
- **Web Server**: Express.js
- **Database**: PostgreSQL + Prisma ORM
- **Queue**: BullMQ + Redis
- **Language**: TypeScript
- **Monorepo**: Turborepo
- **Deployment**: PM2

## 📊 Поток данных Фазы 1

```
Altegio Webhook → Core Bot → BullMQ Queue → Notification Worker → Telegram
     ↓                ↓            ↓                  ↓               ↓
  Event        Validation      Job Store         Process         User gets
```

## Проверка Фазы 2

```bash
npm run db:generate --workspace=@bot/database
npm run build
npm test
npm run dev
```

В Telegram:
- `/menu` - главное меню
- `/ask <вопрос>` - AI помощник
- `/appointments` - записи клиента
- `/settings` - настройки рассылок
- `/mailing_test` - dry-run рассылки для `ADMIN_CHAT_ID`

В браузере:
- `http://localhost:3000/miniapp` - лёгкая проверочная страница
- `http://localhost:3000/api/status` - статус модулей и счётчики

## 🚀 Локальный запуск

```bash
npm install
npm run db:generate --workspace=database
npm run build
npm run db:migrate --workspace=database
npm run dev --workspace=core-bot
npm run dev --workspace=@bot/notifications
```

## 📝 Environment

Скопируйте `.env.example` в `.env` и заполните значения:

```
TELEGRAM_BOT_TOKEN=...
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
ALTEGIO_PARTNER_TOKEN=...
ALTEGIO_USER_TOKEN=...
ALTEGIO_LOCATION_ID=...
ALTEGIO_WEBHOOK_SECRET=...
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openai/gpt-4o-mini
AI_ENABLED=true
```

## 📈 Production Deployment

```bash
npm run build
pm2 start ecosystem.config.js
pm2 monit
```

## 🤝 Контрибьютинг

1. Создайте feature branch
2. Делайте commits
3. Создайте pull request

## 📞 Support

- Документация: `/docs`
- Логирование: `logs/`
- Issues: GitHub issues

---

**Status**: Фаза 2 - Development ✅  
**Last Updated**: May 26, 2026
