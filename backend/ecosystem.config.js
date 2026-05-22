module.exports = {
  apps: [{
    name: 'influencer-app',
    script: 'dist/index.js',
    cwd: '/home/ubuntu/influencer-app/backend',
    node_args: '-r dotenv/config',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: '/home/ubuntu/.pm2/logs/influencer-app-error.log',
    out_file: '/home/ubuntu/.pm2/logs/influencer-app-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};
