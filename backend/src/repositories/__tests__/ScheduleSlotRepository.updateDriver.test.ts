import { ScheduleSlotRepository } from '../../repositories/ScheduleSlotRepository';

// Mock Prisma
jest.mock('@prisma/client');
const mockPrisma = {
  scheduleSlotVehicle: {
    update: jest.fn(),
  },
} as any;

describe('ScheduleSlotRepository - Cross-family carpooling', () => {
  let repo: ScheduleSlotRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repo = new ScheduleSlotRepository(mockPrisma);
  });

  describe('updateVehicleDriver', () => {
    it('should call update with childAssignments in vehicleAssignment include', async () => {
      // Mock successful update with full response including childAssignments
      mockPrisma.scheduleSlotVehicle.update.mockResolvedValue({
        id: 'vehicle-assignment-id',
        vehicleId: 'vehicle-id',
        driverId: 'new-driver-id',
        vehicle: {
          id: 'vehicle-id',
          name: 'Toyota Sienna',
          capacity: 6,
          familyId: 'family-id',
        },
        driver: {
          id: 'new-driver-id',
          name: 'New Driver',
          email: 'new-driver@test.com',
        },
        childAssignments: [
          {
            id: 'ca1',
            childId: 'child1-id',
            child: {
              id: 'child1-id',
              name: 'Child 1',
              age: 8,
              familyId: 'family1-id',
            },
          },
          {
            id: 'ca2',
            childId: 'child2-id',
            child: {
              id: 'child2-id',
              name: 'Child 2',
              age: 9,
              familyId: 'family2-id',
            },
          },
        ],
      });

      // Execute
      await repo.updateVehicleDriver('slot-id', 'vehicle-id', 'new-driver-id');

      // Verify the structure includes childAssignments
      expect(mockPrisma.scheduleSlotVehicle.update).toHaveBeenCalledTimes(1);
      const args: any = mockPrisma.scheduleSlotVehicle.update.mock.calls[0][0];

      // Check that include is defined and has the right structure
      expect(args.include).toBeTruthy();
      expect(args.include.vehicle).toBeTruthy();
      expect(args.include.driver).toBeTruthy();
      expect(args.include.childAssignments).toBeTruthy();
    });
  });
});
