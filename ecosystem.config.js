/**
 * PM2 — Oracle Cloud Always Free
 * Procesos: API Express + Worker scheduler (live 30s, fixtures, knockout)
 */
module.exports = {
  apps: [
    {
      name: 'prodem-api',
      script: 'tsx',
      args: 'server/index.ts',
      instances: 1,
      autorestart: true,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        API_PORT: 3001,
      },
    },
    {
      name: 'prodem-worker',
      script: 'tsx',
      args: 'src/workers/scheduler.ts',
      instances: 1,
      autorestart: true,
      max_memory_restart: '400M',
      env: {
        NODE_ENV: 'production',
        WORKER_HOST: 'oracle-cloud',
      },
    },
  ],
};
