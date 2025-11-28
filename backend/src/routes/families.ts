import { Router } from 'express';
import { createFamilyController } from '../controllers/FamilyController';
import { validateParams, validateBody } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

// Import centralized Families schemas to trigger OpenAPI registration (Pattern 100%)
// This ensures all Families schemas are properly documented in the OpenAPI specification
import {
  ValidateInviteCodeSchema,
  CreateFamilySchema,
  JoinFamilySchema,
  FamilyIdParamsSchema,
  MemberIdParamsSchema,
  FamilyMemberParamsSchema,
  FamilyInvitationParamsSchema,
  UpdateMemberRoleSchema,
  UpdateFamilyNameSchema,
  InviteMemberSchema,
} from '../schemas/families';

const familyController = createFamilyController();
const router = Router();

// Public routes (no auth required)
router.post('/validate-invite',
  validateBody(ValidateInviteCodeSchema),
  asyncHandler(familyController.validateInviteCode),
);

// Apply auth middleware to protected routes
router.use(authenticateToken);

// Family routes
router.post('/',
  validateBody(CreateFamilySchema),
  asyncHandler(familyController.createFamily),
);

router.post('/join',
  validateBody(JoinFamilySchema),
  asyncHandler(familyController.joinFamily),
);

router.get('/current', asyncHandler(familyController.getCurrentFamily));

router.get('/:familyId/permissions',
  validateParams(FamilyIdParamsSchema),
  asyncHandler(familyController.getUserPermissions),
);

router.put('/members/:memberId/role',
  validateParams(MemberIdParamsSchema),
  validateBody(UpdateMemberRoleSchema),
  asyncHandler(familyController.updateMemberRole),
);

router.post('/invite-code', asyncHandler(familyController.generateInviteCode));

router.post('/:familyId/invite',
  validateParams(FamilyIdParamsSchema),
  validateBody(InviteMemberSchema),
  asyncHandler(familyController.inviteMember),
);

router.get('/:familyId/invitations',
  validateParams(FamilyIdParamsSchema),
  asyncHandler(familyController.getPendingInvitations),
);

router.delete('/:familyId/invitations/:invitationId',
  validateParams(FamilyInvitationParamsSchema),
  asyncHandler(familyController.cancelInvitation),
);

router.put('/name',
  validateBody(UpdateFamilyNameSchema),
  asyncHandler(familyController.updateFamilyName),
);

router.delete('/:familyId/members/:memberId',
  validateParams(FamilyMemberParamsSchema),
  asyncHandler(familyController.removeMember),
);

router.post('/:familyId/leave',
  validateParams(FamilyIdParamsSchema),
  asyncHandler(familyController.leaveFamily),
);

export default router;