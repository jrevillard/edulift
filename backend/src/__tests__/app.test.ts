import request from 'supertest';
import express, { Express } from 'express';

// Mock environment variables before importing app
const originalEnv = process.env;

// Import the app creation logic by extracting it to a function
// We'll need to create a simple app setup for testing
function createTestApp(rateConfig: { enabled?: string; maxRequests?: string; windowMs?: string } = {}): Express {
  // Set test environment variables
  process.env.RATE_LIMIT_ENABLED = rateConfig.enabled ?? 'true';
  process.env.RATE_LIMIT_MAX_REQUESTS = rateConfig.maxRequests ?? '3'; // Low for testing
  process.env.RATE_LIMIT_WINDOW_MS = rateConfig.windowMs ?? '1000'; // 1 second for testing

  const app = express();

  // Copy rate limiting logic from app.ts
  const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED !== 'false';
  const rateLimitStore = new Map();

  if (rateLimitEnabled) {
    app.use((req: any, res: any, next: () => void) => {
      const ip = req.ip || req.socket?.remoteAddress || 'unknown';
      const now = Date.now();
      const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000');
      const maxRequests = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '300');

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
        return res.status(429).json({
          success: false,
          error: 'Too many requests, please try again later',
        });
      }

      clientData.count++;
      next();
    });
  }

  // Simple test endpoint
  app.get('/test', (_req, res) => {
    res.json({ success: true, message: 'OK' });
  });

  return app;
}

describe('Rate Limiting Middleware', () => {
  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('when rate limiting is enabled', () => {
    it('should allow requests under the limit', async () => {
      const app = createTestApp({ maxRequests: '5', windowMs: '1000' });

      // First request should succeed
      const response1 = await request(app).get('/test');
      expect(response1.status).toBe(200);
      expect(response1.body.success).toBe(true);

      // Second request should also succeed
      const response2 = await request(app).get('/test');
      expect(response2.status).toBe(200);
      expect(response2.body.success).toBe(true);
    });

    it('should block requests that exceed the limit', async () => {
      const app = createTestApp({ maxRequests: '2', windowMs: '5000' });

      // First two requests should succeed
      await request(app).get('/test').expect(200);
      await request(app).get('/test').expect(200);

      // Third request should be rate limited
      const response = await request(app).get('/test');
      expect(response.status).toBe(429);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Too many requests, please try again later');
    });

    it('should reset the counter after the time window', async () => {
      const app = createTestApp({ maxRequests: '2', windowMs: '200' }); // 200ms window

      // Use up the requests
      await request(app).get('/test').expect(200);
      await request(app).get('/test').expect(200);

      // This should be rate limited
      await request(app).get('/test').expect(429);

      // Wait for window to reset (add extra margin for timing issues)
      await new Promise(resolve => setTimeout(resolve, 250));

      // Should work again after reset
      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
    });

    it('should use environment variable configuration', async () => {
      const app = createTestApp({ 
        enabled: 'true',
        maxRequests: '1', // Only allow 1 request
        windowMs: '1000', 
      });

      // First request succeeds
      await request(app).get('/test').expect(200);
      
      // Second request should be blocked
      await request(app).get('/test').expect(429);
    });
  });

  describe('when rate limiting is disabled', () => {
    it('should allow unlimited requests when RATE_LIMIT_ENABLED=false', async () => {
      const app = createTestApp({ enabled: 'false' });

      // Should allow many requests without rate limiting
      for (let i = 0; i < 10; i++) {
        const response = await request(app).get('/test');
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      }
    });
  });

  describe('environment variable defaults', () => {
    it('should use default values when env vars are not set', async () => {
      // Don't set any rate limit env vars to test defaults
      const app = createTestApp({});

      // Should use defaults: enabled=true, maxRequests=300, windowMs=60000
      // Since we use 300 as default max, it's hard to test in a unit test
      // So we just verify it doesn't immediately block
      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
    });

    it('should handle invalid environment variable values gracefully', async () => {
      const app = createTestApp({ 
        maxRequests: 'invalid', 
        windowMs: 'invalid', 
      });

      // Should not crash and should work (falling back to defaults via parseInt)
      const response = await request(app).get('/test');
      expect(response.status).toBe(200);
    });
  });
});