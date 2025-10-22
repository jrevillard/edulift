import { Router } from 'express';
import { createVehicleController } from '../controllers/VehicleController';
import { validateParams, validateQuery } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { z } from 'zod';

const vehicleController = createVehicleController();
const router = Router();

// Validation schemas
const VehicleParamsSchema = z.object({
  vehicleId: z.string().cuid('Invalid vehicle ID format')
});

const AvailableVehiclesParamsSchema = z.object({
  groupId: z.string().cuid('Invalid group ID format'),
  timeSlotId: z.string().cuid('Invalid time slot ID format')
});

const WeekQuerySchema = z.object({
  week: z.string().optional()
});

// All routes require authentication
router.use(authenticateToken);

// Create vehicle
router.post('/', asyncHandler(vehicleController.createVehicle));

// Get user's vehicles
router.get('/', asyncHandler(vehicleController.getVehicles));

// Get available vehicles for a specific time slot
router.get('/available/:groupId/:timeSlotId',
  validateParams(AvailableVehiclesParamsSchema),
  asyncHandler(vehicleController.getAvailableVehicles)
);

// Get specific vehicle
router.get('/:vehicleId', 
  validateParams(VehicleParamsSchema),
  asyncHandler(vehicleController.getVehicle)
);

// Update vehicle
router.patch('/:vehicleId', 
  validateParams(VehicleParamsSchema),
  asyncHandler(vehicleController.updateVehicle)
);

// Delete vehicle
router.delete('/:vehicleId', 
  validateParams(VehicleParamsSchema),
  asyncHandler(vehicleController.deleteVehicle)
);

// Get vehicle's schedule
router.get('/:vehicleId/schedule', 
  validateParams(VehicleParamsSchema),
  validateQuery(WeekQuerySchema),
  asyncHandler(vehicleController.getVehicleSchedule)
);

export default router;