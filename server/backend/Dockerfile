FROM node:20-alpine

RUN apk add --no-cache sqlite

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/
COPY public/ ./public/

EXPOSE 3001

CMD ["node", "src/index.js"]
