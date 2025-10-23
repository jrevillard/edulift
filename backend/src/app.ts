import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { PrismaClient } from '@prisma/client';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import groupsRouter from './routes/groups';
import authRouter from './routes/auth';
import childrenRouter from './routes/children';
import vehiclesRouter from './routes/vehicles';
import scheduleSlotsRouter from './routes/scheduleSlots';
import dashboardRouter from './routes/dashboard';
import familiesRouter from './routes/families';
import invitationsRouter from './routes/invitations';
import fcmTokensRouter from './routes/fcmTokens';

const app = express();
const db = new PrismaClient();

// Security middleware
app.use(helmet());

// Simple rate limiting to prevent flooding
const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED !== 'false'; // Default: enabled
const rateLimitStore = new Map();

if (rateLimitEnabled) {
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
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
      return res.status(429).json({
        success: false,
        error: 'Too many requests, please try again later',
      });
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

// Logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_, res) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    },
  });
});

// Database health check
app.get('/api/health/database', async (_, res) => {
  try {
    // Simple database query to verify connection
    await db.user.findFirst();
    res.status(200).json({
      success: true,
      data: {
        status: 'healthy',
        database: 'connected',
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Database connection failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
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
app.use('/api/v1', scheduleSlotsRouter);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
