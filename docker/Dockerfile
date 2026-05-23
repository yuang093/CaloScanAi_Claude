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

USER nodejs

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start application - fix permissions for mounted volumes at runtime
CMD ["sh", "-c", "chown -R nodejs:nodejs /app/data /app/uploads 2>/dev/null || true; node src/server/index.js"]