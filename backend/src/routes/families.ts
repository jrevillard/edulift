import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { FamilyController } from '../controllers/FamilyController';
import { FamilyService } from '../services/FamilyService';
import { FamilyAuthService } from '../services/FamilyAuthService';
import { EmailServiceFactory } from '../services/EmailServiceFactory';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

// Mock cache service for now
const mockCacheService = {
  async get(_key: string) { return null; },
  async set(_key: string, _value: any, _ttl: number) { return; }
};

// Mock logger for now
const mockLogger = {
  info: console.log,
  error: console.error,
  warn: console.warn,
  debug: console.debug
};

const prisma = new PrismaClient();

// Use centralized email service factory
const emailService = EmailServiceFactory.getInstance();
const familyService = new FamilyService(prisma, mockLogger, undefined, emailService);
const familyAuthService = new FamilyAuthService(prisma, mockCacheService);
const familyController = new FamilyController(familyService, familyAuthService);

const router = Router();

// Public routes (no auth required)
router.post('/validate-invite', asyncHandler((req: Request, res: Response) => familyController.validateInviteCode(req, res)));

// Apply auth middleware to protected routes
router.use(authenticateToken);

// Family routes
router.post('/', asyncHandler((req: AuthenticatedRequest, res: Response) => familyController.createFamily(req, res)));
router.post('/join', asyncHandler((req: AuthenticatedRequest, res: Response) => familyController.joinFamily(req, res)));
router.get('/current', asyncHandler((req: AuthenticatedRequest, res: Response) => familyController.getCurrentFamily(req, res)));
router.get('/:familyId/permissions', asyncHandler((req: AuthenticatedRequest, res: Response) => familyController.getUserPermissions(req, res)));
router.put('/members/:memberId/role', asyncHandler((req: AuthenticatedRequest, res: Response) => familyController.updateMemberRole(req, res)));
router.post('/invite-code', asyncHandler((req: AuthenticatedRequest, res: Response) => familyController.generateInviteCode(req, res)));
router.post('/:familyId/invite', asyncHandler((req: AuthenticatedRequest, res: Response) => familyController.inviteMember(req, res)));
router.get('/:familyId/invitations', asyncHandler((req: AuthenticatedRequest, res: Response) => familyController.getPendingInvitations(req, res)));
router.delete('/:familyId/invitations/:invitationId', asyncHandler((req: AuthenticatedRequest, res: Response) => familyController.cancelInvitation(req, res)));
router.put('/name', asyncHandler((req: AuthenticatedRequest, res: Response) => familyController.updateFamilyName(req, res)));
router.delete('/:familyId/members/:memberId', asyncHandler((req: AuthenticatedRequest, res: Response) => familyController.removeMember(req, res)));
router.post('/:familyId/leave', asyncHandler((req: AuthenticatedRequest, res: Response) => familyController.leaveFamily(req, res)));

export default router;