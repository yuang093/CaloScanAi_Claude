# CaloScanAi Dockerfile
FROM node:20

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --ignore-scripts && npm cache clean --force

# Copy source
COPY . .

# Create non-root user
RUN groupadd -g 1001 -r nodejs && \
    useradd -r -u 1001 -g nodejs nodejs && \
    chown -R nodejs:nodejs /app

USER nodejs

ENV NODE_ENV=production
ENV PORT=3000
ENV TZ=Asia/Taipei

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "src/server/index.js"]