# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Cache bust marker - force rebuild on change
# BUILD_TIMESTAMP: 1742130600

COPY . .
RUN npx prisma generate
RUN npx tsc --skipLibCheck || true

# Stage 2: Production
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY entrypoint.sh ./entrypoint.sh

RUN chmod +x entrypoint.sh && \
    apk add --no-cache postgresql-client openssl1.1-compat && \
    mkdir -p uploads logs

EXPOSE 3000

ENTRYPOINT ["sh", "entrypoint.sh"]
