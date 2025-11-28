import { Router, Request, Response } from 'express';
import { createAuthController } from '../controllers/AuthController';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken, authenticateTokenForRevocation } from '../middleware/auth';
import { validateBody } from '../middleware/validation';
import {
  RequestMagicLinkSchema,
  VerifyMagicLinkSchema,
  UpdateProfileSchema,
  UpdateTimezoneSchema,
} from '../utils/validation';

const router = Router();


const authController = createAuthController();

// Request magic link for authentication
router.post('/magic-link', validateBody(RequestMagicLinkSchema, { operationName: 'requestMagicLink' }), asyncHandler(authController.requestMagicLink));

// Verify magic link and get JWT token
router.post('/verify', validateBody(VerifyMagicLinkSchema, { operationName: 'verifyMagicLink' }), asyncHandler(authController.verifyMagicLink));

// Refresh JWT token (using refresh token)
router.post('/refresh', asyncHandler(authController.refreshToken));

// Logout (revoke refresh tokens - RFC 7009 compliant: accepts expired tokens)
router.post('/logout', authenticateTokenForRevocation, asyncHandler(authController.logout));

// Update user profile (protected route)
router.put('/profile', authenticateToken, validateBody(UpdateProfileSchema, { operationName: 'updateProfile' }), asyncHandler(authController.updateProfile));

// Update user timezone (protected route)
router.patch('/timezone', authenticateToken, validateBody(UpdateTimezoneSchema, { operationName: 'updateTimezone' }), asyncHandler(authController.updateTimezone));

// Get user profile (protected route - used for testing auth middleware)
router.get('/profile', authenticateToken, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).user;
  res.json({
    success: true,
    data: user,
  });
}));

export default router;