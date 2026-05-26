module.exports = {
  apps: [
    {
      name: 'core-bot',
      script: 'dist/apps/bot/src/index.js',
      instances: 1,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/core-bot-error.log',
      out_file: 'logs/core-bot-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '500M',
      grace_delay: 5000,
      listen_timeout: 10000,
      kill_timeout: 5000,
    },
    {
      name: 'notification-worker',
      script: 'dist/modules/notifications/src/worker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      error_file: 'logs/notification-worker-error.log',
      out_file: 'logs/notification-worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      max_memory_restart: '300M',
      grace_delay: 5000,
    },
  ],
};
