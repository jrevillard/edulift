import { Router } from 'express';
import { createChildController } from '../controllers/ChildController';
import { validateParams, validateQuery } from '../middleware/validation';
import { authenticateToken } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { z } from 'zod';

const childController = createChildController();
const router = Router();

// Validation schemas
const ChildParamsSchema = z.object({
  childId: z.string().cuid('Invalid child ID format')
});

const WeekQuerySchema = z.object({
  week: z.string().optional()
});

// All routes require authentication
router.use(authenticateToken);

// Create child
router.post('/', asyncHandler(childController.createChild));

// Get user's children
router.get('/', asyncHandler(childController.getChildren));

// Get specific child
router.get('/:childId', 
  validateParams(ChildParamsSchema),
  asyncHandler(childController.getChild)
);

// Update child - support both PUT and PATCH methods
router.put('/:childId', 
  validateParams(ChildParamsSchema),
  asyncHandler(childController.updateChild)
);

router.patch('/:childId', 
  validateParams(ChildParamsSchema),
  asyncHandler(childController.updateChild)
);

// Delete child
router.delete('/:childId', 
  validateParams(ChildParamsSchema),
  asyncHandler(childController.deleteChild)
);

// Get child's trip assignments
router.get('/:childId/assignments', 
  validateParams(ChildParamsSchema),
  validateQuery(WeekQuerySchema),
  asyncHandler(childController.getChildAssignments)
);

// Group membership routes
router.post('/:childId/groups/:groupId',
  validateParams(z.object({
    childId: z.string().cuid('Invalid child ID format'),
    groupId: z.string().cuid('Invalid group ID format')
  })),
  asyncHandler(childController.addChildToGroup)
);

router.delete('/:childId/groups/:groupId',
  validateParams(z.object({
    childId: z.string().cuid('Invalid child ID format'),
    groupId: z.string().cuid('Invalid group ID format')
  })),
  asyncHandler(childController.removeChildFromGroup)
);

router.get('/:childId/groups',
  validateParams(ChildParamsSchema),
  asyncHandler(childController.getChildGroupMemberships)
);

export default router;