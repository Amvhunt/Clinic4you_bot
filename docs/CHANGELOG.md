# Changelog

## 2026-05-26 - Phase 2

- Added `@bot/ai` package with local RAG knowledge base.
- Added OpenRouter-compatible AI client with local fallback.
- Added `@bot/mailing` package for Telegram mailing campaign queueing.
- Added Prisma models `AiMessage` and `MailingCampaign`.
- Added Telegram `/menu`, `/ask`, `/appointments`, `/settings`, `/mailing_test`.
- Added admin dry-run action for mailing audience checks.
- Added `/miniapp` verification page.
- Added `/api/status` endpoint.
- Added cloud deployment guide.
- Updated Docker env handling for AI variables.
- Kept notification/reminder workers isolated from core-bot imports.

## 2026-05-26 - Phase 1 hardening

- Updated Altegio auth model to partner/user token plus location ID.
- Added reminder worker.
- Fixed workspace configs and tests.
- Added webhook payload compatibility for record events.
