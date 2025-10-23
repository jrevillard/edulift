import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { ApiResponse } from '../types';

const prisma = new PrismaClient();

export interface AuthenticatedRequest extends Request {
  userId: string;
  user: {
    id: string;
    email: string;
    name: string;
    timezone: string;
  };
}

interface JwtPayload {
  userId: string;
  email: string;
}

// HTTP Status Codes for Authentication Middleware:
// - 401 Unauthorized: Token expired, invalid, or user deleted → triggers refresh on client
// - 403 Forbidden: User authenticated but lacks permissions → used by ROUTE handlers, NOT this middleware
// This middleware only returns 401 (auth issues), never 403 (permissions are checked in route handlers)
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    const response: ApiResponse = {
      success: false,
      error: 'Access token required',
    };
    res.status(401).json(response);
    return;
  }

  try {
    // ✅ NEW: Use JWT_ACCESS_SECRET for new tokens, fallback to JWT_SECRET for legacy
    const jwtAccessSecret = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
    if (!jwtAccessSecret) {
      throw new Error('JWT_ACCESS_SECRET environment variable not set');
    }

    const decoded = jwt.verify(token, jwtAccessSecret) as JwtPayload;

    // Fetch user details from database to ensure user still exists
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, name: true, timezone: true },
    });

    // ✅ User not found = token is invalid (user was deleted)
    // This is an authentication issue, not a permissions issue
    // Return 401 to trigger automatic refresh on client
    // (refresh will fail because user is deleted, then client will logout)
    if (!user) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid token - user not found',
      };
      res.status(401).json(response);  // ✅ 401 = auth issue
      return;
    }

    // Attach user info to request
    const authReq = req as AuthenticatedRequest;
    authReq.userId = user.id;
    authReq.user = user;

    next();
  } catch (error) {
    // ✅ NEW: Grace period for expired tokens (5 minutes)
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
              const authReq = req as AuthenticatedRequest;
              authReq.userId = user.id;
              authReq.user = user;
              next();
              return;
            }
          }
        }
      } catch (gracePeriodError) {
        console.error('Grace period check error:', gracePeriodError);
      }

      // ✅ 401 = Unauthorized (token expired) → allows automatic refresh on client
      // Token expired beyond grace period - return 401 to trigger refresh flow
      const response: ApiResponse = {
        success: false,
        error: 'Token expired',
      };
      res.status(401).json(response);
      return;
    }

    console.error('Token verification error:', error);

    // ✅ 401 = Invalid token (any other JWT verification error)
    // Could be malformed, wrong signature, etc. - all auth issues, not permissions
    const response: ApiResponse = {
      success: false,
      error: 'Invalid or expired token',
    };
    res.status(401).json(response);
  }
};

export const requireGroupMembership = (req: Request, res: Response, next: NextFunction): void => {
  // Cast to AuthenticatedRequest since this middleware should be used after authenticateToken
  const authReq = req as AuthenticatedRequest;
  
  if (!authReq.userId) {
    const response: ApiResponse = {
      success: false,
      error: 'Authentication required',
    };
    res.status(401).json(response);
    return;
  }

  // The actual group membership check will be implemented in individual controllers
  // where we have access to the groupId parameter
  next();
};

/**
 * RFC 7009 Compliant Token Revocation Middleware
 *
 * For logout/revocation endpoints, RFC 7009 requires accepting expired/invalid tokens:
 * "Invalid tokens do not cause an error response since the client cannot handle
 * such an error in a reasonable way. Moreover, the purpose of the revocation
 * request, invalidating the particular token, is already achieved."
 *
 * This middleware extracts userId from ANY token (expired or valid) for logout purposes.
 */
export const authenticateTokenForRevocation = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  // RFC 7009: No token provided - this is the only case we reject
  if (!token) {
    const response: ApiResponse = {
      success: false,
      error: 'Access token required',
    };
    res.status(401).json(response);
    return;
  }

  try {
    // RFC 7009: Try to decode token WITHOUT verification (accept expired tokens)
    const decoded = jwt.decode(token) as JwtPayload;

    if (!decoded || !decoded.userId) {
      // Malformed token - but RFC 7009 says accept it anyway (idempotent revocation)
      // Return 200 because the token is already unusable
      const response: ApiResponse = {
        success: true,
        data: {
          message: 'Logged out successfully',
        },
      };
      res.status(200).json(response);
      return;
    }

    // Attach userId to request for logout controller
    const authReq = req as AuthenticatedRequest;
    authReq.userId = decoded.userId;

    // Also try to get user details if available (not critical for logout)
    try {
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true, name: true, timezone: true },
      });

      if (user) {
        authReq.user = user;
      }
    } catch (userFetchError) {
      // User not found or DB error - continue anyway for logout
      console.warn('[RFC 7009] User fetch failed during logout, continuing anyway:', userFetchError);
    }

    next();
  } catch (error) {
    // RFC 7009: ANY error during token decode = accept and return 200
    // The token is unusable, which is the desired state
    console.info('[RFC 7009] Token decode error during logout (compliant - accepting anyway):', error);

    const response: ApiResponse = {
      success: true,
      data: {
        message: 'Logged out successfully',
      },
    };
    res.status(200).json(response);
  }
};

export const requireGroupAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  // Cast to AuthenticatedRequest since this middleware should be used after authenticateToken
  const authReq = req as AuthenticatedRequest;
  
  if (!authReq.userId) {
    const response: ApiResponse = {
      success: false,
      error: 'Authentication required',
    };
    res.status(401).json(response);
    return;
  }

  const groupId = authReq.params.groupId;
  if (!groupId) {
    const response: ApiResponse = {
      success: false,
      error: 'Group ID required',
    };
    res.status(400).json(response);
    return;
  }

  try {
    // Get user's family first
    const userFamily = await prisma.familyMember.findFirst({
      where: { userId: authReq.userId },
      select: { familyId: true, role: true },
    });

    if (!userFamily) {
      const response: ApiResponse = {
        success: false,
        error: 'User must be part of a family',
      };
      res.status(403).json(response);
      return;
    }

    // Get group and check access
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        ownerFamily: {
          include: {
            members: {
              where: { userId: authReq.userId },
            },
          },
        },
        familyMembers: {
          where: {
            familyId: userFamily.familyId,
          },
        },
      },
    });

    if (!group) {
      const response: ApiResponse = {
        success: false,
        error: 'Group not found',
      };
      res.status(404).json(response);
      return;
    }

    // Check if user has admin permissions
    let hasAdminPermissions = false;

    // Check if user is admin of the owner family
    const isOwnerFamilyAdmin = group.ownerFamily.members.length > 0 && 
                              group.ownerFamily.members[0].role === 'ADMIN';

    if (isOwnerFamilyAdmin) {
      hasAdminPermissions = true;
    } else {
      // Check if user's family has admin role in the group
      const userFamilyMembership = group.familyMembers[0];
      if (userFamilyMembership && userFamilyMembership.role === 'ADMIN' && 
          userFamily.role === 'ADMIN') {
        hasAdminPermissions = true;
      }
    }

    if (!hasAdminPermissions) {
      const response: ApiResponse = {
        success: false,
        error: 'Admin privileges required',
      };
      res.status(403).json(response);
      return;
    }

    next();
  } catch (error) {
    console.error('Group admin check error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Failed to verify admin privileges',
    };
    res.status(500).json(response);
  }
};