# EduLift - Deployment & Setup Documentation

## Table of Contents
1. [Quick Start](#quick-start)
2. [Development Environment](#development-environment)
3. [Production Deployment](#production-deployment)
4. [Docker Configuration](#docker-configuration)
5. [Database Setup](#database-setup)
6. [Environment Configuration](#environment-configuration)
7. [SSL/TLS Setup](#ssltls-setup)
8. [Monitoring & Logging](#monitoring--logging)
9. [Backup & Recovery](#backup--recovery)
10. [Troubleshooting](#troubleshooting)
11. [Performance Optimization](#performance-optimization)
12. [Security Hardening](#security-hardening)

---

## Quick Start

### Prerequisites
- Docker and Docker Compose
- Node.js 18+ (for local development)
- Git

### One-Command Setup
```bash
# Clone repository
git clone https://github.com/your-org/edulift.git
cd edulift

# Start development environment
chmod +x scripts/quick-start.sh
./scripts/quick-start.sh
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- Database: localhost:5432

---

## Development Environment

### Local Development Setup

#### 1. Clone and Install Dependencies
```bash
# Clone repository
git clone https://github.com/your-org/edulift.git
cd edulift

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

#### 2. Environment Configuration
```bash
# Backend environment
cp backend/.env.example backend/.env

# Frontend environment  
cp frontend/.env.example frontend/.env
```

#### 3. Database Setup
```bash
# Start PostgreSQL with Docker
docker compose up -d postgres redis

# Run database migrations
cd backend
npx prisma migrate dev
npx prisma db seed
```

#### 4. Start Development Servers
```bash
# Terminal 1: Backend
cd backend
npm run dev

# Terminal 2: Frontend  
cd frontend
npm run dev
```

### Development with Docker
```bash
# Start full development environment
docker compose -f docker-compose.dev.yml up

# View logs
docker compose -f docker-compose.dev.yml logs -f

# Rebuild after changes
docker compose -f docker-compose.dev.yml up --build
```

### Development Tools

#### Hot Reload Configuration
```bash
# Backend hot reload with nodemon
cd backend
npm run dev  # Uses nodemon.json configuration

# Frontend hot reload with Vite
cd frontend
npm run dev  # Vite dev server with HMR
```

#### Database Management
```bash
# Prisma Studio (Database GUI)
cd backend
npx prisma studio

# Reset database
npx prisma migrate reset

# Generate Prisma client
npx prisma generate
```

#### Testing
```bash
# Backend tests
cd backend
npm test
npm run test:watch
npm run test:coverage

# Frontend tests
cd frontend
npm test
npm run test:ui
npm run test:coverage

# E2E tests
npm run test:e2e
```

---

## Production Deployment

### Production Architecture
```
Internet → Nginx → Backend (Node.js) → PostgreSQL
                 ↘ Frontend (React)    ↗ Redis
```

### Deployment Options

#### Option 1: Docker Compose (Recommended)
```bash
# 1. Clone to production server
git clone https://github.com/your-org/edulift.git
cd edulift

# 2. Configure production environment
cp .env.production.example .env.production

# 3. Deploy with Docker Compose
docker compose -f docker-compose.prod.yml up -d

# 4. Run database migrations
docker compose -f docker-compose.prod.yml exec backend npx prisma migrate deploy
```

#### Option 2: Kubernetes Deployment
```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
kubectl apply -f k8s/nginx.yaml
kubectl apply -f k8s/ingress.yaml
```

#### Option 3: Manual Server Setup
```bash
# 1. Install dependencies
sudo apt update
sudo apt install nodejs npm postgresql postgresql-contrib redis-server nginx certbot

# 2. Setup application
git clone https://github.com/your-org/edulift.git
cd edulift

# 3. Build applications
cd backend && npm ci --only=production
cd ../frontend && npm ci && npm run build

# 4. Configure services
sudo systemctl enable postgresql redis-server nginx
sudo systemctl start postgresql redis-server nginx

# 5. Setup reverse proxy (see Nginx section)
```

### Production Environment Variables
```bash
# .env.production
NODE_ENV=production
PORT=3001

# Database
DATABASE_URL=postgresql://edulift:password@postgres:5432/edulift_prod
REDIS_URL=redis://redis:6379

# Security
JWT_ACCESS_SECRET=your-super-secret-jwt-key
JWT_REFRESH_SECRET=your-super-secret-refresh-key
BCRYPT_ROUNDS=12

# Email
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-smtp-password

# Application
FRONTEND_URL=https://app.yourdomain.com
BACKEND_URL=https://api.yourdomain.com

# SSL
SSL_CERT_PATH=/etc/letsencrypt/live/yourdomain.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/yourdomain.com/privkey.pem
```

---

## Docker Configuration

### Docker Compose Production
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
      - certbot_certs:/etc/letsencrypt:ro
    depends_on:
      - backend
      - frontend
    restart: unless-stopped

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
      target: production
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    build:
      context: ./frontend  
      dockerfile: Dockerfile
      target: production
    restart: unless-stopped

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3

  certbot:
    image: certbot/certbot
    volumes:
      - certbot_certs:/etc/letsencrypt
      - certbot_challenges:/var/www/certbot
    command: certonly --webroot --webroot-path=/var/www/certbot --email ${SSL_EMAIL} --agree-tos --no-eff-email -d ${DOMAIN}

volumes:
  postgres_data:
  redis_data:
  certbot_certs:
  certbot_challenges:
```

### Multi-Stage Dockerfiles

#### Backend Dockerfile
```dockerfile
# backend/Dockerfile
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS production
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
WORKDIR /app

# Copy production dependencies
COPY --from=base /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package.json ./

# Setup proper permissions
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node dist/health-check.js

CMD ["node", "dist/server.js"]
```

#### Frontend Dockerfile
```dockerfile
# frontend/Dockerfile
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Add non-root user
RUN addgroup -g 1001 -S nginx_group && adduser -S nginx_user -u 1001 -G nginx_group
RUN chown -R nginx_user:nginx_group /usr/share/nginx/html
RUN chown -R nginx_user:nginx_group /var/cache/nginx
RUN chown -R nginx_user:nginx_group /var/log/nginx

USER nginx_user

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## Database Setup

### PostgreSQL Configuration

#### Production Database Setup
```sql
-- Create database and user
CREATE DATABASE edulift_prod;
CREATE USER edulift WITH ENCRYPTED PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE edulift_prod TO edulift;

-- Grant schema permissions
\c edulift_prod
GRANT ALL ON SCHEMA public TO edulift;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO edulift;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO edulift;
```

#### Database Performance Tuning
```sql
-- postgresql.conf optimizations
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100
random_page_cost = 1.1
effective_io_concurrency = 200
```

#### Database Migrations
```bash
# Production migration
cd backend
npx prisma migrate deploy

# Check migration status
npx prisma migrate status

# Generate Prisma client
npx prisma generate

# Seed initial data
npx prisma db seed
```

### Redis Configuration

#### Redis Production Setup
```conf
# redis.conf
bind 127.0.0.1 ::1
protected-mode yes
port 6379
timeout 0
tcp-keepalive 300

# Memory and persistence
maxmemory 256mb
maxmemory-policy allkeys-lru
save 900 1
save 300 10
save 60 10000

# Security
requirepass your_secure_redis_password
```

---

## Environment Configuration

### Backend Environment Variables
```bash
# .env.production

# Application
NODE_ENV=production
PORT=3001
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://edulift:password@postgres:5432/edulift_prod
REDIS_URL=redis://:password@redis:6379

# Authentication
JWT_ACCESS_SECRET=your-super-secret-jwt-access-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-jwt-refresh-key-min-32-chars
JWT_ACCESS_EXPIRY=24h
JWT_REFRESH_EXPIRY=7d
BCRYPT_ROUNDS=12

# Email Service
EMAIL_SERVICE=smtp
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=true
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-smtp-password
EMAIL_FROM=EduLift <noreply@yourdomain.com>

# Application URLs
FRONTEND_URL=https://app.yourdomain.com
BACKEND_URL=https://api.yourdomain.com

# File Storage
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE=10MB

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100

# Security
CORS_ORIGIN=https://app.yourdomain.com
TRUST_PROXY=true
HELMET_ENABLED=true

# Monitoring
SENTRY_DSN=your-sentry-dsn
HEALTH_CHECK_PATH=/health
```

### Frontend Environment Variables
```bash
# .env.production

# API Configuration
VITE_API_BASE_URL=https://api.yourdomain.com/api/v1
VITE_SOCKET_URL=https://api.yourdomain.com

# Application
VITE_APP_NAME=EduLift
VITE_APP_VERSION=1.0.0
VITE_ENVIRONMENT=production

# Features
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_ERROR_REPORTING=true

# External Services
VITE_ANALYTICS_ID=your-analytics-id
VITE_SENTRY_DSN=your-frontend-sentry-dsn
```

### Environment Validation
```typescript
// backend/src/config/env.ts
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  FRONTEND_URL: z.string().url(),
  SMTP_HOST: z.string(),
  SMTP_PORT: z.coerce.number(),
  SMTP_USER: z.string().email(),
  SMTP_PASS: z.string(),
});

export const env = envSchema.parse(process.env);
```

---

## SSL/TLS Setup

### Nginx Configuration with SSL
```nginx
# nginx.conf
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/json
        application/javascript
        application/xml+rss
        application/atom+xml
        image/svg+xml;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=login:10m rate=5r/m;

    # Frontend application
    server {
        listen 80;
        server_name yourdomain.com www.yourdomain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name yourdomain.com www.yourdomain.com;

        ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
        ssl_session_timeout 1d;
        ssl_session_cache shared:SSL:50m;
        ssl_stapling on;
        ssl_stapling_verify on;

        # Modern SSL configuration
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-CHACHA20-POLY1305;
        ssl_prefer_server_ciphers off;

        location / {
            proxy_pass http://frontend:80;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Static assets caching
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
            proxy_pass http://frontend:80;
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API server
    server {
        listen 443 ssl http2;
        server_name api.yourdomain.com;

        ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

        # API rate limiting
        location /api/v1/auth/magic-link {
            limit_req zone=login burst=3 nodelay;
            proxy_pass http://backend:3001;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend:3001;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # WebSocket support
        location /socket.io/ {
            proxy_pass http://backend:3001;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

### SSL Certificate Management
```bash
# Initial certificate generation
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot --webroot-path=/var/www/certbot \
  --email admin@yourdomain.com \
  --agree-tos --no-eff-email \
  -d yourdomain.com -d www.yourdomain.com -d api.yourdomain.com

# Auto-renewal cron job
echo "0 12 * * * /usr/bin/docker compose -f /path/to/docker-compose.prod.yml run --rm certbot renew --quiet && /usr/bin/docker compose -f /path/to/docker-compose.prod.yml exec nginx nginx -s reload" | crontab -
```

---

## Monitoring & Logging

### Application Monitoring

#### Health Check Endpoints
```typescript
// backend/src/routes/health.ts
import express from 'express';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const router = express.Router();
const prisma = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL);

router.get('/health', async (req, res) => {
  const checks = {
    database: false,
    redis: false,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };

  try {
    // Database check
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch (error) {
    console.error('Database health check failed:', error);
  }

  try {
    // Redis check
    await redis.ping();
    checks.redis = true;
  } catch (error) {
    console.error('Redis health check failed:', error);
  }

  const isHealthy = checks.database && checks.redis;
  res.status(isHealthy ? 200 : 503).json(checks);
});

export default router;
```

#### Logging Configuration
```typescript
// backend/src/utils/logger.ts
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'edulift-backend' },
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

export default logger;
```

### Docker Logging
```yaml
# docker-compose.prod.yml logging configuration
services:
  backend:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  nginx:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Log Aggregation with ELK Stack
```yaml
# Optional ELK stack addition
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:7.17.0
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes:
      - elk_data:/usr/share/elasticsearch/data

  logstash:
    image: docker.elastic.co/logstash/logstash:7.17.0
    volumes:
      - ./logstash.conf:/usr/share/logstash/pipeline/logstash.conf

  kibana:
    image: docker.elastic.co/kibana/kibana:7.17.0
    ports:
      - "5601:5601"
    environment:
      ELASTICSEARCH_HOSTS: http://elasticsearch:9200
```

---

## Backup & Recovery

### Database Backup Strategy

#### Automated Backup Script
```bash
#!/bin/bash
# scripts/backup.sh

set -e

# Configuration
BACKUP_DIR="/backups"
DB_HOST="postgres"
DB_NAME="edulift_prod"
DB_USER="edulift"
RETENTION_DAYS=30

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Generate backup filename with timestamp
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/edulift_backup_$TIMESTAMP.sql"

# Create database backup
echo "Creating database backup..."
docker compose exec -T postgres pg_dump \
  -h "$DB_HOST" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-password \
  --verbose \
  --format=custom \
  --compress=9 > "$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_FILE"

# Remove old backups
echo "Cleaning up old backups..."
find "$BACKUP_DIR" -name "edulift_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

#### Backup Cron Job
```bash
# Add to crontab
0 2 * * * /path/to/edulift/scripts/backup.sh >> /var/log/edulift-backup.log 2>&1
```

### Database Recovery

#### Restore from Backup
```bash
#!/bin/bash
# scripts/restore.sh

BACKUP_FILE="$1"
DB_HOST="postgres"
DB_NAME="edulift_prod"
DB_USER="edulift"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./restore.sh <backup_file.sql.gz>"
  exit 1
fi

# Stop application
docker compose stop backend

# Extract backup if gzipped
if [[ "$BACKUP_FILE" == *.gz ]]; then
  gunzip -c "$BACKUP_FILE" > /tmp/restore.sql
  RESTORE_FILE="/tmp/restore.sql"
else
  RESTORE_FILE="$BACKUP_FILE"
fi

# Restore database
echo "Restoring database from $BACKUP_FILE..."
docker compose exec -T postgres psql \
  -h "$DB_HOST" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --quiet < "$RESTORE_FILE"

# Clean up
rm -f /tmp/restore.sql

# Start application
docker compose start backend

echo "Database restored successfully"
```

### File System Backup
```bash
#!/bin/bash
# Backup uploaded files and configuration

BACKUP_DIR="/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Create file system backup
tar -czf "$BACKUP_DIR/edulift_files_$TIMESTAMP.tar.gz" \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='logs' \
  /path/to/edulift

echo "File system backup completed"
```

---

## Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check database status
docker compose ps postgres

# View database logs
docker compose logs postgres

# Test database connection
docker compose exec postgres psql -U edulift -d edulift_prod -c "SELECT 1;"

# Reset database connection pool
docker compose restart backend
```

#### SSL Certificate Issues
```bash
# Test SSL certificate
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Renew certificate manually
docker compose run --rm certbot renew

# Check certificate expiry
openssl x509 -in /etc/letsencrypt/live/yourdomain.com/fullchain.pem -text -noout | grep "Not After"
```

#### Memory Issues
```bash
# Monitor container memory usage
docker stats

# Check system memory
free -h

# Restart containers with memory issues
docker compose restart backend postgres redis
```

#### WebSocket Connection Issues
```bash
# Test WebSocket connection
wscat -c wss://api.yourdomain.com/socket.io/?EIO=4&transport=websocket

# Check proxy configuration
curl -I -H "Upgrade: websocket" -H "Connection: Upgrade" https://api.yourdomain.com/socket.io/
```

### Debugging Commands

#### Container Debugging
```bash
# Execute shell in container
docker compose exec backend sh
docker compose exec postgres psql -U edulift -d edulift_prod

# View container logs
docker compose logs -f backend
docker compose logs --tail=100 postgres

# Check container resource usage
docker stats --no-stream

# Inspect container configuration
docker inspect edulift_backend_1
```

#### Application Debugging
```bash
# Enable debug logging
export LOG_LEVEL=debug
docker compose restart backend

# Check API health
curl https://api.yourdomain.com/health

# Test specific endpoints
curl -H "Authorization: Bearer $TOKEN" https://api.yourdomain.com/api/v1/families/current

# Monitor real-time logs
tail -f logs/combined.log | jq '.'
```

---

## Performance Optimization

### Database Optimization

#### Query Performance
```sql
-- Enable query logging
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries > 1s

-- Check slow queries
SELECT query, mean_time, calls
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;

-- Index usage
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE tablename = 'schedule_slots';
```

#### Connection Pooling
```typescript
// backend/src/config/database.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL + '?connection_limit=20&pool_timeout=20'
    }
  },
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error']
});

export default prisma;
```

### Application Performance

#### Caching Strategy
```typescript
// Redis caching implementation
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL, {
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  lazyConnect: true
});

export const cacheGet = async <T>(key: string): Promise<T | null> => {
  try {
    const cached = await redis.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('Cache get error:', error);
    return null;
  }
};

export const cacheSet = async (key: string, value: any, ttl: number = 3600): Promise<void> => {
  try {
    await redis.setex(key, ttl, JSON.stringify(value));
  } catch (error) {
    console.error('Cache set error:', error);
  }
};
```

#### Resource Optimization
```yaml
# docker-compose.prod.yml - Resource limits
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

  postgres:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 1G
```

---

## Security Hardening

### System Security

#### Docker Security
```yaml
# Security-hardened Docker configuration
services:
  backend:
    user: "1001:1001"
    read_only: true
    tmpfs:
      - /tmp
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
```

#### Network Security
```bash
# Firewall configuration (UFW)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

# Fail2ban for brute force protection
sudo apt install fail2ban
```

### Application Security

#### Rate Limiting Enhancement
```typescript
// Enhanced rate limiting
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';

const limiter = rateLimit({
  store: new RedisStore({
    client: redis,
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

// Stricter limits for auth endpoints
const authLimiter = rateLimit({
  store: new RedisStore({ client: redis }),
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
});
```

#### Security Headers
```typescript
// Helmet configuration
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

This deployment documentation provides comprehensive guidance for setting up, deploying, and maintaining EduLift in production environments with security, performance, and reliability best practices.