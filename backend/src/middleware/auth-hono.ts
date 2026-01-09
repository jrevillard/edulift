import { Context, Next } from 'hono';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { createLogger } from '../utils/logger';

const logger = createLogger('auth-hono');

export interface AuthenticatedContext extends Context {
  get(key: 'userId'): string;
  get(key: 'user'): {
    id: string;
    email: string;
    name: string;
    timezone: string;
  };
  set(key: 'userId', value: string): void;
  set(key: 'user', value: {
    id: string;
    email: string;
    name: string;
    timezone: string;
  }): void;
}

interface JwtPayload {
  userId: string;
  email: string;
  familyId?: string;
}

/**
 * Hono authentication middleware that extracts JWT token and validates user
 * Routes can skip authentication by setting c.set('skipAuth', true) before this middleware
 */
export const authenticateToken = async (c: Context, next: Next): Promise<void | Response> => {
  // Allow routes to explicitly skip authentication
  if (c.get('skipAuth')) {
    await next();
    return;
  }

  const authHeader = c.req.header('authorization');
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return c.json({
      error: 'Access token required',
    }, 401);
  }

  try {
    // JWT secret MUST be set - no fallback for security
    const jwtAccessSecret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET;
    if (!jwtAccessSecret) {
      throw new Error('JWT_SECRET environment variable must be set - application cannot start');
    }

    const decoded = jwt.verify(token, jwtAccessSecret) as JwtPayload;

    // Fetch user details from database to ensure user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, timezone: true },
    });

    // User not found = token is invalid (user was deleted)
    if (!user) {
      return c.json({
        error: 'Invalid token - user not found',
      }, 401);
    }

    // Attach user info to context
    c.set('userId', user.id);
    c.set('user', user);

    await next();
  } catch (error) {
    // Grace period for expired tokens (5 minutes)
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      try {
        const decoded = jwt.decode(token) as JwtPayload & { exp?: number };

        if (decoded && decoded.exp) {
          const expirationTime = decoded.exp * 1000; // Convert to milliseconds
          const gracePeriodMinutes = parseInt(process.env.REFRESH_GRACE_PERIOD_MINUTES || '5', 10);
          const gracePeriod = gracePeriodMinutes * 60 * 1000; // Convert to milliseconds

          // Check if token is within grace period
          if (Date.now() - expirationTime <= gracePeriod) {
            // Token expired but within grace period - accept it
            const user = await prisma.user.findUnique({
              where: { id: decoded.userId },
              select: { id: true, email: true, name: true, timezone: true },
            });

            if (user) {
              c.set('userId', user.id);
              c.set('user', user);
              await next();
              return;
            }
          }
        }
      } catch (gracePeriodError) {
        logger.error('Grace period check error:', { error: gracePeriodError });
      }

      // Token expired beyond grace period - return 401 to trigger refresh flow
      return c.json({
        error: 'Token expired',
      }, 401);
    }

    // Enhanced error logging for debugging
    logger.error('Token verification error:', {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error,
      tokenPreview: token ? `${token.substring(0, 10)}...` : 'no-token',
      userAgent: c.req.header('user-agent'),
      timestamp: new Date().toISOString(),
    });

    // Invalid token (any other JWT verification error)
    return c.json({
      error: 'Invalid or expired token',
    }, 401);
  }
};

/**
 * Public endpoint middleware
 * Marks a route as public (skips authentication)
 * Must be applied BEFORE authenticateToken middleware
 */
export const publicEndpoint = async (c: Context, next: Next): Promise<void> => {
  c.set('skipAuth', true);
  await next();
};

/**
 * Refresh endpoint middleware
 * Marks a route as a token refresh endpoint (no JWT required, but refresh token is mandatory)
 * Must be applied BEFORE authenticateToken middleware
 * Handler is responsible for validating refresh token presence
 */
export const refreshEndpoint = async (c: Context, next: Next): Promise<void> => {
  c.set('skipAuth', true);
  c.set('isRefresh', true);
  await next();
};

/**
 * RFC 7009 Compliant Token Revocation Middleware
 * Accepts expired/invalid tokens for logout/revocation endpoints
 */
export const authenticateTokenForRevocation = async (c: Context, next: Next): Promise<void | Response> => {
  const authHeader = c.req.header('authorization');
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  // RFC 7009: No token provided - this is the only case we reject
  if (!token) {
    return c.json({
      error: 'Access token required',
    }, 401);
  }

  try {
    // RFC 7009: Try to decode token WITHOUT verification (accept expired tokens)
    const decoded = jwt.decode(token) as JwtPayload;

    if (!decoded || !decoded.userId) {
      // Malformed token - but RFC 7009 says accept it anyway (idempotent revocation)
      // Return 200 because the token is already unusable
      return c.json({
        message: 'Logged out successfully',
      });
    }

    // Attach userId to context for logout controller
    c.set('userId', decoded.userId);

    // Also try to get user details if available (not critical for logout)
    try {
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, name: true, timezone: true },
      });

      if (user) {
        c.set('user', user);
      }
    } catch (userFetchError) {
      // User not found or DB error - continue anyway for logout
      logger.warn('[RFC 7009] User fetch failed during logout, continuing anyway:', { error: userFetchError });
    }

    await next();
  } catch (error) {
    // RFC 7009: ANY error during token decode = accept and return 200
    // The token is unusable, which is the desired state
    logger.info('[RFC 7009] Token decode error during logout (compliant - accepting anyway):', { error });

    return c.json({
      message: 'Logged out successfully',
    });
  }
};

// Token generation and verification utilities for testing
export const generateToken = (payload: JwtPayload): string => {
  const jwtAccessSecret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET;
  if (!jwtAccessSecret) {
    throw new Error('JWT_SECRET environment variable must be set');
  }

  return jwt.sign(payload, jwtAccessSecret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  } as jwt.SignOptions);
};

export const verifyToken = (token: string): JwtPayload => {
  const jwtAccessSecret = process.env.JWT_SECRET || process.env.JWT_ACCESS_SECRET;
  if (!jwtAccessSecret) {
    throw new Error('JWT_SECRET environment variable must be set');
  }

  return jwt.verify(token, jwtAccessSecret) as JwtPayload;
};