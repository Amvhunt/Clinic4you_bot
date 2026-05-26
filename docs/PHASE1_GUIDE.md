# Clinic Bot - Phase 1 Implementation

## Обзор Фазы 1

Фаза 1 сосредоточена на реализации **системы уведомлений о записях** через интеграцию с Altegio и отправку сообщений в Telegram.

## ✅ Реализованные компоненты

### 1. Структура Turborepo
- ✅ Монорепо с поддержкой workspaces
- ✅ Конфигурация TypeScript с path aliases
- ✅ Prettier и ESLint настройки

### 2. Core Bot (Telegraf)
- ✅ BotManager с graceful shutdown
- ✅ Express.js сервер для webhooks
- ✅ Health check endpoint
- ✅ Базовые команды (start, help)
- ✅ Обработка ошибок

### 3. Altegio Integration
- ✅ AltegioClient для API запросов
- ✅ WebhookVerifier для проверки подписей
- ✅ WebhookParser для парсинга событий
- ✅ Поддержка событий: booking_created, booking_updated, booking_cancelled

### 4. Notifications Module
- ✅ BullMQ очереди для async обработки
- ✅ Redis для хранения очередей
- ✅ NotificationWorker для отправки сообщений
- ✅ Retry логика с exponential backoff
- ✅ Логирование в БД

### 5. Database (Prisma)
- ✅ User модель с Altegio интеграцией
- ✅ Appointment модель для записей
- ✅ Notification модель для логирования
- ✅ UserPreferences для управления настройками
- ✅ LoyaltyPoints для будущей системы бонусов
- ✅ QueueJob для отслеживания очередей

### 6. Локализация (i18next)
- ✅ Поддержка RU, UA, EN
- ✅ Перевод сообщений для уведомлений
- ✅ Динамическая смена языка по пользователю

### 7. Docker & Deployment
- ✅ Dockerfile для приложения
- ✅ docker-compose для dev окружения
- ✅ PostgreSQL контейнер
- ✅ Redis контейнер
- ✅ PM2 конфигурация для production

## 🔄 Поток работы Фазы 1

```
Altegio Webhook → Core Bot (HTTP POST)
                    ↓
              Verify Signature
                    ↓
              Parse Event
                    ↓
         [booking_created/updated/cancelled]
                    ↓
           ┌─────────┼─────────┐
           ↓         ↓         ↓
         [DB]   [Queues]  [Telegram]
           ↓         ↓         ↓
    Save to DB   Enqueue    Notifications
                 Jobs       sent immediately
                   ↓
              BullMQ Worker
                   ↓
              Send Telegram
                   ↓
              Log to DB
```

## 📥 Входящие события

### booking_created
- Подтверждение записи клиенту (сразу)
- Напоминание за 24 часа (отложено)
- Напоминание за 2 часа (отложено)
- Уведомление админу (сразу)

### booking_updated
- Уведомление клиенту об изменении времени
- Уведомление админу

### booking_cancelled
- Уведомление клиенту об отмене
- Уведомление админу

## 🚀 Развертывание

### Development

```bash
# Copy environment variables
cp .env.example .env

# Edit .env with your values
nano .env

# Start development environment
bash docker/start-dev.sh

# Or manually:
docker-compose -f docker/docker-compose.yml up -d
npm install
npm run db:migrate --workspace=database
```

### Production

```bash
# Build all packages
npm run build

# Start with PM2
pm2 start ecosystem.config.js

# Monitor
pm2 monit
pm2 logs
```

## 📝 Environment Variables

```
# Telegram
TELEGRAM_BOT_TOKEN=...
ADMIN_CHAT_ID=...

# Database
DATABASE_URL=postgresql://user:pass@host/db

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Altegio
ALTEGIO_API_KEY=...
ALTEGIO_WEBHOOK_SECRET=...

# Localization
DEFAULT_LOCALE=ru
SUPPORTED_LOCALES=ru,ua,en

# Logging
LOG_LEVEL=info
NODE_ENV=production
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in specific workspace
npm test --workspace=core-bot

# Run with coverage
npm test -- --coverage
```

## 📊 Database Migrations

```bash
# Create new migration
npm run db:migrate --workspace=database

# Push schema (dev only)
npm run db:push --workspace=database

# Open Prisma Studio
npm run db:studio --workspace=database

# Seed database
npm run db:seed --workspace=database
```

## 🔧 Troubleshooting

### Webhook signature verification fails
- Убедитесь, что ALTEGIO_WEBHOOK_SECRET совпадает в Altegio панели
- Проверьте логи: `docker-compose logs core-bot`

### Notifications not sending
- Проверьте TELEGRAM_BOT_TOKEN валидный
- Убедитесь Redis запущен: `docker-compose logs redis`
- Проверьте очереди: используйте Bull UI (опционально)

### Database connection error
- Проверьте DATABASE_URL в .env
- Убедитесь PostgreSQL запущен: `docker-compose logs postgres`
- Выполните миграции: `npm run db:migrate --workspace=database`

## 📚 Дальнейшие шаги

### Фаза 2 (3-4 недели)
- [ ] AI модуль с RAG для препаратов
- [ ] Mailing система (welcome, birthday, follow-up)
- [ ] OpenRouter интеграция

### Фаза 3 (4-5 недель)
- [ ] Telegram Mini App с WebApp
- [ ] Next.js Admin Panel
- [ ] Analytics и инвентарь управление

## 📞 Support

По вопросам реализации обратитесь в документацию модулей:
- [Core Bot](./apps/bot/README.md)
- [Notifications](./modules/notifications/README.md)
- [Database](./database/README.md)
