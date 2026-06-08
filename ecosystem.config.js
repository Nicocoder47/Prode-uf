/**
 * PM2 — Oracle Cloud Always Free
 * Procesos: API Express + Worker scheduler + Worker live (heartbeat 60s)
 */
module.exports = {
  apps: [
    {
      name: 'prodem-api',
      script: 'tsx',
      args: 'server/index.ts',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        API_PORT: 3001,
      },
      error_file: 'logs/pm2-api-error.log',
      out_file: 'logs/pm2-api-out.log',
      merge_logs: true,
      time: true,
    },
    {
      name: 'prodem-worker',
      script: 'tsx',
      args: 'src/workers/scheduler.ts',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        WORKER_HOST: 'oracle-cloud',
      },
      error_file: 'logs/pm2-worker-error.log',
      out_file: 'logs/pm2-worker-out.log',
      merge_logs: true,
      time: true,
    },
    {
      name: 'prodem-worker-live',
      script: 'tsx',
      args: 'src/workers/liveWorker.ts',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        WORKER_HOST: 'oracle-cloud',
      },
      error_file: 'logs/pm2-live-error.log',
      out_file: 'logs/pm2-live-out.log',
      merge_logs: true,
      time: true,
    },
  ],
};