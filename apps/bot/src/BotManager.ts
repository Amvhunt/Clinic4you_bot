import { Telegraf, Context, Markup } from 'telegraf';
import { Update } from 'telegraf/types';
import express from 'express';
import { Server } from 'http';
import logger from '@bot/logger';
import prisma from '@bot/database';
import { ClinicAiClient } from '@bot/ai';
import { MailingService } from '@bot/mailing';
import { config } from './config';
import { handleAltegioWebhook } from './webhooks/altegio';
import { closeQueues } from '@bot/notifications';

export class BotManager {
  private bot: Telegraf<Context<Update>>;
  private app: express.Application;
  private aiClient: ClinicAiClient;
  private mailingService: MailingService;
  private waitingForAiQuestion = new Set<number>();
  private server?: Server;
  private isShuttingDown = false;

  constructor() {
    this.bot = new Telegraf(config.telegram.token);
    this.app = express();
    this.aiClient = new ClinicAiClient({
      apiKey: config.openrouter.apiKey,
      model: config.openrouter.model,
    });
    this.mailingService = new MailingService();
    this.setupMiddleware();
    this.setupGracefulShutdown();
  }

  private setupMiddleware() {
    this.app.use(express.json({
      verify: (req, _res, buf) => {
        (req as any).rawBody = buf.toString('utf8');
      },
    }));

    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({ status: 'ok', uptime: process.uptime() });
    });

    this.app.get('/api/status', async (_req, res) => {
      const [users, appointments, notifications, campaigns] = await Promise.all([
        prisma.user.count(),
        prisma.appointment.count(),
        prisma.notification.count(),
        prisma.mailingCampaign.count(),
      ]);

      res.status(200).json({
        ok: true,
        phase: 2,
        ai: {
          enabled: config.ai.enabled,
          mode: config.openrouter.apiKey ? 'openrouter' : 'local',
        },
        counts: {
          users,
          appointments,
          notifications,
          campaigns,
        },
      });
    });

    this.app.get('/miniapp', (_req, res) => {
      res.type('html').send(`<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Clinic Bot</title>
  <style>
    body { margin: 0; font-family: Arial, sans-serif; background: #f6f7f9; color: #1f2937; }
    main { max-width: 720px; margin: 0 auto; padding: 24px; }
    section { background: #fff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
    button { border: 0; border-radius: 6px; padding: 10px 12px; background: #0f766e; color: #fff; cursor: pointer; }
    pre { white-space: pre-wrap; background: #111827; color: #f9fafb; padding: 12px; border-radius: 6px; overflow: auto; }
  </style>
</head>
<body>
  <main>
    <h1>Clinic Bot Phase 2</h1>
    <section>
      <h2>Статус</h2>
      <button id="load">Обновить</button>
      <pre id="status">Нажмите "Обновить"</pre>
    </section>
    <section>
      <h2>Проверка</h2>
      <p>Основная проверка AI и рассылок доступна в Telegram через /menu.</p>
    </section>
  </main>
  <script>
    document.getElementById('load').onclick = async () => {
      const response = await fetch('/api/status');
      document.getElementById('status').textContent = JSON.stringify(await response.json(), null, 2);
    };
  </script>
</body>
</html>`);
    });

    // Altegio webhook endpoint
    this.app.post('/webhook/altegio', handleAltegioWebhook);

    // Telegram webhook endpoint for production deployments
    this.app.use(this.bot.webhookCallback('/telegram/webhook'));

    // Generic webhook endpoint (for future use)
    this.app.post('/webhook/:path', async (req, res) => {
      try {
        const path = req.params.path;
        logger.info(`Webhook received: ${path}`);
        res.status(200).json({ ok: true });
      } catch (error) {
        logger.error('Webhook error:', error);
        res.status(500).json({ ok: false, error: 'Internal server error' });
      }
    });
  }

  private setupGracefulShutdown() {
    const gracefulShutdown = async (signal: string) => {
      if (this.isShuttingDown) return;
      this.isShuttingDown = true;

      logger.info(`Received ${signal}, starting graceful shutdown...`);

      try {
        // Stop bot
        logger.info('Stopping Telegraf bot...');
        this.bot.stop(signal);
        logger.info('Bot stopped gracefully');

        if (this.server) {
          logger.info('Closing HTTP server...');
          await new Promise<void>((resolve, reject) => {
            this.server?.close((error) => (error ? reject(error) : resolve()));
          });
          logger.info('HTTP server closed');
        }

        // Close queue workers and schedulers
        logger.info('Closing queue workers...');
        await closeQueues();
        logger.info('Queue workers closed');

        logger.info('Graceful shutdown completed');
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  }

  public setupHandlers() {
    // Start command
    this.bot.start(async (ctx) => {
      logger.info(`User ${ctx.from?.id} started the bot`);
      await this.ensureUser(ctx);
      await ctx.reply('Добро пожаловать в Clinic Bot.', this.mainMenu(ctx.from?.id));
    });

    // Help command
    this.bot.help((ctx) => {
      const helpText = `
/start - Start the bot
/help - Show this help message
/menu - Open clinic menu
/ask <question> - Ask clinic AI assistant
/appointments - Show your appointments
/settings - Notification settings
      `;
      ctx.reply(helpText);
    });

    this.bot.command('menu', async (ctx) => {
      await this.ensureUser(ctx);
      await ctx.reply('Меню клиники', this.mainMenu(ctx.from?.id));
    });

    this.bot.command('appointments', async (ctx) => {
      await this.ensureUser(ctx);
      await this.replyAppointments(ctx);
    });

    this.bot.command('settings', async (ctx) => {
      await this.ensureUser(ctx);
      await this.replySettings(ctx);
    });

    this.bot.command('ask', async (ctx) => {
      await this.ensureUser(ctx);
      const text = this.commandPayload(ctx);
      if (!text) {
        await ctx.reply('Напишите вопрос после команды: /ask что входит в капельницу с магнием?');
        return;
      }
      await this.replyAiAnswer(ctx, text);
    });

    this.bot.command('mailing_test', async (ctx) => {
      if (!this.isAdmin(ctx.from?.id)) {
        await ctx.reply('Команда доступна только администратору.');
        return;
      }

      const result = await this.mailingService.createAndQueueCampaign({
        title: 'Тестовая рассылка',
        message: 'Тестовая рассылка Clinic Bot. Если вы получили это сообщение, канал работает.',
        audience: 'all',
        createdBy: String(ctx.from?.id),
        dryRun: true,
      });

      await ctx.reply(`Dry-run рассылки: получателей ${result.recipients}, сообщений в очередь ${result.queued}.`);
    });

    this.bot.action('menu:ai', async (ctx) => {
      await ctx.answerCbQuery();
      const userId = ctx.from?.id;
      if (!userId) return;
      this.waitingForAiQuestion.add(userId);
      await ctx.reply('Напишите вопрос по услугам, процедурам или записи. Я отвечу по базе знаний клиники.');
    });

    this.bot.action('menu:appointments', async (ctx) => {
      await ctx.answerCbQuery();
      await this.replyAppointments(ctx);
    });

    this.bot.action('menu:settings', async (ctx) => {
      await ctx.answerCbQuery();
      await this.replySettings(ctx);
    });

    this.bot.action('settings:toggle_marketing', async (ctx) => {
      await ctx.answerCbQuery();
      await this.ensureUser(ctx);
      const user = await prisma.user.findUnique({
        where: { telegramId: String(ctx.from?.id) },
        include: { preferences: true },
      });

      if (!user) return;
      const enabled = !(user.preferences?.marketingEmails || false);
      await prisma.userPreferences.upsert({
        where: { userId: user.id },
        update: { marketingEmails: enabled },
        create: { userId: user.id, marketingEmails: enabled },
      });
      await ctx.reply(enabled ? 'Рассылки включены.' : 'Рассылки отключены.');
    });

    this.bot.action('admin:mailing_dry_run', async (ctx) => {
      await ctx.answerCbQuery();
      if (!this.isAdmin(ctx.from?.id)) {
        await ctx.reply('Доступно только администратору.');
        return;
      }
      const result = await this.mailingService.createAndQueueCampaign({
        title: 'Admin dry-run',
        message: 'Проверка аудитории рассылки',
        audience: 'all',
        createdBy: String(ctx.from?.id),
        dryRun: true,
      });
      await ctx.reply(`Аудитория all: ${result.recipients} пользователей.`);
    });

    this.bot.on('text', async (ctx, next) => {
      const userId = ctx.from?.id;
      if (!userId || !this.waitingForAiQuestion.has(userId)) {
        return next();
      }
      this.waitingForAiQuestion.delete(userId);
      await this.ensureUser(ctx);
      await this.replyAiAnswer(ctx, ctx.message.text);
    });

    // Error handling
    this.bot.catch((err, ctx) => {
      logger.error(`Bot error for user ${ctx.from?.id}:`, err);
      ctx.reply('Sorry, an error occurred. Please try again later.');
    });
  }

  public async start() {
    try {
      this.setupHandlers();

      const port = config.app.port;
      this.server = this.app.listen(port, () => {
        logger.info(`Bot server listening on port ${port}`);
      });

      // Start bot with webhook or polling
      if (config.app.env === 'production') {
        // Webhook mode for production
        if (!config.telegram.webhookUrl) {
          throw new Error('TELEGRAM_WEBHOOK_URL is required in production');
        }
        const webhookEndpoint = `${config.telegram.webhookUrl}/telegram/webhook`;
        await this.bot.telegram.setWebhook(webhookEndpoint);
        logger.info('Bot running in webhook mode');
        await this.notifyAdminWebhookUrl(webhookEndpoint);
      } else {
        // Polling mode for development
        logger.info('Bot running in polling mode');
        await this.bot.launch();
      }
    } catch (error) {
      logger.error('Failed to start bot:', error);
      process.exit(1);
    }
  }

  private async notifyAdminWebhookUrl(webhookUrl: string) {
    if (!config.telegram.adminChatId) return;

    try {
      await this.bot.telegram.sendMessage(
        config.telegram.adminChatId,
        `Webhook установлен и работает: ${webhookUrl}`
      );
      logger.info('Admin notified about webhook registration');
    } catch (error) {
      logger.error('Failed to notify admin about webhook registration:', error);
    }
  }

  private mainMenu(userId?: number) {
    const buttons = [
      [Markup.button.callback('AI помощник', 'menu:ai')],
      [Markup.button.callback('Мои записи', 'menu:appointments')],
      [Markup.button.callback('Настройки', 'menu:settings')],
    ];

    if (this.isAdmin(userId)) {
      buttons.push([Markup.button.callback('Admin: dry-run рассылки', 'admin:mailing_dry_run')]);
    }

    return Markup.inlineKeyboard(buttons);
  }

  private async ensureUser(ctx: Context<Update>) {
    if (!ctx.from) return;

    await prisma.user.upsert({
      where: { telegramId: String(ctx.from.id) },
      update: {
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
      },
      create: {
        telegramId: String(ctx.from.id),
        firstName: ctx.from.first_name,
        lastName: ctx.from.last_name,
        locale: this.normalizeLocale(ctx.from.language_code),
        preferences: {
          create: {},
        },
      },
    });
  }

  private async replyAppointments(ctx: Context<Update>) {
    if (!ctx.from) return;

    const appointments = await prisma.appointment.findMany({
      where: {
        telegramUserId: String(ctx.from.id),
        status: {
          not: 'cancelled',
        },
        startTime: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
      orderBy: { startTime: 'asc' },
      take: 5,
    });

    if (!appointments.length) {
      await ctx.reply('Активных записей не найдено. Если запись есть в клинике, попросите администратора связать Telegram с клиентом Altegio.');
      return;
    }

    const text = appointments
      .map((item) => [
        item.serviceName,
        item.specialist ? `Специалист: ${item.specialist}` : null,
        `Время: ${item.startTime.toLocaleString('ru-RU')}`,
        `Статус: ${item.status}`,
      ].filter(Boolean).join('\n'))
      .join('\n\n');

    await ctx.reply(text);
  }

  private async replySettings(ctx: Context<Update>) {
    if (!ctx.from) return;

    const user = await prisma.user.findUnique({
      where: { telegramId: String(ctx.from.id) },
      include: { preferences: true },
    });

    const marketing = user?.preferences?.marketingEmails ? 'включены' : 'отключены';
    await ctx.reply(`Маркетинговые рассылки: ${marketing}`, Markup.inlineKeyboard([
      [Markup.button.callback('Переключить рассылки', 'settings:toggle_marketing')],
    ]));
  }

  private async replyAiAnswer(ctx: Context<Update>, question: string) {
    if (!config.ai.enabled) {
      await ctx.reply('AI помощник временно отключён.');
      return;
    }

    const locale = this.normalizeLocale(ctx.from?.language_code);
    const answer = await this.aiClient.answer(question, locale);
    const sources = answer.sources.map((source) => source.title).join(', ');

    await prisma.aiMessage.create({
      data: {
        telegramUserId: ctx.from ? String(ctx.from.id) : undefined,
        question,
        answer: answer.answer,
        mode: answer.mode,
        sources: answer.sources as any,
      },
    });

    await ctx.reply(`${answer.answer}\n\nИсточники: ${sources || 'база безопасности'}\nРежим: ${answer.mode}`);
  }

  private commandPayload(ctx: Context<Update>) {
    const text = (ctx.message as any)?.text || '';
    return text.split(' ').slice(1).join(' ').trim();
  }

  private normalizeLocale(value?: string) {
    if (!value) return 'ru';
    if (value.startsWith('uk') || value.startsWith('ua')) return 'ua';
    if (value.startsWith('en')) return 'en';
    return 'ru';
  }

  private isAdmin(userId?: number) {
    return Boolean(userId && config.telegram.adminChatId && String(userId) === config.telegram.adminChatId);
  }
}
