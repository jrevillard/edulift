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
import { validateBody, validateParams } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import {
  ScheduleSlotParamsSchema,
  VehicleAssignmentParamsSchema,
  ScheduleSlotVehicleParamsSchema,
  ScheduleSlotChildParamsSchema,
  AssignVehicleSchema,
  AssignChildSchema,
  UpdateDriverSchema,
  VehicleIdSchema,
  UpdateSeatOverrideSchema,
} from '../schemas/scheduleSlots';


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

// Validation schemas imported from ../schemas/scheduleSlots

// Routes

// Get schedule slot details
router.get(
  '/:scheduleSlotId',
  validateParams(ScheduleSlotParamsSchema),
  asyncHandler(scheduleSlotController.getScheduleSlotDetails),
);

// Assign vehicle to schedule slot
router.post(
  '/:scheduleSlotId/vehicles',
  validateParams(ScheduleSlotParamsSchema),
  validateBody(AssignVehicleSchema),
  asyncHandler(scheduleSlotController.assignVehicleToSlot),
);

// Remove vehicle from schedule slot
router.delete(
  '/:scheduleSlotId/vehicles',
  validateParams(ScheduleSlotParamsSchema),
  validateBody(VehicleIdSchema),
  asyncHandler(scheduleSlotController.removeVehicleFromSlot),
);

// Update vehicle driver assignment
router.patch(
  '/:scheduleSlotId/vehicles/:vehicleId/driver',
  validateParams(ScheduleSlotVehicleParamsSchema),
  validateBody(UpdateDriverSchema),
  asyncHandler(scheduleSlotController.updateVehicleDriver),
);

// Assign child to schedule slot (NEW METHOD)
router.post(
  '/:scheduleSlotId/children',
  validateParams(ScheduleSlotParamsSchema),
  validateBody(AssignChildSchema),
  asyncHandler(scheduleSlotController.assignChildToScheduleSlot),
);

// Remove child from schedule slot (NEW METHOD)
router.delete(
  '/:scheduleSlotId/children/:childId',
  validateParams(ScheduleSlotChildParamsSchema),
  asyncHandler(scheduleSlotController.removeChildFromScheduleSlot),
);

// Get available children for schedule slot (NEW ENDPOINT)
router.get(
  '/:scheduleSlotId/available-children',
  validateParams(ScheduleSlotParamsSchema),
  asyncHandler(scheduleSlotController.getAvailableChildrenForSlot),
);

// Get schedule slot conflicts
router.get(
  '/:scheduleSlotId/conflicts',
  validateParams(ScheduleSlotParamsSchema),
  asyncHandler(scheduleSlotController.getScheduleSlotConflicts),
);

// Update seat override for vehicle assignment
router.patch(
  '/vehicle-assignments/:vehicleAssignmentId/seat-override',
  validateParams(VehicleAssignmentParamsSchema),
  validateBody(UpdateSeatOverrideSchema),
  asyncHandler(scheduleSlotController.updateSeatOverride),
);

export default router;