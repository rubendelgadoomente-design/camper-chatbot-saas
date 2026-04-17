# Dockerfile para CamperBot con Meta Cloud API
# Sin Chrome, sin Puppeteer, sin Baileys — imagen muy ligera

FROM node:18-slim

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias de producción
RUN npm ci --only=production

# Copiar código fuente
COPY . .

# Crear directorios necesarios
RUN mkdir -p data public

# Railway asigna el puerto dinámicamente via $PORT
EXPOSE ${PORT:-3001}

# Arrancar servidor Meta Cloud API
CMD ["node", "server-meta.js"]
