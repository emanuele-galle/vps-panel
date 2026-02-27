FROM node:24-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including sharp for image optimization)
RUN npm ci --legacy-peer-deps

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build arguments for Next.js public env vars (compiled at build time)
ARG NEXT_PUBLIC_API_URL=http://localhost:3001/api
ARG NEXT_PUBLIC_WS_URL=ws://localhost:3001
ARG NEXT_PUBLIC_FILEBROWSER_USERNAME=admin
ARG NEXT_PUBLIC_FILEBROWSER_PASSWORD=
ARG NEXT_PUBLIC_PANEL_DOMAIN=localhost
ARG NEXT_PUBLIC_SMTP_USER=
ARG NEXT_PUBLIC_SMTP_PASSWORD=

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_FILEBROWSER_USERNAME=$NEXT_PUBLIC_FILEBROWSER_USERNAME
ENV NEXT_PUBLIC_FILEBROWSER_PASSWORD=$NEXT_PUBLIC_FILEBROWSER_PASSWORD
ENV NEXT_PUBLIC_PANEL_DOMAIN=$NEXT_PUBLIC_PANEL_DOMAIN
ENV NEXT_PUBLIC_SMTP_USER=$NEXT_PUBLIC_SMTP_USER
ENV NEXT_PUBLIC_SMTP_PASSWORD=$NEXT_PUBLIC_SMTP_PASSWORD

# Build Next.js
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

# Create app user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy sharp binaries from builder (avoids npm install in runner = no npm cache bloat)
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/sharp ./node_modules/sharp
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@img ./node_modules/@img

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
