# Usa una imagen de Node con soporte para Puppeteer/Chrome
FROM ghcr.io/puppeteer/puppeteer:latest

USER root

# Crear directorio de la app
WORKDIR /usr/src/app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar el resto del código
COPY . .

# Crear directorio de datos si no existe
RUN mkdir -p data

# Exponer el puerto
EXPOSE 3001

# Comando para arrancar
CMD [ "node", "server.js" ]
