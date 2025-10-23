import { ChildAssignmentService } from '../ChildAssignmentService';
import { AppError } from '../../middleware/errorHandler';

// Mock Prisma
jest.mock('@prisma/client');
const mockPrisma = {
  child: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  scheduleSlot: {
    findUnique: jest.fn(),
  },
  group: {
    findFirst: jest.fn(),
  },
  groupFamilyMember: {
    findUnique: jest.fn(),
  },
  familyMember: {
    findFirst: jest.fn(),
  },
  groupChildMember: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  },
  scheduleSlotChild: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
  scheduleSlotVehicle: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
  },
} as any;

// Mock ActivityLogRepository
jest.mock('../../repositories/ActivityLogRepository', () => ({
  ActivityLogRepository: jest.fn().mockImplementation(() => ({
    createActivity: jest.fn().mockResolvedValue({ id: 'activity-id' }),
  })),
}));

describe('ChildAssignmentService', () => {
  let service: ChildAssignmentService;

  beforeEach(() => {
    service = new ChildAssignmentService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('addChildToGroup', () => {
    it('should fail when child does not belong to user family', async () => {
      // Child exists but user is not a family member
      mockPrisma.child.findUnique.mockResolvedValue({
        id: 'child-id',
        family: {
          members: [], // User not in family
        },
      });

      await expect(
        service.addChildToGroup('child-id', 'group-id', 'user-id'),
      ).rejects.toThrow('Child not found or permission denied');
    });

    it('should fail when user family is not group member', async () => {
      mockPrisma.child.findUnique.mockResolvedValue({
        id: 'child-id',
        family: {
          id: 'family-id',
          members: [{ userId: 'user-id' }], // User is family member
        },
      });
      
      // Mock user's family membership
      mockPrisma.familyMember.findFirst.mockResolvedValue({
        familyId: 'family-id',
        userId: 'user-id',
      });
      
      // Mock group without family access
      mockPrisma.group.findFirst.mockResolvedValue(null);

      await expect(
        service.addChildToGroup('child-id', 'group-id', 'user-id'),
      ).rejects.toThrow('User\'s family must have access to group');
    });

    it('should add child to group successfully', async () => {
      const mockChild = {
        id: 'child-id',
        family: {
          id: 'family-id',
          members: [{ userId: 'user-id' }],
        },
      };
      const mockFamilyMember = { familyId: 'family-id', userId: 'user-id' };
      const mockGroup = { id: 'group-id', familyId: 'family-id' };
      const mockChildGroupMember = {
        childId: 'child-id',
        groupId: 'group-id',
        child: { name: 'Test Child' },
        group: { name: 'Test Group' },
      };

      mockPrisma.child.findUnique.mockResolvedValue(mockChild);
      mockPrisma.familyMember.findFirst.mockResolvedValue(mockFamilyMember);
      mockPrisma.group.findFirst.mockResolvedValue(mockGroup);
      mockPrisma.groupChildMember.findUnique.mockResolvedValue(null);
      mockPrisma.groupChildMember.create.mockResolvedValue(mockChildGroupMember);

      const result = await service.addChildToGroup('child-id', 'group-id', 'user-id');

      expect(result).toEqual(mockChildGroupMember);
      expect(mockPrisma.groupChildMember.create).toHaveBeenCalledWith({
        data: {
          childId: 'child-id',
          groupId: 'group-id',
          addedBy: 'user-id',
        },
        include: {
          child: true,
          group: true,
        },
      });
    });
  });

  describe('assignChildToScheduleSlot', () => {
    it('should fail when capacity is exceeded', async () => {
      // Mock transaction wrapper
      mockPrisma.$transaction = jest.fn(async (fn) => {
        return fn(mockPrisma);
      });

      const mockChild = {
        id: 'child-id',
        family: {
          id: 'family-id',
          members: [{ userId: 'user-id' }],
        },
      };
      const mockScheduleSlot = {
        id: 'slot-id',
        groupId: 'group-id',
        datetime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow - future date
      };
      const mockFamilyMember = { familyId: 'family-id', userId: 'user-id' };
      const mockGroup = { id: 'group-id', familyId: 'family-id' };
      const mockVehicleAssignment = {
        id: 'vehicle-assignment-id',
        scheduleSlotId: 'slot-id',
        seatOverride: null,
        vehicle: { capacity: 4, name: 'Test Vehicle' },
        childAssignments: [
          { id: 'assignment1' },
          { id: 'assignment2' },
          { id: 'assignment3' },
          { id: 'assignment4' },
        ], // Already 4 children
      };

      mockPrisma.child.findUnique.mockResolvedValue(mockChild);
      mockPrisma.scheduleSlot.findUnique.mockResolvedValue(mockScheduleSlot);
      mockPrisma.familyMember.findFirst.mockResolvedValue(mockFamilyMember);
      mockPrisma.group.findFirst.mockResolvedValue(mockGroup);
      mockPrisma.scheduleSlotVehicle.findUnique.mockResolvedValue(mockVehicleAssignment);

      await expect(
        service.assignChildToScheduleSlot('slot-id', 'child-id', 'vehicle-assignment-id', 'user-id'),
      ).rejects.toThrow('Vehicle Test Vehicle is at full capacity (4/4)');
    });

    it('should respect seat override when checking capacity', async () => {
      // Mock transaction wrapper
      mockPrisma.$transaction = jest.fn(async (fn) => {
        return fn(mockPrisma);
      });

      const mockChild = {
        id: 'child-id',
        family: {
          id: 'family-id',
          members: [{ userId: 'user-id' }],
        },
      };
      const mockScheduleSlot = {
        id: 'slot-id',
        groupId: 'group-id',
        datetime: new Date(Date.now() + 24 * 60 * 60 * 1000),
      };
      const mockFamilyMember = { familyId: 'family-id', userId: 'user-id' };
      const mockGroup = { id: 'group-id', familyId: 'family-id' };
      const mockVehicleAssignment = {
        id: 'vehicle-assignment-id',
        scheduleSlotId: 'slot-id',
        seatOverride: 6, // Override to 6 seats (base capacity is 4)
        vehicle: { capacity: 4, name: 'Test Vehicle' },
        childAssignments: [
          { id: 'assignment1' },
          { id: 'assignment2' },
          { id: 'assignment3' },
          { id: 'assignment4' },
          { id: 'assignment5' },
        ], // 5 children assigned
      };
      const mockAssignment = {
        scheduleSlotId: 'slot-id',
        childId: 'child-id',
        vehicleAssignmentId: 'vehicle-assignment-id',
        child: { name: 'Test Child' },
        scheduleSlot: mockScheduleSlot,
        vehicleAssignment: mockVehicleAssignment,
      };

      mockPrisma.child.findUnique.mockResolvedValue(mockChild);
      mockPrisma.scheduleSlot.findUnique.mockResolvedValue(mockScheduleSlot);
      mockPrisma.familyMember.findFirst.mockResolvedValue(mockFamilyMember);
      mockPrisma.group.findFirst.mockResolvedValue(mockGroup);
      mockPrisma.scheduleSlotVehicle.findUnique.mockResolvedValue(mockVehicleAssignment);
      mockPrisma.scheduleSlotChild.findUnique.mockResolvedValue(null);
      mockPrisma.scheduleSlotChild.create.mockResolvedValue(mockAssignment);

      // Should succeed because seatOverride is 6 and only 5 are assigned
      const result = await service.assignChildToScheduleSlot('slot-id', 'child-id', 'vehicle-assignment-id', 'user-id');

      expect(result).toEqual(mockAssignment);
    });

    it('should fail when schedule slot is in the past', async () => {
      // Mock transaction wrapper
      mockPrisma.$transaction = jest.fn(async (fn) => {
        return fn(mockPrisma);
      });

      const mockChild = {
        id: 'child-id',
        family: {
          id: 'family-id',
          members: [{ userId: 'user-id' }],
        },
      };
      const mockScheduleSlot = {
        id: 'slot-id',
        groupId: 'group-id',
        datetime: new Date('2023-01-01T08:00:00.000Z'), // Past date
      };

      mockPrisma.child.findUnique.mockResolvedValue(mockChild);
      mockPrisma.scheduleSlot.findUnique.mockResolvedValue(mockScheduleSlot);

      await expect(
        service.assignChildToScheduleSlot('slot-id', 'child-id', 'vehicle-assignment-id', 'user-id'),
      ).rejects.toThrow('Cannot assign children to schedule slots in the past');
    });

    it('should assign child to schedule slot successfully', async () => {
      // Mock transaction wrapper
      mockPrisma.$transaction = jest.fn(async (fn) => {
        return fn(mockPrisma);
      });

      const mockChild = {
        id: 'child-id',
        family: {
          id: 'family-id',
          members: [{ userId: 'user-id' }],
        },
      };
      const mockScheduleSlot = {
        id: 'slot-id',
        groupId: 'group-id',
        datetime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow - future date
      };
      const mockFamilyMember = { familyId: 'family-id', userId: 'user-id' };
      const mockGroup = { id: 'group-id', familyId: 'family-id' };
      const mockVehicleAssignment = {
        id: 'vehicle-assignment-id',
        scheduleSlotId: 'slot-id',
        seatOverride: null,
        vehicle: { capacity: 4, name: 'Test Vehicle' },
        childAssignments: [{ id: 'assignment1' }, { id: 'assignment2' }], // 2 children
      };
      const mockAssignment = {
        scheduleSlotId: 'slot-id',
        childId: 'child-id',
        vehicleAssignmentId: 'vehicle-assignment-id',
        child: { name: 'Test Child' },
        scheduleSlot: mockScheduleSlot,
        vehicleAssignment: mockVehicleAssignment,
      };

      mockPrisma.child.findUnique.mockResolvedValue(mockChild);
      mockPrisma.scheduleSlot.findUnique.mockResolvedValue(mockScheduleSlot);
      mockPrisma.familyMember.findFirst.mockResolvedValue(mockFamilyMember);
      mockPrisma.group.findFirst.mockResolvedValue(mockGroup);
      mockPrisma.scheduleSlotVehicle.findUnique.mockResolvedValue(mockVehicleAssignment);
      mockPrisma.scheduleSlotChild.findUnique.mockResolvedValue(null);
      mockPrisma.scheduleSlotChild.create.mockResolvedValue(mockAssignment);

      const result = await service.assignChildToScheduleSlot('slot-id', 'child-id', 'vehicle-assignment-id', 'user-id');

      expect(result).toEqual(mockAssignment);
      expect(mockPrisma.scheduleSlotChild.create).toHaveBeenCalledWith({
        data: {
          scheduleSlotId: 'slot-id',
          childId: 'child-id',
          vehicleAssignmentId: 'vehicle-assignment-id',
        },
        include: {
          child: true,
          scheduleSlot: true,
          vehicleAssignment: {
            include: { vehicle: true },
          },
        },
      });
    });
  });

  describe('getAvailableChildrenForScheduleSlot', () => {
    it('should return only eligible children', async () => {
      const mockScheduleSlot = { 
        id: 'slot-id', 
        groupId: 'group-id',
        datetime: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow - future date
      };
      const mockChildren = [
        { id: 'child1', name: 'Child 1', groupMemberships: [{ groupId: 'group-id' }] },
        { id: 'child2', name: 'Child 2', groupMemberships: [{ groupId: 'group-id' }] },
      ];
      const mockAssignedChildren = [{ childId: 'child1' }];

      mockPrisma.scheduleSlot.findUnique.mockResolvedValue(mockScheduleSlot);
      mockPrisma.child.findMany.mockResolvedValue(mockChildren);
      mockPrisma.scheduleSlotChild.findMany.mockResolvedValue(mockAssignedChildren);

      const result = await service.getAvailableChildrenForScheduleSlot('slot-id', 'user-id');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('child2');
      
      // Verify the query was updated to use family-based relationship
      expect(mockPrisma.child.findMany).toHaveBeenCalledWith({
        where: {
          family: {
            members: {
              some: { userId: 'user-id' },
            },
          },
          groupMemberships: {
            some: {
              groupId: 'group-id',
            },
          },
        },
        include: {
          groupMemberships: true,
        },
      });
    });
  });

  describe('Race Condition Protection', () => {
    describe('Concurrent assignment prevention', () => {
      it('should prevent two parents from simultaneously assigning to the last seat', async () => {
        // Setup: Vehicle with capacity 4, already has 3 children assigned
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 7); // 7 days in the future

        const mockSlot = {
          id: 'slot-1',
          groupId: 'group-1',
          datetime: futureDate,
          group: { id: 'group-1', name: 'Test Group' },
        };

        const mockVehicle = {
          id: 'vehicle-1',
          name: 'School Bus',
          capacity: 4,
          familyId: 'family-1',
        };

        const mockVehicleAssignmentWithThreeChildren = {
          id: 'vehicle-assignment-1',
          scheduleSlotId: 'slot-1',
          vehicleId: 'vehicle-1',
          vehicle: mockVehicle,
          seatOverride: null,
          childAssignments: [
            { id: 'assignment-1', childId: 'child-1' },
            { id: 'assignment-2', childId: 'child-2' },
            { id: 'assignment-3', childId: 'child-3' },
          ],
        };

        // Mock Prisma to simulate SERIALIZABLE transaction behavior
        let assignmentCount = 3; // Track current assignments
        let transactionLock = Promise.resolve(); // Simulate SERIALIZABLE by forcing sequential execution

        mockPrisma.$transaction = jest.fn().mockImplementation(async (callback) => {
          // Wait for previous transaction to complete (SERIALIZABLE behavior)
          const currentLock = transactionLock;
          let releaseLock: () => void;
          transactionLock = new Promise(resolve => {
            releaseLock = resolve;
          });

          await currentLock;

          try {
            // Capture state at transaction start
            const snapshotCount = assignmentCount;
            const currentAssignments = Array.from(
              { length: snapshotCount },
              (_, i) => ({ id: `assignment-${i + 1}`, childId: `child-${i + 1}` }),
            );

            const vehicleAssignmentInTransaction = {
              ...mockVehicleAssignmentWithThreeChildren,
              childAssignments: currentAssignments,
            };

            // Mock transaction queries - need to handle different children
            const txMock = {
              child: {
                findUnique: jest.fn().mockImplementation(async ({ where }) => {
                  // Return appropriate child based on the ID being queried
                  return {
                    id: where.id,
                    family: { id: 'family-1', members: [{ userId: 'parent-a-user-id' }] },
                  };
                }),
              },
              user: {
                findUnique: jest.fn().mockResolvedValue({ id: 'parent-a-user-id', timezone: 'UTC' }),
              },
              scheduleSlot: {
                findUnique: jest.fn().mockResolvedValue(mockSlot),
              },
              familyMember: {
                findFirst: jest.fn().mockResolvedValue({
                  familyId: 'family-1',
                  userId: 'parent-a-user-id',
                }),
              },
              group: {
                findFirst: jest.fn().mockResolvedValue({ id: 'group-1', familyId: 'family-1' }),
              },
              scheduleSlotVehicle: {
                findUnique: jest.fn().mockResolvedValue(vehicleAssignmentInTransaction),
              },
              scheduleSlotChild: {
                findUnique: jest.fn().mockResolvedValue(null), // No existing assignment
                create: jest.fn().mockImplementation(async () => {
                  // Check capacity INSIDE transaction (SERIALIZABLE behavior)
                  const effectiveCapacity = vehicleAssignmentInTransaction.seatOverride
                    ?? vehicleAssignmentInTransaction.vehicle.capacity;

                  if (snapshotCount >= effectiveCapacity) {
                    throw new AppError(
                      `Vehicle ${vehicleAssignmentInTransaction.vehicle.name} is at full capacity (${snapshotCount}/${effectiveCapacity})`,
                      409,
                    );
                  }

                  // Success: increment global count (simulates commit)
                  assignmentCount++;
                  return {
                    id: `assignment-${assignmentCount}`,
                    scheduleSlotId: 'slot-1',
                    childId: `child-${assignmentCount}`,
                    vehicleAssignmentId: 'vehicle-assignment-1',
                  };
                }),
              },
            };

            const result = await callback(txMock as any);
            return result;
          } finally {
            releaseLock!();
          }
        });

        // Mock authorization and child lookup - handle both children
        mockPrisma.child.findUnique.mockImplementation(async ({ where }: any) => ({
          id: where.id,
          family: { id: 'family-1', members: [{ userId: 'parent-a-user-id' }] },
        }));
        mockPrisma.user.findUnique.mockResolvedValue({ id: 'parent-a-user-id', timezone: 'UTC' });
        mockPrisma.scheduleSlot.findUnique.mockResolvedValue(mockSlot);
        mockPrisma.familyMember.findFirst.mockImplementation(async ({ where }: any) => ({
          familyId: 'family-1',
          userId: where.userId,
        }));
        mockPrisma.group.findFirst.mockResolvedValue({ id: 'group-1', familyId: 'family-1' });

        // Act: Simulate 2 concurrent assignments (Parent A and Parent B)
        const assignmentPromises = [
          service.assignChildToScheduleSlot('slot-1', 'child-4', 'vehicle-assignment-1', 'parent-a-user-id'),
          service.assignChildToScheduleSlot('slot-1', 'child-5', 'vehicle-assignment-1', 'parent-b-user-id'),
        ];

        const results = await Promise.allSettled(assignmentPromises);

        // Assert: Exactly 1 success, 1 failure (409 Conflict)
        const successes = results.filter((r) => r.status === 'fulfilled');
        const failures = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

        expect(successes).toHaveLength(1);
        expect(failures).toHaveLength(1);

        // Verify the failure is a 409 Conflict
        const failedReason = failures[0].reason as any;
        expect(failedReason.message).toContain('full capacity');
        expect(failedReason.message).toContain('4/4');

        // Verify final state: exactly 4 children (not 5)
        expect(assignmentCount).toBe(4);
      });

      it('should handle seat override in race condition scenarios', async () => {
        // Setup: Vehicle capacity 4, seat override 5, already 4 assigned, 1 seat left
        const mockVehicleAssignmentWithOverride = {
          id: 'vehicle-assignment-1',
          scheduleSlotId: 'slot-1',
          vehicleId: 'vehicle-1',
          vehicle: { id: 'vehicle-1', name: 'Minivan', capacity: 4 },
          seatOverride: 5, // Override: can fit 5 instead of 4
          childAssignments: [
            { id: 'assignment-1' },
            { id: 'assignment-2' },
            { id: 'assignment-3' },
            { id: 'assignment-4' },
          ],
        };

        let assignmentCount = 4;
        let transactionLock = Promise.resolve(); // Simulate SERIALIZABLE by forcing sequential execution

        mockPrisma.$transaction = jest.fn().mockImplementation(async (callback) => {
          // Wait for previous transaction to complete (SERIALIZABLE behavior)
          const currentLock = transactionLock;
          let releaseLock: () => void;
          transactionLock = new Promise(resolve => {
            releaseLock = resolve;
          });

          await currentLock;

          try {
            // Capture state at transaction start
            const snapshotCount = assignmentCount;
            const currentAssignments = Array.from({ length: snapshotCount }, (_, i) => ({
              id: `assignment-${i + 1}`,
            }));

            const vehicleInTx = {
              ...mockVehicleAssignmentWithOverride,
              childAssignments: currentAssignments,
            };

            const futureSlotDate = new Date();
            futureSlotDate.setDate(futureSlotDate.getDate() + 7);

            const mockSlotForTest = {
              id: 'slot-1',
              groupId: 'group-1',
              datetime: futureSlotDate,
            };

            const txMock = {
              child: {
                findUnique: jest.fn().mockImplementation(async ({ where }) => ({
                  id: where.id,
                  family: { id: 'family-1', members: [{ userId: 'user-1' }] },
                })),
              },
              user: {
                findUnique: jest.fn().mockResolvedValue({ id: 'user-1', timezone: 'UTC' }),
              },
              scheduleSlot: {
                findUnique: jest.fn().mockResolvedValue(mockSlotForTest),
              },
              familyMember: {
                findFirst: jest.fn().mockResolvedValue({
                  familyId: 'family-1',
                  userId: 'user-1',
                }),
              },
              group: {
                findFirst: jest.fn().mockResolvedValue({ id: 'group-1', familyId: 'family-1' }),
              },
              scheduleSlotVehicle: {
                findUnique: jest.fn().mockResolvedValue(vehicleInTx),
              },
              scheduleSlotChild: {
                findUnique: jest.fn().mockResolvedValue(null),
                create: jest.fn().mockImplementation(async () => {
                  const effectiveCapacity = vehicleInTx.seatOverride ?? vehicleInTx.vehicle.capacity;

                  if (snapshotCount >= effectiveCapacity) {
                    throw new AppError(
                      `Vehicle ${vehicleInTx.vehicle.name} is at full capacity (${snapshotCount}/${effectiveCapacity})`,
                      409,
                    );
                  }

                  assignmentCount++;
                  return { id: `assignment-${assignmentCount}`, childId: `child-${assignmentCount}` };
                }),
              },
            };

            const result = await callback(txMock as any);
            return result;
          } finally {
            releaseLock!();
          }
        });

        mockPrisma.child.findUnique.mockImplementation(async ({ where }: any) => ({
          id: where.id,
          family: { id: 'family-1', members: [{ userId: 'user-1' }] },
        }));
        mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', timezone: 'UTC' });
        const futureTestDate = new Date();
        futureTestDate.setDate(futureTestDate.getDate() + 7);

        mockPrisma.scheduleSlot.findUnique.mockResolvedValue({
          id: 'slot-1',
          groupId: 'group-1',
          datetime: futureTestDate,
        });
        mockPrisma.familyMember.findFirst.mockImplementation(async ({ where }: any) => ({
          familyId: 'family-1',
          userId: where.userId,
        }));
        mockPrisma.group.findFirst.mockResolvedValue({ id: 'group-1', familyId: 'family-1' });

        // Act: 2 concurrent assignments for the last (5th) seat
        const results = await Promise.allSettled([
          service.assignChildToScheduleSlot('slot-1', 'child-5', 'vehicle-assignment-1', 'user-1'),
          service.assignChildToScheduleSlot('slot-1', 'child-6', 'vehicle-assignment-1', 'user-2'),
        ]);

        // Assert
        const successes = results.filter((r) => r.status === 'fulfilled');
        const failures = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

        expect(successes).toHaveLength(1);
        expect(failures).toHaveLength(1);
        expect((failures[0].reason as any).message).toContain('full capacity');

        // Verify capacity calculation used seatOverride (5, not 4)
        expect((failures[0].reason as any).message).toContain('5/5');
        expect(assignmentCount).toBe(5); // Exactly 5, not 6
      });
    });
  });
});