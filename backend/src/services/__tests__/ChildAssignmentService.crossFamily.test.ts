// backend/src/services/__tests__/ChildAssignmentService.crossFamily.test.ts
import { prisma } from '../../../tests/setup';
import { ChildAssignmentService } from '../ChildAssignmentService';
import { PrismaClient } from '@prisma/client';

describe('POST /schedule-slots/:id/children - Cross-family carpooling', () => {
  let testData: {
    slotId: string;
    vehicleAssignmentId: string;
    family1ChildId: string;
    family2ChildId: string;
    family1UserId: string;
    family2UserId: string;
    groupId: string;
  };

  beforeEach(async () => {
    // Create family1
    const user1 = await prisma.user.create({
      data: { email: `user1-${Date.now()}@test.com`, name: 'User 1', timezone: 'Europe/Paris' },
    });
    const family1 = await prisma.family.create({
      data: { name: 'Family 1' },
    });
    await prisma.familyMember.create({
      data: { userId: user1.id, familyId: family1.id, role: 'ADMIN', joinedAt: new Date() },
    });
    const child1 = await prisma.child.create({
      data: { name: 'Child 1', age: 8, familyId: family1.id },
    });

    // Create family2
    const user2 = await prisma.user.create({
      data: { email: `user2-${Date.now()}@test.com`, name: 'User 2', timezone: 'Europe/Paris' },
    });
    const family2 = await prisma.family.create({
      data: { name: 'Family 2' },
    });
    await prisma.familyMember.create({
      data: { userId: user2.id, familyId: family2.id, role: 'ADMIN', joinedAt: new Date() },
    });
    const child2 = await prisma.child.create({
      data: { name: 'Child 2', age: 9, familyId: family2.id },
    });

    // Create group with family1 as owner, family2 as member
    const group = await prisma.group.create({
      data: {
        name: 'Test Group',
        familyId: family1.id,
        inviteCode: 'TESTCODE',
      },
    });
    await prisma.groupFamilyMember.create({
      data: {
        groupId: group.id,
        familyId: family2.id,
        role: 'MEMBER',
        addedBy: user1.id,
        joinedAt: new Date(),
      },
    });

    // Create vehicle for family1
    const vehicle = await prisma.vehicle.create({
      data: { name: 'Toyota Sienna', capacity: 6, familyId: family1.id },
    });

    // Create schedule slot with vehicle
    const slot = await prisma.scheduleSlot.create({
      data: {
        groupId: group.id,
        datetime: new Date(Date.now() + 86400000), // Tomorrow
      },
    });

    const vehicleAssignment = await prisma.scheduleSlotVehicle.create({
      data: {
        scheduleSlotId: slot.id,
        vehicleId: vehicle.id,
        driverId: user1.id,
      },
    });

    testData = {
      slotId: slot.id,
      vehicleAssignmentId: vehicleAssignment.id,
      family1ChildId: child1.id,
      family2ChildId: child2.id,
      family1UserId: user1.id,
      family2UserId: user2.id,
      groupId: group.id,
    };
  });

  afterEach(async () => {
    const tables = [
      'scheduleSlotChild',
      'scheduleSlotVehicle',
      'scheduleSlot',
      'child',
      'vehicle',
      'groupFamilyMember',
      'group',
      'familyMember',
      'family',
      'user',
    ];

    for (const table of tables) {
      try {
        await (prisma as any)[table].deleteMany({});
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('should return VehicleAssignment with ALL childAssignments after assigning child', async () => {
    const prismaClient = new PrismaClient();
    const service = new ChildAssignmentService(prismaClient);

    // Family1 assigns first child
    const result1 = await service.assignChildToScheduleSlot(
      testData.slotId,
      testData.family1ChildId,
      testData.vehicleAssignmentId,
      testData.family1UserId
    );

    // ASSERT: Response includes vehicleAssignment with childAssignments
    expect(result1.vehicleAssignment).toBeDefined();
    expect((result1.vehicleAssignment as any).childAssignments).toBeDefined();
    expect((result1.vehicleAssignment as any).childAssignments).toHaveLength(1);
    expect((result1.vehicleAssignment as any).childAssignments[0].childId).toBe(testData.family1ChildId);

    // Family2 assigns second child
    const result2 = await service.assignChildToScheduleSlot(
      testData.slotId,
      testData.family2ChildId,
      testData.vehicleAssignmentId,
      testData.family2UserId
    );

    // CRITICAL ASSERT: Response includes BOTH children in vehicleAssignment.childAssignments
    expect(result2.vehicleAssignment).toBeDefined();
    expect((result2.vehicleAssignment as any).childAssignments).toBeDefined();
    expect((result2.vehicleAssignment as any).childAssignments).toHaveLength(2);

    const childIds = (result2.vehicleAssignment as any).childAssignments.map((ca: any) => ca.childId);
    expect(childIds).toContain(testData.family1ChildId);
    expect(childIds).toContain(testData.family2ChildId);
  });
});
