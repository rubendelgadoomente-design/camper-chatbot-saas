module.exports = {
  apps : [{
    name: 'camper-bot',
    script: 'server-meta.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '200M', // Baileys usa ~50MB, reiniciar si supera 200MB
    restart_delay: 5000, // Esperar 5s antes de reiniciar
    exp_backoff_restart_delay: 100, // Backoff exponencial en reinicios
    env: {
      NODE_ENV: 'development',
      PORT: 3001
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 10000
    }
  }]
};
