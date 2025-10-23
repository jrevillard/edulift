import { Router, Request, Response } from 'express';
import { createAuthController } from '../controllers/AuthController';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken, authenticateTokenForRevocation } from '../middleware/auth';

const router = Router();

// Test endpoint to verify email service configuration (password excluded for security)
router.get('/test-config', asyncHandler(async (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      nodeEnv: process.env.NODE_ENV,
      emailUser: process.env.EMAIL_USER ? 'SET' : 'EMPTY',
      hasCredentials: !!(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD),
      mockServiceTest: 'Working v2',
    },
  });
}));

const authController = createAuthController();

// Request magic link for authentication
router.post('/magic-link', asyncHandler(authController.requestMagicLink));

// Verify magic link and get JWT token
router.post('/verify', asyncHandler(authController.verifyMagicLink));

// Refresh JWT token (using refresh token)
router.post('/refresh', asyncHandler(authController.refreshToken));

// Logout (revoke refresh tokens - RFC 7009 compliant: accepts expired tokens)
router.post('/logout', authenticateTokenForRevocation, asyncHandler(authController.logout));

// Update user profile (protected route)
router.put('/profile', authenticateToken, asyncHandler(authController.updateProfile));

// Update user timezone (protected route)
router.patch('/timezone', authenticateToken, asyncHandler(authController.updateTimezone));

// Get user profile (protected route - used for testing auth middleware)
router.get('/profile', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  res.json({
    success: true,
    data: user,
  });
}));

export default router;