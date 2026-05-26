# Clinic Bot - Phase 2 Implementation

Фаза 2 добавляет проверяемый AI и mailing слой поверх готовой Фазы 1.

## Что реализовано

- `@bot/ai` - AI помощник клиники.
- Локальная RAG-база в `modules/ai/src/knowledge.ts`.
- OpenRouter fallback, если задан `OPENROUTER_API_KEY`.
- `@bot/mailing` - выбор аудитории и постановка Telegram-рассылок в очередь.
- Telegram `/menu` с кнопками AI, записей, настроек и admin dry-run.
- HTTP `/miniapp` для быстрой визуальной проверки.
- HTTP `/api/status` для проверки счётчиков и режима AI.
- Prisma модели `AiMessage` и `MailingCampaign`.

## Проверка

```bash
npm install
npm run db:generate --workspace=@bot/database
npm run build
npm test
npm run dev
```

Для полноценной проверки очередей нужны PostgreSQL и Redis. Если Redis не запущен, AI-ответы в Telegram могут работать, но рассылки и отложенные уведомления не будут доставляться.

## Telegram сценарии

- `/menu` - открыть меню.
- `AI помощник` - бот ждёт вопрос и отвечает по базе знаний.
- `/ask магний помогает со сном?` - прямой AI-вопрос.
- `Мои записи` - показывает активные записи, связанные с Telegram ID.
- `Настройки` - включает/отключает маркетинговые рассылки.
- `/mailing_test` - admin-only dry-run аудитории без отправки.

## Мини‑страница

После запуска core-bot:

```text
http://localhost:3000/miniapp
http://localhost:3000/api/status
```

`/miniapp` не заменяет полноценный Telegram Mini App из Фазы 3. Это лёгкий проверочный экран для текущей фазы.

## Ограничения AI

- AI не ставит диагнозы.
- AI не назначает лечение и дозировки.
- При противопоказаниях, беременности, острых состояниях и лекарственных взаимодействиях ответ должен направлять клиента к специалисту.
- Если OpenRouter недоступен, бот отвечает локально на основе базы знаний.

## Mailing

Поддерживаемые аудитории:

- `all`
- `marketing_opt_in`
- `active_clients`

Рассылка использует существующий `notifications` queue и Telegram worker, поэтому сохраняет retry/backoff и логирование.
