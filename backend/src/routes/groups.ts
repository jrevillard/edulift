import { Router } from 'express';
import { createGroupController } from '../controllers/GroupController';
import { createGroupScheduleConfigController } from '../controllers/GroupScheduleConfigController';
import { validateParams } from '../middleware/validation';
import { authenticateToken, requireGroupMembership, requireGroupAdmin } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { z } from 'zod';

const groupController = createGroupController();
const groupScheduleConfigController = createGroupScheduleConfigController();
const router = Router();

// Validation schemas
const GroupParamsSchema = z.object({
  groupId: z.string().cuid('Invalid group ID format')
});


const InvitationParamsSchema = z.object({
  groupId: z.string().cuid('Invalid group ID format'),
  invitationId: z.string().cuid('Invalid invitation ID format')
});

// Public routes (no authentication required)
router.post('/validate-invite', asyncHandler(groupController.validateInviteCode));

// Apply auth middleware to protected routes
router.use(authenticateToken);

// User group management routes (authentication required)

// Validate invitation with user context (authenticated)
router.post('/validate-invite-auth', asyncHandler(groupController.validateInviteCodeWithAuth));

// Create new group
router.post('/', asyncHandler(groupController.createGroup));

// Join group by invite code
router.post('/join', asyncHandler(groupController.joinGroup));

// Get user's groups
router.get('/my-groups', asyncHandler(groupController.getUserGroups));

// Group-specific routes (group membership required)

// Get group families (family-based group management)
router.get('/:groupId/families', 
  validateParams(GroupParamsSchema), 
  requireGroupMembership, 
  asyncHandler(groupController.getFamilies)
);

// NOTE: Schedule slot creation moved to scheduleSlots.ts for better organization
// and to enforce business rule that schedule slots must contain at least 1 vehicle

// NOTE: Weekly schedule route moved to scheduleSlots.ts for better organization
// and to use the updated ScheduleSlotService with proper vehicleAssignmentId handling

// Leave group (member action)
router.post(
  '/:groupId/leave',
  validateParams(GroupParamsSchema),
  requireGroupMembership,
  asyncHandler(groupController.leaveGroup)
);

// Admin-only routes

// Update family role (admin only)
router.patch(
  '/:groupId/families/:familyId/role',
  validateParams(z.object({
    groupId: z.string().cuid(),
    familyId: z.string().cuid()
  })),
  asyncHandler(requireGroupAdmin),
  asyncHandler(groupController.updateFamilyRole)
);

// Remove family from group (admin only)
router.delete(
  '/:groupId/families/:familyId',
  validateParams(z.object({
    groupId: z.string().cuid(),
    familyId: z.string().cuid()
  })),
  asyncHandler(requireGroupAdmin),
  asyncHandler(groupController.removeFamilyFromGroup)
);


// Update group settings (admin only)
router.patch('/:groupId', 
  validateParams(GroupParamsSchema),
  asyncHandler(requireGroupAdmin),
  asyncHandler(groupController.updateGroup)
);

// Delete group (admin only)
router.delete('/:groupId', 
  validateParams(GroupParamsSchema),
  asyncHandler(requireGroupAdmin),
  asyncHandler(groupController.deleteGroup)
);

// Group invitation routes (admin only)

// Search families for invitation (admin only)
router.post(
  '/:groupId/search-families',
  validateParams(GroupParamsSchema),
  asyncHandler(requireGroupAdmin),
  asyncHandler(groupController.searchFamilies)
);

// Invite family to group
router.post(
  '/:groupId/invite',
  validateParams(GroupParamsSchema),
  asyncHandler(requireGroupAdmin),
  asyncHandler(groupController.inviteFamilyToGroup)
);

// Get pending invitations
router.get(
  '/:groupId/invitations',
  validateParams(GroupParamsSchema),
  asyncHandler(requireGroupAdmin),
  asyncHandler(groupController.getPendingInvitations)
);

// Cancel invitation
router.delete(
  '/:groupId/invitations/:invitationId',
  validateParams(InvitationParamsSchema),
  asyncHandler(requireGroupAdmin),
  asyncHandler(groupController.cancelInvitation)
);

// Group Schedule Configuration routes

// Get default schedule hours (public for authenticated users)
router.get('/schedule-config/default', 
  asyncHandler(groupScheduleConfigController.getDefaultScheduleHours)
);

// Initialize default configurations for all groups (admin utility)
router.post('/schedule-config/initialize', 
  asyncHandler(groupScheduleConfigController.initializeDefaultConfigs)
);

// Get group schedule configuration (group member access)
router.get('/:groupId/schedule-config', 
  validateParams(GroupParamsSchema),
  requireGroupMembership,
  asyncHandler(groupScheduleConfigController.getGroupScheduleConfig)
);

// Get time slots for specific weekday (group member access)
router.get('/:groupId/schedule-config/time-slots', 
  validateParams(GroupParamsSchema),
  requireGroupMembership,
  asyncHandler(groupScheduleConfigController.getGroupTimeSlots)
);

// Update group schedule configuration (admin only)
router.put('/:groupId/schedule-config', 
  validateParams(GroupParamsSchema),
  asyncHandler(requireGroupAdmin),
  asyncHandler(groupScheduleConfigController.updateGroupScheduleConfig)
);

// Reset group schedule configuration to default (admin only)
router.post('/:groupId/schedule-config/reset', 
  validateParams(GroupParamsSchema),
  asyncHandler(requireGroupAdmin),
  asyncHandler(groupScheduleConfigController.resetGroupScheduleConfig)
);

export default router;