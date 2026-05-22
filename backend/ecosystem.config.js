const fs = require('fs');
const path = require('path');

// 读取 .env 文件
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};

// 解析 .env 文件
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    env[match[1].trim()] = match[2].trim();
  }
});

module.exports = {
  apps: [{
    name: 'influencer-app',
    script: 'dist/index.js',
    cwd: '/home/ubuntu/influencer-app/backend',
    env: {
      ...env,
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
