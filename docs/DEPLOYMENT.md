# Cloud Deployment

## Минимальные сервисы

Для production нужны:

- Web service: `core-bot`
- Worker service: `@bot/notifications`
- PostgreSQL
- Redis
- Secret/env storage
- HTTPS URL для Altegio webhook

## Environment

Обязательные переменные:

```env
NODE_ENV=production
PORT=3000
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_URL=https://<your-domain>
DATABASE_URL=...
REDIS_URL=...
ALTEGIO_PARTNER_TOKEN=...
ALTEGIO_USER_TOKEN=...
ALTEGIO_LOCATION_ID=...
ALTEGIO_WEBHOOK_SECRET=...
ADMIN_CHAT_ID=...
```

AI:

```env
AI_ENABLED=true
OPENROUTER_API_KEY=...
OPENROUTER_MODEL=openai/gpt-4o-mini
```

## Build and Start

Build:

```bash
npm install
npm run db:generate --workspace=@bot/database
npm run build
```

Core bot:

```bash
npm start --workspace=core-bot
```

Worker:

```bash
npm start --workspace=@bot/notifications
```

Перед первым production запуском применить схему:

```bash
npm run db:push --workspace=@bot/database
```

Для строгого production процесса лучше заменить `db push` на Prisma migrations.

## Render

Render поддерживает web services из Git/Docker image, environment variables/secrets и health check path. Для этого проекта:

- Создать PostgreSQL и Redis.
- Создать web service для `core-bot`.
- Создать background worker для `@bot/notifications`.
- Указать health check `/health`.
- Внести env vars из списка выше.

Официальные документы:
- https://render.com/docs/web-services/
- https://render.com/docs/configure-environment-variables/

## Railway

Railway подходит для этого проекта как набор сервисов в одном project:

- PostgreSQL service.
- Redis service.
- App service для `core-bot`.
- Worker service с командой `npm start --workspace=@bot/notifications`.
- Переменные можно ссылать между сервисами через Railway variables.

Официальные документы:
- https://docs.railway.com/cli/deploy
- https://docs.railway.com/guides/postgresql
- https://docs.railway.com/reference/variables

## Fly.io

Fly.io подходит для Docker-based деплоя:

- Деплоить image из `docker/Dockerfile`.
- Отдельно запускать core Machine и worker Machine/process.
- Подключить managed Postgres и Redis.
- Настроить `fly.toml` с HTTP service на `PORT`.

Официальные документы:
- https://fly.io/docs/languages-and-frameworks/dockerfile/
- https://fly.io/docs/apps/deploy/
- https://fly.io/docs/reference/configuration/

## Altegio Webhook

В Altegio указать публичный URL:

```text
https://<your-domain>/webhook/altegio
```

Secret должен совпадать с `ALTEGIO_WEBHOOK_SECRET`.

## Telegram Webhook

В production core-bot регистрирует webhook:

```text
https://<your-domain>/telegram/webhook
```

Значение `<your-domain>` задаётся через `TELEGRAM_WEBHOOK_URL`.

## Production Checklist

- `npm run build` проходит.
- `npm test` проходит.
- `DATABASE_URL` указывает на production PostgreSQL.
- `REDIS_URL` указывает на production Redis.
- `NODE_ENV=production`.
- `ALTEGIO_LOCATION_ID` заполнен.
- `ADMIN_CHAT_ID` заполнен.
- Health check `/health` возвращает `200`.
- `/api/status` показывает `ok: true`.
