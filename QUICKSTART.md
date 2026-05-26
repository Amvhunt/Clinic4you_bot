# Getting Started - Clinic Bot Фаза 1

## Предварительные требования

- Node.js >= 18
- Docker и docker-compose
- Git
- Telegram Bot Token (от @BotFather)
- Altegio API ключ и webhook secret

## Быстрый старт (5 минут)

### 1. Клонирование и настройка

```bash
cd /path/to/clinic-bot

# Copy environment template
cp .env.example .env

# Edit with your values
nano .env
```

### 2. Запуск в Docker

```bash
# Start all services
docker-compose -f docker/docker-compose.yml up -d

# Check status
docker-compose -f docker/docker-compose.yml ps

# View logs
docker-compose -f docker/docker-compose.yml logs -f core-bot
```

### 3. Миграция БД

```bash
# Run migrations
docker-compose -f docker/docker-compose.yml exec core-bot npm run db:migrate --workspace=database

# (Optional) Seed test data
docker-compose -f docker/docker-compose.yml exec core-bot npm run db:seed --workspace=database
```

### 4. Настройка Altegio Webhook

В Altegio панели администратора:
1. Перейти в **Интеграции** → **Webhooks**
2. Добавить новый webhook:
   - URL: `https://your-domain.com/webhook/altegio`
   - Events: booking_created, booking_updated, booking_cancelled
   - Secret: (значение из ALTEGIO_WEBHOOK_SECRET)
3. Test connection

### 5. Проверка работы

```bash
# Check bot health
curl http://localhost:3000/health

# Check bot in Telegram
# Send /start to your bot

# View Redis queue status (optional)
docker-compose -f docker/docker-compose.yml exec redis redis-cli monitor
```

## Локальная разработка без Docker

### 1. Установка зависимостей

```bash
npm install

# Generate Prisma client
npm run db:generate --workspace=database
```

### 2. Локальная БД (требует PostgreSQL)

```bash
# Create database
createdb clinic_bot

# Run migrations
npm run db:migrate --workspace=database

# Start Prisma Studio (optional)
npm run db:studio --workspace=database
```

### 3. Redis локально

```bash
# Install Redis (macOS)
brew install redis

# Start Redis
redis-server

# Or use Docker для Redis только
docker run -d -p 6379:6379 redis:7-alpine
```

### 4. Запуск приложения

```bash
# Terminal 1: Core Bot
npm run dev --workspace=core-bot

# Terminal 2: Notification Worker
npm run dev --workspace=@bot/notifications

# Bot will be available at http://localhost:3000
```

## Обычные задачи

### Просмотр логов

```bash
# Docker
docker-compose -f docker/docker-compose.yml logs -f core-bot

# Local
tail -f logs/combined.log
```

### Работа с БД

```bash
# Create new migration
npm run db:migrate --workspace=database

# Reset database (dev only)
npm run db:push --workspace=database

# Open Prisma Studio
npm run db:studio --workspace=database
```

### Тестирование Webhook

```bash
curl -X POST http://localhost:3000/webhook/altegio \
  -H "Content-Type: application/json" \
  -H "X-Signature: $(echo -n '{...}' | openssl dgst -sha256 -hmac 'secret' -hex)" \
  -d '{
    "event": "booking_created",
    "created_at": "2024-01-15T10:00:00Z",
    "data": {
      "booking_id": "booking_123",
      "client_id": "client_456",
      "service_name": "Консультация",
      "start_datetime": "2024-01-20T14:00:00Z",
      "finish_datetime": "2024-01-20T14:30:00Z"
    }
  }'
```

### Чтение очередей

```bash
# Using redis-cli
redis-cli

# Inside redis CLI
LRANGE notifications 0 -1
HGETALL job:notification:123
```

## Структура файлов

```
e:\bot\
├── apps/bot/                 # Core application
│   ├── src/
│   │   ├── index.ts         # Entry point
│   │   ├── BotManager.ts    # Bot class
│   │   ├── config/          # Configuration
│   │   ├── webhooks/        # Webhook handlers
│   │   └── utils/           # Utilities
│   ├── locales/             # i18next translations
│   └── package.json
│
├── modules/
│   ├── notifications/        # Notification worker
│   ├── altegio/             # Altegio integration
│   └── ...
│
├── database/
│   ├── prisma/
│   │   └── schema.prisma    # Database schema
│   └── src/index.ts
│
├── docker/                   # Docker files
├── docs/                     # Documentation
└── package.json             # Root config
```

## Решение проблем

### Bot не отвечает на сообщения

```bash
# Check bot token
echo $TELEGRAM_BOT_TOKEN

# Check if bot is running
curl http://localhost:3000/health

# View logs
docker-compose -f docker/docker-compose.yml logs core-bot | grep -i "error\|bot"
```

### Webhook errors

```bash
# Check webhook handler logs
docker-compose -f docker/docker-compose.yml logs core-bot | grep -i "webhook"

# Verify signature generation
# (Use test curl command above)
```

### Database connection errors

```bash
# Check PostgreSQL is running
docker-compose -f docker/docker-compose.yml logs postgres

# Check connection string in .env
cat .env | grep DATABASE_URL

# Test connection
psql -U clinic_user -d clinic_bot -h localhost
```

### Queue is stuck

```bash
# Clear Redis
redis-cli FLUSHDB

# Check queue status
redis-cli LLEN notifications

# View specific job
redis-cli HGETALL job:notifications:xxxx
```

## Следующие шаги

1. **Протестировать webhook** - Send test booking from Altegio
2. **Проверить уведомления** - Should receive Telegram messages
3. **Просмотреть логи** - Verify everything is logged correctly
4. **Настроить мониторинг** - Set up PM2 or other monitoring
5. **Деплоить на production** - Use PM2 + nginx

## Полезные ссылки

- [Telegraf Documentation](https://telegraf.js.org/)
- [BullMQ Docs](https://docs.bullmq.io/)
- [Prisma ORM](https://www.prisma.io/docs/)
- [Altegio API](https://docs.altegio.com/)
- [Docker Compose](https://docs.docker.com/compose/)

## Контакты и поддержка

Для вопросов по реализации:
- Логирование issues в GitHub
- Просмотр документации в `/docs`
- Проверка логов в `logs/`
