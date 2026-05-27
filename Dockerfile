# ==========================================
# PRODUCTION-GRADE MULTI-STAGE DOCKERFILE
# ==========================================

# ── Stage 1: Build Base ────────────────────
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY package*.json ./
COPY apps/server/package*.json ./apps/server/
COPY apps/web/package*.json ./apps/web/
RUN npm install --ignore-scripts

# ── Stage 2: Prisma & Build Server ────────
FROM base AS builder
COPY . .
# Generate local Prisma Client
WORKDIR /app/apps/server
RUN npx prisma generate
# Compile TypeScript backends & frontends
WORKDIR /app
RUN npm run build --workspaces

# ── Stage 3: Runner Server ────────────────
FROM node:20-alpine AS server-runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/apps/server/package*.json ./apps/server/
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/prisma ./apps/server/prisma
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 5000
CMD ["node", "apps/server/dist/index.js"]
