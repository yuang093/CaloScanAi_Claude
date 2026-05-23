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