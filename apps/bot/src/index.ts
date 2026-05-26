import logger from '@bot/logger';
import { BotManager } from './BotManager';
import { config } from './config';

async function main() {
  logger.info(`Starting Clinic Bot in ${config.app.env} mode...`);

  const botManager = new BotManager();
  await botManager.start();
}

main().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
