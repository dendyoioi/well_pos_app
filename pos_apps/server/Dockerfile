# ==========================================
# STAGE 1: Build & Compile TypeScript
# ==========================================
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache openssl

# Salin manifest dependensi dan schema Prisma
COPY package*.json ./
COPY prisma ./prisma/

# Install seluruh dependensi dan generate Prisma Client
RUN npm ci
RUN npx prisma generate

# Salin seluruh source code & compile ke JS
COPY tsconfig.json ./
COPY src ./src/
RUN npm run build

# ==========================================
# STAGE 2: Production Lightweight Runtime
# ==========================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5001

RUN apk add --no-cache openssl

# Salin manifest dan install hanya production dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Salin Prisma Schema dan Generated Client dari builder stage
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Salin artefak kompilasi TypeScript
COPY --from=builder /app/dist ./dist

# Keamanan: Gunakan non-root user bawaan node
USER node

EXPOSE 5001

CMD ["node", "dist/index.js"]
