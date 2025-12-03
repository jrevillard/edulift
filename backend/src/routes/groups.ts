import { Router } from 'express';
import { createGroupController } from '../controllers/GroupController';
import { createGroupScheduleConfigController } from '../controllers/GroupScheduleConfigController';
import { ScheduleSlotController } from '../controllers/ScheduleSlotController';
import { ScheduleSlotService } from '../services/ScheduleSlotService';
import { ScheduleSlotRepository } from '../repositories/ScheduleSlotRepository';
import { ScheduleSlotValidationService } from '../services/ScheduleSlotValidationService';
import { NotificationService } from '../services/NotificationService';
import { EmailServiceFactory } from '../services/EmailServiceFactory';
import { UserRepository } from '../repositories/UserRepository';
import { ChildAssignmentService } from '../services/ChildAssignmentService';
import { prisma } from '../config/database';
import { validateBody, validateParams, validateQuery } from '../middleware/validation';
import { authenticateToken, requireGroupMembership, requireGroupAdmin } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import {
  WeekdayQuerySchema,
  GroupParamsSchema,
  InvitationParamsSchema,
  FamilyRoleParamsSchema,
} from '../schemas/groups';
import {
  CreateGroupSchema,
  UpdateGroupSchema,
  JoinGroupSchema,
  UpdateMemberRoleSchema,
  InviteFamilySchema,
} from '../utils/validation';
import {
  DateRangeQuerySchema,
  CreateScheduleSlotWithVehicleSchema,
} from '../schemas/scheduleSlots';

// Setup dependencies for ScheduleSlotController
const scheduleSlotRepository = new ScheduleSlotRepository(prisma);
const userRepository = new UserRepository(prisma);
const emailService = EmailServiceFactory.getInstance();
const notificationService = new NotificationService(emailService, userRepository, scheduleSlotRepository, prisma);
const scheduleSlotValidationService = new ScheduleSlotValidationService(prisma);
const scheduleSlotService = new ScheduleSlotService(scheduleSlotRepository, notificationService, scheduleSlotValidationService);
const childAssignmentService = new ChildAssignmentService(prisma);
const scheduleSlotController = new ScheduleSlotController(scheduleSlotService, childAssignmentService);

const groupController = createGroupController();
const groupScheduleConfigController = createGroupScheduleConfigController();
const router = Router();

// Public routes (no authentication required)
router.post('/validate-invite', asyncHandler(groupController.validateInviteCode));

// Apply auth middleware to protected routes
router.use(authenticateToken);

// User group management routes (authentication required)

// Validate invitation with user context (authenticated)
router.post('/validate-invite-auth', asyncHandler(groupController.validateInviteCodeWithAuth));

// Create new group
router.post('/', validateBody(CreateGroupSchema, { operationName: 'createGroup' }), asyncHandler(groupController.createGroup));

// Join group by invite code
router.post('/join', validateBody(JoinGroupSchema, { operationName: 'joinGroup' }), asyncHandler(groupController.joinGroup));

// Get user's groups
router.get('/my-groups', asyncHandler(groupController.getUserGroups));

// Group-specific routes (group membership required)

// Get group families (family-based group management)
router.get('/:groupId/families',
  validateParams(GroupParamsSchema),
  requireGroupMembership,
  asyncHandler(groupController.getGroupFamilies),
);


// Leave group (member action)
router.post(
  '/:groupId/leave',
  validateParams(GroupParamsSchema),
  requireGroupMembership,
  asyncHandler(groupController.leaveGroup),
);

// Admin-only routes

// Update family role (admin only)
router.patch(
  '/:groupId/families/:familyId/role',
  validateParams(FamilyRoleParamsSchema),
  validateBody(UpdateMemberRoleSchema, { operationName: 'updateFamilyRole' }),
  asyncHandler(requireGroupAdmin),
  asyncHandler(groupController.updateFamilyRole),
);

// Remove family from group (admin only)
router.delete(
  '/:groupId/families/:familyId',
  validateParams(FamilyRoleParamsSchema),
  asyncHandler(requireGroupAdmin),
  asyncHandler(groupController.removeFamilyFromGroup),
);


// Update group settings (admin only)
router.patch('/:groupId',
  validateParams(GroupParamsSchema),
  validateBody(UpdateGroupSchema, { operationName: 'updateGroup' }),
  asyncHandler(requireGroupAdmin),
  asyncHandler(groupController.updateGroup),
);

// Delete group (admin only)
router.delete('/:groupId',
  validateParams(GroupParamsSchema),
  asyncHandler(requireGroupAdmin),
  asyncHandler(groupController.deleteGroup),
);

// Group invitation routes (admin only)

// Search families for invitation (admin only)
router.post(
  '/:groupId/search-families',
  validateParams(GroupParamsSchema),
  asyncHandler(requireGroupAdmin),
  asyncHandler(groupController.searchFamilies),
);

// Invite family to group
router.post(
  '/:groupId/invite',
  validateParams(GroupParamsSchema),
  validateBody(InviteFamilySchema, { operationName: 'inviteFamilyToGroup' }),
  asyncHandler(requireGroupAdmin),
  asyncHandler(groupController.inviteFamilyToGroup),
);

// Get pending invitations
router.get(
  '/:groupId/invitations',
  validateParams(GroupParamsSchema),
  asyncHandler(requireGroupAdmin),
  asyncHandler(groupController.getPendingInvitations),
);

// Cancel invitation
router.delete(
  '/:groupId/invitations/:invitationId',
  validateParams(InvitationParamsSchema),
  asyncHandler(requireGroupAdmin),
  asyncHandler(groupController.cancelInvitation),
);

// Group Schedule Configuration routes

// Get default schedule hours (public for authenticated users)
router.get('/schedule-config/default',
  asyncHandler(groupScheduleConfigController.getDefaultScheduleHours),
);

// Get group schedule configuration (group member access)
router.get('/:groupId/schedule-config',
  validateParams(GroupParamsSchema),
  requireGroupMembership,
  asyncHandler(groupScheduleConfigController.getGroupScheduleConfig),
);

// Get time slots for specific weekday (group member access)
router.get('/:groupId/schedule-config/time-slots',
  validateParams(GroupParamsSchema),
  validateQuery(WeekdayQuerySchema),
  requireGroupMembership,
  asyncHandler(groupScheduleConfigController.getGroupTimeSlots),
);

// Update group schedule configuration (admin only)
router.put('/:groupId/schedule-config',
  validateParams(GroupParamsSchema),
  asyncHandler(requireGroupAdmin),
  asyncHandler(groupScheduleConfigController.updateGroupScheduleConfig),
);

// Reset group schedule configuration to default (admin only)
router.post('/:groupId/schedule-config/reset',
  validateParams(GroupParamsSchema),
  asyncHandler(requireGroupAdmin),
  asyncHandler(groupScheduleConfigController.resetGroupScheduleConfig),
);

// Group Schedule routes

// Create schedule slot with vehicle for a group
router.post(
  '/:groupId/schedule-slots',
  validateParams(GroupParamsSchema),
  validateBody(CreateScheduleSlotWithVehicleSchema),
  requireGroupMembership,
  asyncHandler(scheduleSlotController.createScheduleSlotWithVehicle),
);

// Get schedule for a group (with optional date range)
router.get(
  '/:groupId/schedule',
  validateParams(GroupParamsSchema),
  validateQuery(DateRangeQuerySchema),
  requireGroupMembership,
  asyncHandler(scheduleSlotController.getSchedule),
);

export default router;