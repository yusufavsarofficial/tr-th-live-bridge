FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm ci --only=production
COPY . .

# Switch to PostgreSQL schema and generate Prisma client
ENV DB_PROVIDER=postgresql
RUN node scripts/setup-prisma.js

FROM node:20-alpine
WORKDIR /app
ENV DB_PROVIDER=postgresql
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/server.js ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/prisma.config.ts ./

EXPOSE ${PORT:-3000}

# Sync the fresh Render PostgreSQL database and start
CMD ["sh", "-c", "npx prisma db push && node server.js"]
