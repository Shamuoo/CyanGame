FROM node:20-alpine
RUN apk add --no-cache sqlite
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY src/ ./src/
COPY public/ ./public/ 2>/dev/null || true
EXPOSE 3001
CMD ["node", "src/index.js"]
