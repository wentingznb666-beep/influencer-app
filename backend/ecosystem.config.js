module.exports = {
  apps: [{
    name: 'influencer-app',
    script: 'dist/index.js',
    cwd: '/home/ubuntu/influencer-app/backend',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_file: '.env',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: '/home/ubuntu/.pm2/logs/influencer-app-error.log',
    out_file: '/home/ubuntu/.pm2/logs/influencer-app-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
