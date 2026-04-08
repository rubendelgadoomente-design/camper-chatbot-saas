#!/bin/bash

# Script de configuración automática para CamperBot en VPS Ubuntu
# Uso: curl ... | bash -s -- <OPENAI_KEY> <SUPABASE_URL> <SUPABASE_KEY>

OPENAI_KEY=$1
SUPABASE_URL=$2
SUPABASE_KEY=$3

echo "🚀 Iniciando instalación profesional de CamperBot..."

# 1. Actualizar sistema e instalar básicos
apt-get update && apt-get install -y curl git-core gnupg

# 2. Instalar Node.js v20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 3. Instalar PM2 (Gestor de procesos)
npm install -g pm2

# 4. Instalar Chrome y dependencias para Puppeteer
wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add -
echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google.list
apt-get update && apt-get install -y google-chrome-stable

# 5. Clonar repositorio
mkdir -p /app
cd /app
git clone https://github.com/rubendelgadoomente-design/camper-chatbot-saas.git .

# 6. Crear archivo .env
cat <<EOT > .env
OPENAI_API_KEY=$OPENAI_KEY
SUPABASE_URL=$SUPABASE_URL
SUPABASE_KEY=$SUPABASE_KEY
PORT=3001
PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable
EOT

# 7. Instalar dependencias del bot
npm install

# 8. Iniciar bot con PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

echo "✅ ¡Instalación completada!"
echo "Accede a http://$(curl -s ifconfig.me):3001/monitor para escanear el QR."
