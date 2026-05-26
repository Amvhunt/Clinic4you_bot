FROM node:20-slim

# Install build dependencies
RUN apk add --no-cache python3 make g++

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

# Copy source code
COPY . .

# Build all packages
RUN npm run db:generate --workspace=@bot/database
RUN npm run build

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

CMD ["npm", "start", "--workspace=core-bot"]
