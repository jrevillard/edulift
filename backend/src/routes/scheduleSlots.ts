import { prisma } from '../config/database';
import { Router } from 'express';
import { ScheduleSlotController } from '../controllers/ScheduleSlotController';
import { ScheduleSlotService } from '../services/ScheduleSlotService';
import { ChildAssignmentService } from '../services/ChildAssignmentService';
import { ScheduleSlotRepository } from '../repositories/ScheduleSlotRepository';
import { ScheduleSlotValidationService } from '../services/ScheduleSlotValidationService';
import { NotificationService } from '../services/NotificationService';
import { EmailServiceFactory } from '../services/EmailServiceFactory';
import { UserRepository } from '../repositories/UserRepository';
import { authenticateToken } from '../middleware/auth';
import { validateBody, validateParams, validateQuery } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { z } from 'zod';
import { VEHICLE_CONSTRAINTS } from '../constants/vehicle';


const scheduleSlotRepository = new ScheduleSlotRepository(prisma);
const userRepository = new UserRepository(prisma);

// Use centralized email service factory
const emailService = EmailServiceFactory.getInstance();

const notificationService = new NotificationService(emailService, userRepository, scheduleSlotRepository, prisma);
const scheduleSlotValidationService = new ScheduleSlotValidationService(prisma);
const scheduleSlotService = new ScheduleSlotService(scheduleSlotRepository, notificationService, scheduleSlotValidationService);
const childAssignmentService = new ChildAssignmentService(prisma);
const scheduleSlotController = new ScheduleSlotController(scheduleSlotService, childAssignmentService);

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// Validation schemas
const ScheduleSlotParamsSchema = z.object({
  scheduleSlotId: z.string().cuid('Invalid schedule slot ID format'),
});

const GroupParamsSchema = z.object({
  groupId: z.string().cuid('Invalid group ID format'),
});

const DateRangeQuerySchema = z.object({
  startDate: z.string().datetime('Start date must be a valid ISO 8601 datetime string').optional(),
  endDate: z.string().datetime('End date must be a valid ISO 8601 datetime string').optional(),
});

const CreateScheduleSlotWithVehicleSchema = z.object({
  datetime: z.string().datetime('DateTime must be a valid ISO 8601 UTC datetime string'),
  vehicleId: z.string().cuid('Invalid vehicle ID format'),
  driverId: z.string().cuid('Invalid driver ID format').optional(),
  seatOverride: z.number().int().min(0).max(VEHICLE_CONSTRAINTS.MAX_CAPACITY).optional(),
});

const AssignVehicleSchema = z.object({
  vehicleId: z.string().cuid('Invalid vehicle ID format'),
  driverId: z.string().cuid('Invalid driver ID format').optional(),
  seatOverride: z.number().int().min(0).max(VEHICLE_CONSTRAINTS.MAX_CAPACITY).optional(),
});

const AssignChildSchema = z.object({
  childId: z.string().cuid('Invalid child ID format'),
  vehicleAssignmentId: z.string().cuid('Invalid vehicle assignment ID format'),
});

const UpdateDriverSchema = z.object({
  driverId: z.string().cuid('Invalid driver ID format').nullable(),
});

const VehicleIdSchema = z.object({
  vehicleId: z.string().cuid('Invalid vehicle ID format'),
});

const UpdateSeatOverrideSchema = z.object({
  seatOverride: z.number().int().min(0).max(VEHICLE_CONSTRAINTS.MAX_CAPACITY).optional(),
});

// Routes

// Create schedule slot with vehicle for a group
router.post(
  '/groups/:groupId/schedule-slots',
  validateParams(GroupParamsSchema),
  validateBody(CreateScheduleSlotWithVehicleSchema),
  asyncHandler(scheduleSlotController.createScheduleSlotWithVehicle),
);

// Get schedule for a group (with optional date range)
router.get(
  '/groups/:groupId/schedule',
  validateParams(GroupParamsSchema),
  validateQuery(DateRangeQuerySchema),
  asyncHandler(scheduleSlotController.getSchedule),
);

// Get schedule slot details
router.get(
  '/schedule-slots/:scheduleSlotId',
  validateParams(ScheduleSlotParamsSchema),
  asyncHandler(scheduleSlotController.getScheduleSlotDetails),
);

// Assign vehicle to schedule slot
router.post(
  '/schedule-slots/:scheduleSlotId/vehicles',
  validateParams(ScheduleSlotParamsSchema),
  validateBody(AssignVehicleSchema),
  asyncHandler(scheduleSlotController.assignVehicleToSlot),
);

// Remove vehicle from schedule slot
router.delete(
  '/schedule-slots/:scheduleSlotId/vehicles',
  validateParams(ScheduleSlotParamsSchema),
  validateBody(VehicleIdSchema),
  asyncHandler(scheduleSlotController.removeVehicleFromSlot),
);

// Update vehicle driver assignment
router.patch(
  '/schedule-slots/:scheduleSlotId/vehicles/:vehicleId/driver',
  validateParams(z.object({
    scheduleSlotId: z.string().cuid('Invalid schedule slot ID format'),
    vehicleId: z.string().cuid('Invalid vehicle ID format'),
  })),
  validateBody(UpdateDriverSchema),
  asyncHandler(scheduleSlotController.updateVehicleDriver),
);

// Assign child to schedule slot (NEW METHOD)
router.post(
  '/schedule-slots/:scheduleSlotId/children',
  validateParams(ScheduleSlotParamsSchema),
  validateBody(AssignChildSchema),
  asyncHandler(scheduleSlotController.assignChildToScheduleSlot),
);

// Remove child from schedule slot (NEW METHOD)
router.delete(
  '/schedule-slots/:scheduleSlotId/children/:childId',
  validateParams(z.object({
    scheduleSlotId: z.string().cuid('Invalid schedule slot ID format'),
    childId: z.string().cuid('Invalid child ID format'),
  })),
  asyncHandler(scheduleSlotController.removeChildFromScheduleSlot),
);

// Get available children for schedule slot (NEW ENDPOINT)
router.get(
  '/schedule-slots/:scheduleSlotId/available-children',
  validateParams(ScheduleSlotParamsSchema),
  asyncHandler(scheduleSlotController.getAvailableChildrenForSlot),
);

// Get schedule slot conflicts
router.get(
  '/schedule-slots/:scheduleSlotId/conflicts',
  validateParams(ScheduleSlotParamsSchema),
  asyncHandler(scheduleSlotController.getScheduleSlotConflicts),
);

// Update seat override for vehicle assignment
router.patch(
  '/vehicle-assignments/:vehicleAssignmentId/seat-override',
  validateParams(z.object({
    vehicleAssignmentId: z.string().cuid('Invalid vehicle assignment ID format'),
  })),
  validateBody(UpdateSeatOverrideSchema),
  asyncHandler(scheduleSlotController.updateSeatOverride),
);

export default router;