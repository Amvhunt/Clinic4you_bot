# Implementation Log

## 2026-05-26

### Phase 2 planning

Implemented a vertical slice instead of a full Phase 3 Mini App:

- AI assistant is available from Telegram.
- Mailing can be dry-run from Telegram admin menu.
- `/miniapp` is a lightweight verification page only.
- Full Next.js admin panel and production Telegram Mini App remain Phase 3 scope.

### Validation

Commands run successfully:

```bash
npm run db:generate --workspace=@bot/database
npm run build
npm test
```

### Known runtime prerequisites

- Redis must be running for BullMQ queues.
- PostgreSQL must be running for Prisma reads/writes.
- Port `3000` must be free or `PORT` must be changed.
- OpenRouter is optional; without `OPENROUTER_API_KEY`, AI uses local RAG answers.
