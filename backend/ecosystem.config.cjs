module.exports = {
  apps: [{
    name: 'backend',
    script: './src/server.js',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    // Load environment variables from .env file
    env_file: './.env',
    env: {
      NODE_ENV: 'production',
    },
    // Auto restart on crash
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    // Logging
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
  }]
};
