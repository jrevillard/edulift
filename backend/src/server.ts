#!/usr/bin/env node

/**
 * EduLift Backend Server - State-of-the-Art Hono Implementation
 *
 * Zero Manual Configuration • Auto-OpenAPI • Modern TypeScript
 *
 * Features:
 * - Hono-native OpenAPI generation (no scripts required)
 * - Auto-discovery of schemas and routes
 * - Built-in Swagger UI
 * - Modern ES modules with TSX
 */

import 'dotenv/config';

// Import console override FIRST to ensure ALL console calls respect LOG_LEVEL
import './utils/consoleOverride';

import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import { AppError } from './middleware/errorHandler';
import { createErrorResponse, getErrorForLogging, ErrorCodes } from './utils/errorHandler';
import {
  globalRateLimiter,
  authEndpointRateLimiter,
  adminRateLimiter
} from './utils/rateLimiter';
import { prisma } from './database';

// Import all route modules (auto-registers OpenAPI)
// API v1 routes - organized in v1/ directory for future multi-versioning support
import authRoutes from './routes/v1/auth';
import vehiclesRoutes from './routes/v1/vehicles';
import childrenRoutes from './routes/v1/children';
import familiesRoutes from './routes/v1/families';
import groupsRoutes from './routes/v1/groups';
import invitationsRoutes from './routes/v1/invitations';
import fcmTokensRoutes from './routes/v1/fcmTokens';
import dashboardRoutes from './routes/v1/dashboard';
import scheduleSlotsRoutes from './routes/v1/scheduleSlots';

// Environment configuration
const port = parseInt(process.env.PORT || '3000');
const host = process.env.HOST || '0.0.0.0';
const env = process.env.NODE_ENV || 'development';

// Create main Hono application with OpenAPI support
const app = new OpenAPIHono({
  strict: false,
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json(
        {
          success: false,
          error: 'Validation failed',
          details: result.error.issues,
        },
        400
      );
    }
    // Return undefined to continue processing when validation succeeds
    return undefined;
  },
});

// Global middleware
app.use('*', cors({
  origin: env === 'production'
    ? ['https://app.familytracker.com', 'https://familytracker.com']
    : ['http://localhost:3000', 'http://localhost:5173'],
  credentials: true,
}));

app.use('*', logger());

// Apply rate limiting to all API routes
app.use('/api/v1/*', globalRateLimiter);

// Apply stricter rate limiting to authentication endpoints
app.use('/api/v1/auth/*', authEndpointRateLimiter);

// Apply admin rate limiting to admin operations (if they exist)
app.use('/api/v1/admin/*', adminRateLimiter);

// Health check endpoint (always available)
app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: env,
  });
});

