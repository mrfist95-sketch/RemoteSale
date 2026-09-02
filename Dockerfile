FROM node:20-alpine

WORKDIR /app

# Install dependencies based on lockfile
COPY package.json package-lock.json ./
RUN npm ci

# Copy the rest of the app
COPY . .

# Generate Prisma client and build the Next.js app
RUN npx prisma generate
RUN npm run build

# Прогон юнит-тестов (не требуют БД)
RUN npm test

RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
