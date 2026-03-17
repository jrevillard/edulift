# Backend Dockerfile - Modern ESM with tsx bundler
FROM node:18-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache dumb-init wget openssl

# Set working directory
WORKDIR /app

# Copy package files
COPY backend/package*.json ./

# Install dependencies (tsx is needed for runtime)
RUN npm ci && npm cache clean --force

# Copy source code, prisma, and scripts
COPY backend/src/ ./src/
COPY backend/prisma/ ./prisma/
COPY backend/scripts/ ./scripts/
COPY backend/tsconfig.json ./
COPY backend/package*.json ./

# Install dependencies
RUN npm ci && npm cache clean --force

# Copy shared types from monorepo root
COPY shared-types/ ../shared-types/

# Copy assets (logo for emails)
COPY backend/assets/ ./assets/

# Fix ownership for node user
RUN chown -R node:node /app/src

# Generate Prisma client
RUN npx prisma generate

# Create uploads directory and copy OpenAPI docs
RUN mkdir -p uploads docs/openapi && chown node:node uploads docs/openapi
COPY backend/docs/openapi/swagger.json ./docs/openapi/

COPY backend/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Switch to non-root user
USER node

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start the application
ENTRYPOINT ["dumb-init", "--"]
CMD ["/app/entrypoint.sh"]