// Database health check
app.get('/health/database', async (c) => {
  const startTime = Date.now();

  try {
    // Perform a lightweight database query to test connectivity
    // Using $queryRaw with SELECT 1 is the most efficient way to test connection
    await prisma.$queryRaw`SELECT 1`;

    const latency = Date.now() - startTime;

    return c.json({
      status: 'healthy',
      database: 'connected',
      latency: `${latency}ms`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const latency = Date.now() - startTime;

    // Use our professional error handling system
    const errorResponse = createErrorResponse(error);

    // Add health check specific context
    return c.json({
      status: 'unhealthy',
      database: 'disconnected',
      latency: `${latency}ms`,
      error: 'Database connection failed',
      code: ErrorCodes.DATABASE_ERROR,
      details: errorResponse.details,
      timestamp: new Date().toISOString(),
    }, 503); // Service Unavailable is more appropriate for database issues
  }
});

// Mount all routers with /api/v1 prefix for proper API versioning
app.route('/api/v1/auth', authRoutes);
app.route('/api/v1/vehicles', vehiclesRoutes);
app.route('/api/v1/children', childrenRoutes);
app.route('/api/v1/families', familiesRoutes);
app.route('/api/v1/groups', groupsRoutes);
app.route('/api/v1/invitations', invitationsRoutes);
app.route('/api/v1/fcm-tokens', fcmTokensRoutes);
app.route('/api/v1/dashboard', dashboardRoutes);
// Schedule slots uses absolute paths, so mount at root to avoid double nesting
app.route('/api/v1', scheduleSlotsRoutes);

/**
 * State-of-the-Art OpenAPI Configuration - Zero Manual Setup!
 *
 * Uses Hono's built-in OpenAPI generation with auto-discovery.
 * Similar to Java Spring Boot - no manual scripts required!
 */
const openApiConfig = {
  openapi: '3.1.0',
  info: {
    version: '1.0.0',
    title: 'EduLift API',
    description: `
## 🚀 State-of-the-Art Collaborative School Transportation API

### ✨ Key Features
- **Family System**: Manage families, children, and vehicles
- **Group System**: Coordinate carpools and schedules
- **Invitation System**: Secure family and group invitations
- **Real-time Updates**: WebSocket integration for live updates
- **Push Notifications**: FCM token management

### 🔐 Authentication
JWT Bearer tokens for all protected endpoints:
\`\`\`
Authorization: Bearer <your-jwt-token>
\`\`\`

### 📋 Standardized Responses
Success responses return data directly:
\`\`\`json
{
  "id": "user_123",
  "email": "user@example.com",
  "name": "John Doe"
}
\`\`\`

Error responses include validation details:
\`\`\`json
{
  "success": false,
  "error": "Validation failed",
  "details": [...]
}
\`\`\`

### 🚦 Performance & Security
- **Rate limiting** on all endpoints (100 req/min for anonymous, 300 req/min for authenticated)
- **Stricter limits** on auth endpoints (20 req/min) to prevent brute force attacks
- **Admin endpoints** have reduced limits (50 req/min) for security
- **CORS** configured for production
- **Structured logging** with rate limit monitoring
      `,
    contact: {
      name: 'EduLift API Team',
      email: 'api@edulift.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: env === 'production' ? 'https://api.edulift.com/api/v1' : `http://localhost:${port}/api/v1`,
      description: env === 'production' ? 'Production server' : 'Development server',
    },
  ],
  tags: [
    { name: 'Authentication', description: 'JWT authentication and user management' },
    { name: 'Vehicles', description: 'Vehicle management and assignment' },
    { name: 'Children', description: 'Children profiles and management' },
    { name: 'Families', description: 'Family management and member roles' },
    { name: 'Groups', description: 'Group coordination and scheduling' },
    { name: 'Invitations', description: 'Family and group invitation system' },
    { name: 'FCM Tokens', description: 'Push notification token management' },
    { name: 'Dashboard', description: 'User dashboard and analytics' },
    { name: 'Schedule Slots', description: 'Scheduling and time management' },
  ],
  components: {
    securitySchemes: {
      Bearer: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
  },
};

// Add OpenAPI documentation endpoint (Hono-native)
app.doc('/openapi.json', openApiConfig);

// Add Swagger UI
app.get('/docs', swaggerUI({
  url: '/openapi.json',
  defaultModelsExpandDepth: 2,
  defaultModelExpandDepth: 2,
  displayRequestDuration: true,
  docExpansion: 'list',
}));

// API documentation info endpoint
app.get('/docs/info', (c) => {
  return c.json({
    title: '🚀 EduLift API - State-of-the-Art Implementation',
    version: '1.0.0',
    environment: env,
    features: [
      '✅ Zero Manual OpenAPI Configuration',
      '✅ Auto-discovery from Hono Routes',
      '✅ Built-in Swagger UI',
      '✅ TypeScript Type Safety',
      '✅ Zod Validation',
      '✅ Modern ES Modules',
    ],
    documentation: {
      swagger_ui: '/docs',
      openapi_spec: '/openapi.json',
    },
    architecture: {
      framework: 'Hono',
      runtime: 'Node.js',
      typescript: '✅',
      openapi: '3.1.0',
    },
  });
});

/**
 * Command-line interface for OpenAPI generation
 * Usage: npm run swagger:generate
 */
async function handleCLI() {
  const args = process.argv.slice(2);

  if (args.includes('--generate-openapi')) {
    console.log('🚀 Generating State-of-the-Art OpenAPI...');

    // Write to file
    const { writeFileSync, mkdirSync, existsSync } = await import('fs');
    const { join } = await import('path');

    const docsDir = join(process.cwd(), 'docs/openapi');
    if (!existsSync(docsDir)) {
      mkdirSync(docsDir, { recursive: true });
    }

    // Generate OpenAPI spec from the app (Hono's built-in method)
    const openApiSpec = app.getOpenAPIDocument(openApiConfig);
    // Merge with our configuration to include info, servers, tags, etc.
    const fullSpec = {
      ...openApiConfig,
      ...openApiSpec,
      // Ensure components are properly merged
      components: {
        ...openApiConfig.components,
        ...openApiSpec.components,
      },
    };
    const outputPath = join(docsDir, 'swagger.json');
    writeFileSync(outputPath, JSON.stringify(fullSpec, null, 2));

    console.log('✅ OpenAPI documentation generated!');
    console.log(`📄 Saved to: ${outputPath}`);
    console.log(`🌐 Available at: http://localhost:${port}/docs`);

    // Exit after generation
    process.exit(0);
  }
}

// Handle CLI commands
await handleCLI();

// Global error handler with enhanced error processing
app.onError((err, c) => {
  console.error('❌ Unhandled error:', err);

  // Type definition for valid HTTP status codes in error responses
  type ErrorStatusCode = 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503;

  // Check if it's an AppError with custom status code
  if (err instanceof AppError) {
    const statusCode = (err.statusCode || 500) as ErrorStatusCode;
    if (process.env.NODE_ENV === 'development') {
      return c.json({
        success: false,
        error: err.message,
        stack: err.stack,
      }, statusCode);
    }
    return c.json({
      success: false,
      error: err.message,
    }, statusCode);
  }

  // For other errors, use our enhanced error handling
  const errorForLogging = getErrorForLogging(err);
  const statusCode = (errorForLogging.statusCode || 500) as ErrorStatusCode;

  if (process.env.NODE_ENV === 'development') {
    // Include stack trace in development
    return c.json({
      success: false,
      error: errorForLogging.message,
      code: errorForLogging.code,
      stack: err.stack,
      debugInfo: errorForLogging,
    }, statusCode);
  }

  return c.json({
    success: false,
    error: errorForLogging.message,
    code: errorForLogging.code,
  }, statusCode);
});

// 404 handler
app.notFound((c) => {
  return c.json({
    success: false,
    error: 'Endpoint not found',
    available_endpoints: [
      '/health',
      '/health/database',
      '/docs',
      '/openapi.json',
      '/api/v1/auth/*',
      '/api/v1/vehicles/*',
      '/api/v1/children/*',
      '/api/v1/families/*',
      '/api/v1/groups/*',
      '/api/v1/invitations/*',
      '/api/v1/fcm-tokens/*',
      '/api/v1/dashboard/*',
      '/api/v1/schedule-slots/*',
    ],
    documentation: '/docs',
  }, 404);
});

// Start server
console.log(`🚀 EduLift API Server - State-of-the-Art Implementation`);
console.log(`📍 Environment: ${env}`);
console.log(`🌐 Server: http://${host}:${port}`);
console.log(`📚 API Documentation: http://${host}:${port}/docs`);
console.log(`📋 OpenAPI Spec: http://${host}:${port}/openapi.json`);

serve({
  fetch: app.fetch,
  port,
  hostname: host,
});

console.log(`✅ Server ready on http://${host}:${port}`);
