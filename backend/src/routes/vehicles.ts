import { Router } from 'express';
import { createVehicleController } from '../controllers/VehicleController';
import { validateParams, validateQuery, validateBody } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import {
  VehicleParamsSchema,
  AvailableVehiclesParamsSchema,
  WeekQuerySchema,
  CreateVehicleSchema,
  UpdateVehicleSchema,
} from '../schemas/vehicles';

const vehicleController = createVehicleController();
const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Create vehicle
router.post(
  '/',
  validateBody(CreateVehicleSchema),
  asyncHandler(vehicleController.createVehicle),
);

// Get user's vehicles
router.get('/', asyncHandler(vehicleController.getVehicles));

// Get available vehicles for a specific time slot
router.get('/available/:groupId/:timeSlotId',
  validateParams(AvailableVehiclesParamsSchema),
  asyncHandler(vehicleController.getAvailableVehicles),
);

// Get specific vehicle
router.get('/:vehicleId',
  validateParams(VehicleParamsSchema),
  asyncHandler(vehicleController.getVehicle),
);

// Update vehicle
router.patch('/:vehicleId',
  validateParams(VehicleParamsSchema),
  validateBody(UpdateVehicleSchema),
  asyncHandler(vehicleController.updateVehicle),
);

// Delete vehicle
router.delete('/:vehicleId',
  validateParams(VehicleParamsSchema),
  asyncHandler(vehicleController.deleteVehicle),
);

// Get vehicle's schedule
router.get('/:vehicleId/schedule',
  validateParams(VehicleParamsSchema),
  validateQuery(WeekQuerySchema),
  asyncHandler(vehicleController.getVehicleSchedule),
);

export default router;