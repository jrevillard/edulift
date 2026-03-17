# Frontend Dockerfile
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Accept build arguments
ARG VITE_API_URL=http://localhost:3001/api/v1
ARG VITE_SOCKET_URL=http://localhost:3001
ARG VITE_SOCKET_FORCE_POLLING=false

# Set environment variables for Vite build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_SOCKET_URL=$VITE_SOCKET_URL
ENV VITE_SOCKET_FORCE_POLLING=$VITE_SOCKET_FORCE_POLLING

# Copy package files
COPY frontend/package*.json ./
COPY frontend/tsconfig*.json ./
COPY frontend/vite.config.ts ./
COPY frontend/tailwind.config.js ./
COPY frontend/postcss.config.js ./
COPY frontend/eslint.config.js ./

# Install dependencies
RUN npm ci && npm cache clean --force

# Copy source code
COPY frontend/src/ ./src/
COPY frontend/public/ ./public/
COPY frontend/index.html ./

# Copy shared types from monorepo root
COPY shared-types/ ../shared-types/

# Build the application with environment variables
RUN npm run build

# Production stage - Use nginx to serve static files
FROM nginx:alpine AS production

# Install wget for health checks
RUN apk add --no-cache wget

# Copy custom nginx configuration
COPY frontend/nginx.conf /etc/nginx/nginx.conf

# Copy entrypoint script for runtime config injection
COPY frontend/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Use custom entrypoint to inject runtime config
ENTRYPOINT ["/docker-entrypoint.sh"]