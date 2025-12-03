import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { prisma } from './config/database';
import { sendSuccessResponse, sendErrorResponse } from './utils/responseValidation';
import { SimpleSuccessResponseSchema } from './schemas/responses';
import groupsRouter from './routes/groups';
import authRouter from './routes/auth';
import childrenRouter from './routes/children';
import vehiclesRouter from './routes/vehicles';
import scheduleSlotsRouter from './routes/scheduleSlots';
import dashboardRouter from './routes/dashboard';
import familiesRouter from './routes/families';
import invitationsRouter from './routes/invitations';
import fcmTokensRouter from './routes/fcmTokens';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const db = prisma;

// Environment detection and URL configuration for Swagger UI
const getServerUrl = (): string => {
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Priority 1: Explicit Swagger base URL override
  if (process.env.SWAGGER_BASE_URL) {
    return process.env.SWAGGER_BASE_URL;
  }

  // Priority 2: Reverse proxy URL
  if (process.env.REVERSE_PROXY_URL) {
    return process.env.REVERSE_PROXY_URL;
  }

  // Priority 3: Frontend URL (for production behind reverse proxy)
  if (process.env.FRONTEND_URL && nodeEnv === 'production') {
    const url = new URL(process.env.FRONTEND_URL);
    return `${url.protocol}//${url.host}`;
  }

  // Priority 4: Custom Swagger host and port (standardized variables)
  const swaggerHost = process.env.SWAGGER_HOST || 'localhost';
  const swaggerPort = process.env.SWAGGER_PORT || process.env.PORT || '3001';

  // Determine protocol based on environment and port
  let protocol = 'http';
  if (nodeEnv === 'production' || parseInt(swaggerPort) === 443) {
    protocol = 'https';
  }

  return `${protocol}://${swaggerHost}:${swaggerPort}`;
};

const getEnvironmentDescription = (): string => {
  const nodeEnv = process.env.NODE_ENV || 'development';

  if (process.env.SWAGGER_BASE_URL) {
    return `${nodeEnv} (custom base URL)`;
  }

  if (process.env.REVERSE_PROXY_URL) {
    return `${nodeEnv} (behind reverse proxy)`;
  }

  return nodeEnv;
};

// Security middleware
app.use(helmet());

// Simple rate limiting to prevent flooding
const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED !== 'false'; // Default: enabled
const rateLimitStore = new Map();
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// Periodically clean up stale entries to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, clientData] of rateLimitStore.entries()) {
    if (now > clientData.resetTime) {
      rateLimitStore.delete(ip);
    }
  }
}, RATE_LIMIT_CLEANUP_INTERVAL_MS);

if (rateLimitEnabled) {
  app.use((req: express.Request, res: express.Response, next: express.NextFunction): void => {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000'); // Default: 1 minute
    const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '300'); // Default: 300 requests per window

    if (!rateLimitStore.has(ip)) {
      rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    const clientData = rateLimitStore.get(ip);

    if (now > clientData.resetTime) {
      clientData.count = 1;
      clientData.resetTime = now + windowMs;
      return next();
    }

    if (clientData.count >= maxRequests) {
      logger.warn(`Rate limit exceeded for IP: ${ip}`, {
        count: clientData.count,
        max: maxRequests,
        window: `${windowMs}ms`,
      });
      sendErrorResponse(res, 429, 'Too many requests, please try again later');
      return;
    }

    clientData.count++;
    next();
  });
} else {
  logger.info('Rate limiting disabled via RATE_LIMIT_ENABLED=false');
}

app.use(
  cors({
    origin: process.env.CORS_ORIGIN === '*'
      ? '*'
      : process.env.CORS_ORIGIN?.split(',').map(origin => origin.trim()),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'API-Version', 'api-version'],
  }),
);

// HTTP request logging (independent from NODE_ENV)
// Use HTTP_LOG_FORMAT if set, otherwise default based on NODE_ENV
const httpLogFormat = process.env.HTTP_LOG_FORMAT ||
  (process.env.NODE_ENV === 'production' ? 'combined' : 'dev');
app.use(morgan(httpLogFormat));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_, res) => {
  sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// Database health check
app.get('/api/health/database', async (_, res) => {
  try {
    // Simple database query to verify connection
    await db.user.findFirst();
    sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, {
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch {
    sendErrorResponse(res, 500, 'Database connection failed');
  }
});


// API routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/children', childrenRouter);
app.use('/api/v1/vehicles', vehiclesRouter);
app.use('/api/v1/groups', groupsRouter);
app.use('/api/v1/families', familiesRouter);
app.use('/api/v1/dashboard', dashboardRouter);
app.use('/api/v1/invitations', invitationsRouter);
app.use('/api/v1/fcm-tokens', fcmTokensRouter);
app.use('/api/v1/schedule-slots', scheduleSlotsRouter);

// API root endpoint - provides basic API information
app.get('/api/v1', (_, res) => {
  // Read version from package.json to avoid hardcoded version
  const packageJson = JSON.parse(readFileSync(join(__dirname, '../package.json'), 'utf8'));

  sendSuccessResponse(res, 200, SimpleSuccessResponseSchema, {
    message: 'EduLift API v1',
    version: packageJson.version,
    status: 'active',
    timestamp: new Date().toISOString(),
    endpoints: {
      auth: '/api/v1/auth',
      children: '/api/v1/children',
      vehicles: '/api/v1/vehicles',
      groups: '/api/v1/groups',
      families: '/api/v1/families',
      dashboard: '/api/v1/dashboard',
      invitations: '/api/v1/invitations',
      fcmTokens: '/api/v1/fcm-tokens',
      scheduleSlots: '/api/v1/schedule-slots',
    },
    documentation: '/api-docs',
    healthChecks: {
      basic: '/health',
      database: '/api/health/database',
    },
  });
});

// Swagger UI - Only enable in dev by default or with SWAGGER_ENABLED=true
const swaggerEnabled =
  process.env.NODE_ENV !== 'production' || process.env.SWAGGER_ENABLED === 'true';

if (swaggerEnabled) {
  try {
    // Load the generated swagger.json file
    const swaggerDocumentPath = join(__dirname, '../docs/openapi/swagger.json');
    const swaggerDocument = JSON.parse(readFileSync(swaggerDocumentPath, 'utf8'));

    // Custom CSS for better UI
    const customCss = `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info .title { font-size: 2em; }
      .swagger-ui .scheme-container { background-color: #f7f7f7; padding: 20px; }
    `;

    // Get the current server URL for Swagger UI
    const currentServerUrl = getServerUrl();

    app.use(
      '/api-docs',
      swaggerUi.serve,
      swaggerUi.setup(swaggerDocument, {
        customSiteTitle: 'EduLift API Documentation',
        customCss,
        customfavIcon: '/favicon.ico',
        swaggerOptions: {
          persistAuthorization: true, // Persist authorization data
          displayRequestDuration: true, // Show request duration
          filter: true, // Enable filtering
          tryItOutEnabled: true, // Enable "Try it out" by default
          // Use servers array instead of urls for proper OpenAPI 3.1 support
        },
      }),
    );

    logger.info('Swagger UI enabled at /api-docs', {
      context: 'swagger',
      environment: process.env.NODE_ENV || 'development',
      serverUrl: currentServerUrl,
      environmentDescription: getEnvironmentDescription(),
    });
  } catch (error) {
    logger.warn('Failed to load Swagger documentation - run "npm run swagger:generate" first', {
      context: 'swagger',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
} else {
  logger.info('Swagger UI disabled in production (set SWAGGER_ENABLED=true to enable)', {
    context: 'swagger',
  });
}

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;

