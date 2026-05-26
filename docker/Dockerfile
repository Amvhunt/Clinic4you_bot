FROM node:20-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

COPY apps/bot/package.json ./apps/bot/
COPY modules/ai/package.json ./modules/ai/
COPY modules/mailing/package.json ./modules/mailing/
COPY modules/notifications/package.json ./modules/notifications/
COPY modules/altegio/package.json ./modules/altegio/
COPY modules/validation/package.json ./modules/validation/
COPY database/package.json ./database/
COPY shared/package.json ./shared/

# Install dependencies
RUN npm install

# Copy source
COPY . .

# Prisma generate
RUN npm run db:generate --workspace=@bot/database

# Build project
RUN npm run build

EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start app
CMD ["npm", "start", "--workspace=core-bot"]