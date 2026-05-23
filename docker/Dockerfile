# CaloScanAi Dockerfile
# Multi-stage build for smaller production image

# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies first for better caching
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy source
COPY . .

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --ignore-scripts --only=production && npm cache clean --force

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy application files
COPY --from=builder /app ./

# Create directories for data and uploads
RUN mkdir -p /app/data /app/uploads && chown -R nodejs:nodejs /app

# Entrypoint script to fix permissions for mounted volumes
COPY <<EOF /entrypoint.sh
#!/bin/sh
set -e

# Fix permissions for mounted volumes (in case host directories are created as root)
if [ -d "/app/data" ]; then
    chown -R nodejs:nodejs /app/data 2>/dev/null || true
fi
if [ -d "/app/uploads" ]; then
    chown -R nodejs:nodejs /app/uploads 2>/dev/null || true
fi

exec "$@"
EOF

RUN chmod +x /entrypoint.sh && sed -i 's/\r$//' /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
USER nodejs

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start application
CMD ["node", "src/server/index.js"]