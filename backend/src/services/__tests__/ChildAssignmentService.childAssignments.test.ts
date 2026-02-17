import { ChildAssignmentService } from '../ChildAssignmentService';

// Mock Prisma
jest.mock('@prisma/client');
const mockPrisma = {
  child: {
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  scheduleSlot: {
    findUnique: jest.fn(),
  },
  familyMember: {
    findFirst: jest.fn(),
  },
  group: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  groupFamilyMember: {
    findFirst: jest.fn(),
  },
  scheduleSlotChild: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  scheduleSlotVehicle: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
} as any;

// Mock ActivityLogRepository
jest.mock('../../repositories/ActivityLogRepository', () => ({
  ActivityLogRepository: jest.fn().mockImplementation(() => ({
    createActivity: jest.fn().mockResolvedValue({ id: 'activity-id' }),
  })),
}));

describe('ChildAssignmentService - Cross-family carpooling', () => {
  let service: ChildAssignmentService;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock transaction to execute callback immediately
    mockPrisma.$transaction = jest.fn(async (fn: any, _options?: any) => {
      return fn(mockPrisma);
    });
    service = new ChildAssignmentService(mockPrisma);
  });

  describe('assignChildToScheduleSlot', () => {
    it('should call create with childAssignments in vehicleAssignment include', async () => {
      // Setup minimal mocks
      mockPrisma.child.findUnique.mockResolvedValue({
        id: 'child-id',
        name: 'Test Child',
        familyId: 'family-id',
        family: {
          id: 'family-id',
          members: [{ userId: 'user-id' }],
        },
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        timezone: 'Europe/Paris',
      });

      mockPrisma.scheduleSlot.findUnique.mockResolvedValue({
        id: 'slot-id',
        groupId: 'group-id',
        datetime: new Date(Date.now() + 86400000),
      });

      mockPrisma.familyMember.findFirst.mockResolvedValue({
        familyId: 'family-id',
        userId: 'user-id',
      });

      mockPrisma.group.findFirst.mockResolvedValue({
        id: 'group-id',
        familyId: 'family-id',
      });

      mockPrisma.scheduleSlotVehicle.findUnique.mockResolvedValue({
        id: 'vehicle-assignment-id',
        scheduleSlotId: 'slot-id',
        vehicleId: 'vehicle-id',
        vehicle: {
          id: 'vehicle-id',
          name: 'Toyota Sienna',
          capacity: 6,
        },
        seatOverride: null,
        childAssignments: [], // Empty, so capacity check passes
      });

      mockPrisma.scheduleSlotChild.findUnique.mockResolvedValue(null);

      // Mock successful create with full response including childAssignments
      mockPrisma.scheduleSlotChild.create.mockResolvedValue({
        id: 'assignment-id',
        childId: 'child-id',
        scheduleSlotId: 'slot-id',
        vehicleAssignmentId: 'vehicle-assignment-id',
        child: {
          id: 'child-id',
          name: 'Test Child',
          age: 8,
          familyId: 'family-id',
        },
        scheduleSlot: { id: 'slot-id' },
        vehicleAssignment: {
          id: 'vehicle-assignment-id',
          vehicleId: 'vehicle-id',
          driverId: 'driver-id',
          vehicle: {
            id: 'vehicle-id',
            name: 'Toyota Sienna',
            capacity: 6,
            familyId: 'family-id',
          },
          driver: {
            id: 'driver-id',
            name: 'Driver',
            email: 'driver@test.com',
          },
          childAssignments: [
            {
              id: 'ca1',
              childId: 'child-id',
              child: {
                id: 'child-id',
                name: 'Test Child',
                age: 8,
                familyId: 'family-id',
              },
            },
          ],
        },
      });

      // Execute
      await service.assignChildToScheduleSlot(
        'slot-id',
        'child-id',
        'vehicle-assignment-id',
        'user-id',
      );

      // Verify the structure includes childAssignments
      expect(mockPrisma.scheduleSlotChild.create).toHaveBeenCalledTimes(1);
      const args: any = mockPrisma.scheduleSlotChild.create.mock.calls[0][0];

      // Check that include is defined and has the right structure
      expect(args.include).toBeTruthy();
      expect(args.include.vehicleAssignment).toBeTruthy();
      expect(args.include.vehicleAssignment.include).toBeTruthy();
      expect(args.include.vehicleAssignment.include.childAssignments).toBeTruthy();
    });
  });
});
