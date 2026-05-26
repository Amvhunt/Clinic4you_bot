# Clinic Bot Architecture

## Структура Проекта

```
project/
├── apps/
│   ├── bot/              # Core Telegram bot
│   ├── api/              # REST API (Фаза 2+)
│   ├── admin-panel/      # Next.js admin (Фаза 3)
│   └── miniapp/          # Telegram WebApp (Фаза 3)
│
├── modules/
│   ├── auth/             # Authentication
│   ├── altegio/          # Altegio integration
│   ├── ai/               # AI/RAG (Фаза 2)
│   ├── crm/              # CRM features
│   ├── booking/          # Booking logic
│   ├── inventory/        # Inventory management
│   ├── notifications/    # Telegram notifications + queues
│   ├── loyalty/          # Loyalty points system
│   ├── payments/         # Payment processing
│   └── analytics/        # Analytics and reporting
│
├── shared/               # Shared utilities and types
├── database/             # Prisma ORM and migrations
├── docker/               # Docker configurations
├── docs/                 # Documentation
├── package.json          # Root workspaces config
├── turbo.json            # Turborepo config
└── ecosystem.config.js   # PM2 configuration
```

## Архитектурные принципы

### 1. Устойчивость (Resilience)
- **Graceful Shutdown**: Корректное завершение при деплое
- **Queue Buffers**: BullMQ как буфер между компонентами
- **Circuit Breaker**: Обработка ошибок внешних API
- **Retry Logic**: Exponential backoff на неудачи

### 2. Масштабируемость
- **Monorepo**: Независимые пакеты, одна координация
- **Worker Processes**: Отделённые процессы для очередей
- **Event-driven**: Слабая связанность через события
- **Database Queuing**: Резервное логирование в БД

### 3. Безопасность
- **Webhook Verification**: HMAC-SHA256 подписи
- **Environment Variables**: Чувствительные данные в .env
- **Input Validation**: Joi schemas для данных
- **Rate Limiting**: В планах на Фазе 2+

### 4. Наблюдаемость
- **Structured Logging**: Winston логи с контекстом
- **Database Audit Trail**: Все события в БД
- **Health Checks**: /health endpoint для мониторинга
- **Error Tracking**: Детальные логи ошибок

## Компоненты и их взаимодействие

### Core Bot (Telegraf + Express)
```
HTTP Request → Express Server
    ↓
Webhook Verification
    ↓
Event Processing
    ↓
BullMQ Jobs → Redis Queue
    ↓
Workers Pick Up Jobs
    ↓
Telegram Bot API
```

### Notifications Pipeline
```
BullMQ Queue
    ↓
NotificationWorker (Process Job)
    ↓
Build Message (i18next)
    ↓
Send via Telegram API
    ↓
Log Result to DB
    ↓
Retry if Failed (up to 3 times)
```

### Altegio Integration
```
Altegio System
    ↓ (Webhook POST)
Core Bot /webhook/altegio
    ↓
WebhookVerifier (HMAC check)
    ↓
WebhookParser (Extract data)
    ↓
Handler (booking_created/updated/cancelled)
    ↓
Prisma (Save to DB)
    ↓
Notifications (Enqueue messages)
```

## Данные и Моделирование

### User (Клиент)
- Telegram ID (PK)
- Altegio Client ID (UK)
- Контактные данные
- Язык предпочтения
- Настройки уведомлений

### Appointment (Запись)
- Altegio Booking ID (UK)
- Время (start/end)
- Статус (confirmed/cancelled/completed)
- Отслеживание напоминаний
- Связь с пользователем

### Notification (Лог)
- Тип (confirmation/reminder/admin)
- Статус доставки
- Количество попыток
- Время отправки
- Результаты

## Жизненный цикл события

1. **Создание события в Altegio** → booking_created webhook
2. **Получение в Core Bot** → POST /webhook/altegio
3. **Проверка подписи** → HMAC-SHA256 verification
4. **Парсинг события** → Extraction of booking data
5. **Сохранение в БД** → Prisma create/update
6. **Очередь сообщений** → Enqueue notifications
7. **BullMQ обработка** → Worker picks up jobs
8. **Отправка в Telegram** → Telegram Bot API call
9. **Логирование результата** → DB audit trail
10. **Retry на ошибку** → Exponential backoff (max 3 times)

## Интеграция с внешними системами

### Altegio
- Event webhooks для booking events
- REST API для получения деталей клиента/специалиста
- Signature verification для безопасности

### Telegram
- Bot Token для основной аутентификации
- SendMessage API для уведомлений
- User ID как основной идентификатор

### OpenRouter (Фаза 2)
- LLM API для обработки текста
- RAG для контекстных ответов
- Интеграция через AI модуль

## Масштабирование на Фазу 2 и 3

### Фаза 2: AI и Рассылки
- Добавить AI модуль с RAG
- Реализовать mailing module
- Интегрировать OpenRouter

### Фаза 3: Web Interface
- Создать Next.js админ панель
- Telegram Mini App для клиентов
- Analytics dashboard
- Inventory management

Все компоненты смогут независимо масштабироваться благодаря event-driven архитектуре.
