module.exports = {
  apps: [{
    name: 'aqar',
    script: 'server.js',
    cwd: '/var/www/aqar.codenextai.com/aqar',
    instances: 3,
    exec_mode: 'cluster',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3002
    }
  }]
};
