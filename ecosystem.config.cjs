module.exports = {
  apps: [
    {
      name: 'raysync',
      script: 'node_modules/.bin/tsx',
      args: 'src/index.ts',
      cwd: '/opt/raysync/server',
      interpreter: 'none',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3030,
      },
      error_file: '/var/log/raysync/error.log',
      out_file: '/var/log/raysync/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
