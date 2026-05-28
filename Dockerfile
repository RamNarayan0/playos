# Standardized Multi-Stage Dockerfile for PLAYOS Enterprise Production Server
FROM node:20-alpine AS base

# Install necessary OS dependencies for node-gyp and native bindings if needed
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variables for compilation build step
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

# Execute Next.js asset optimization build compilation
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy bundled standalone artifacts and raw dependencies needed for runtime Custom Socket.IO Server
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/server.js ./server.js
COPY --from=builder /app/src ./src

USER nextjs

EXPOSE 3000

# Start custom Socket.IO web application server adapter
CMD ["node", "server.js"]
