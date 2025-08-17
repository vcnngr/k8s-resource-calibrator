# backend/Dockerfile
FROM node:18-alpine AS base

WORKDIR /app

# Installa dipendenze di sistema per kubectl
RUN apk add --no-cache curl bash

# Installa kubectl
RUN curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" \
    && chmod +x kubectl \
    && mv kubectl /usr/local/bin/

# Copia package files
COPY package*.json ./

# Installa dipendenze
RUN npm install --omit=dev && npm cache clean --force

# Development stage
FROM base AS development
RUN npm install
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev"]

# Production stage
FROM base AS production
COPY . .
RUN chown -R node:node /app
USER node
EXPOSE 3001
CMD ["npm", "start"]