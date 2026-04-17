# Dockerfile para CamperBot con Meta Cloud API
FROM node:18-slim
WORKDIR /app
COPY package*.json ./
# Cambiamos npm ci por npm install para mayor flexibilidad
RUN npm install --only=production
COPY . .
RUN mkdir -p data public
EXPOSE ${PORT:-3001}
CMD ["node", "server-meta.js"]