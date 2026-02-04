FROM node:24-slim AS base

# Runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl ca-certificates gnupg wget lsb-release curl \
    && rm -rf /var/lib/apt/lists/*

# Add PostgreSQL 16 client
RUN echo "deb http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list \
    && wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | gpg --dearmor -o /etc/apt/trusted.gpg.d/postgresql.gpg \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client-16 \
    && rm -rf /var/lib/apt/lists/*

# Add Docker CLI
RUN install -m 0755 -d /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
    && chmod a+r /etc/apt/keyrings/docker.asc \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian bookworm stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin \
    && rm -rf /var/lib/apt/lists/*

# ============ BUILD STAGE ============
FROM base AS builder
WORKDIR /app

# Install build dependencies for native modules (node-pty)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential python3 \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install all dependencies (including dev)
RUN npm ci --include=dev

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript to JavaScript
RUN npm run build

# ============ PRODUCTION STAGE ============
FROM base AS runner
WORKDIR /app

# Create non-root user for security
RUN groupadd --system --gid 1001 nodejs && \
    useradd --system --uid 1001 --gid nodejs fastify

ENV NODE_ENV=production
ENV NPM_CONFIG_UPDATE_NOTIFIER=false

# Copy compiled code and production dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./

# Regenerate Prisma client for this architecture
RUN npx prisma generate

# Note: Cannot run as non-root because node-pty and Docker socket require root access
# TODO: Implement proper rootless Docker setup for full security

EXPOSE 3001

# Run pre-compiled JavaScript (faster startup, lower memory)
CMD ["node", "dist/server.js"]
