import { Telegraf, Context } from 'telegraf';
import { Update } from 'telegraf/types';
import express from 'express';
import { Server } from 'http';
import logger from '@bot/logger';
import { config } from './config';
import { handleAltegioWebhook } from './webhooks/altegio';
import { closeQueues } from '@bot/notifications';

export class BotManager {
  private bot: Telegraf<Context<Update>>;
  private app: express.Application;
  private server?: Server;
  private isShuttingDown = false;

  constructor() {
    this.bot = new Telegraf(config.telegram.token);
    this.app = express();
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

    // Altegio webhook endpoint
    this.app.post('/webhook/altegio', handleAltegioWebhook);

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
    this.bot.start((ctx) => {
      logger.info(`User ${ctx.from?.id} started the bot`);
      ctx.reply('Welcome to Clinic Bot! 👋');
    });

    // Help command
    this.bot.help((ctx) => {
      const helpText = `
/start - Start the bot
/help - Show this help message
/appointment - Book an appointment
/reminder - Set appointment reminder
      `;
      ctx.reply(helpText);
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
        logger.info('Bot running in webhook mode');
        // TODO: configure webhook URL
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
}
