# Cross-Family Carpooling - ChildAssignments API Fix

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix schedule endpoints to return ALL childAssignments for cross-family carpooling cache consistency

**Architecture:** Modify 4 API endpoints to return complete VehicleAssignment with all childAssignments instead of partial data. Ensure mobile app cache receives complete vehicle state after each operation.

**Tech Stack:** Node.js/TypeScript, Hono/OpenAPI, Prisma ORM, Jest

---

## Context

**Problem:** Mobile app cache loses childAssignments when multiple families share vehicles. When Owner assigns 2 children, then Admin assigns 2 children to same vehicle, backend returns only Admin's children. Mobile cache overwrites with partial data, losing Owner's children.

**Root Cause:** Four endpoints return partial data instead of complete VehicleAssignment with all childAssignments.

**Solution:** Modify endpoints to return complete slot or VehicleAssignment data with all childAssignments from all families.

---

## Task 1: Fix POST /schedule-slots/:id/children - Return complete VehicleAssignment

**Files:**
- Modify: `backend/src/services/ChildAssignmentService.ts:285-304`
- Create: `backend/tests/integration/childAssignment.crossFamily.test.ts`

**Step 1: Understand current behavior**

The service method at line 168 returns a ChildAssignment with vehicleAssignment relation, but vehicleAssignment does NOT include its childAssignments. Response only contains newly assigned child, not existing children in vehicle.

**Step 2: Write test for complete VehicleAssignment response**

Create test file using existing test patterns:

```typescript
// backend/tests/integration/childAssignment.crossFamily.test.ts
import { prisma } from '../tests/setup';
import { ChildAssignmentService } from '../../src/services/ChildAssignmentService';
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
      data: { userId: user1.id, familyId: family1.id, role: 'OWNER', joinedAt: new Date() },
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
      data: { userId: user2.id, familyId: family2.id, role: 'OWNER', joinedAt: new Date() },
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
    expect(result1.vehicleAssignment.childAssignments).toBeDefined();
    expect(result1.vehicleAssignment.childAssignments).toHaveLength(1);
    expect(result1.vehicleAssignment.childAssignments[0].childId).toBe(testData.family1ChildId);

    // Family2 assigns second child
    const result2 = await service.assignChildToScheduleSlot(
      testData.slotId,
      testData.family2ChildId,
      testData.vehicleAssignmentId,
      testData.family2UserId
    );

    // CRITICAL ASSERT: Response includes BOTH children in vehicleAssignment.childAssignments
    expect(result2.vehicleAssignment).toBeDefined();
    expect(result2.vehicleAssignment.childAssignments).toBeDefined();
    expect(result2.vehicleAssignment.childAssignments).toHaveLength(2);

    const childIds = result2.vehicleAssignment.childAssignments.map((ca: any) => ca.childId);
    expect(childIds).toContain(testData.family1ChildId);
    expect(childIds).toContain(testData.family2ChildId);
  });
});
```

**Step 3: Run test to verify it fails**

```bash
cd backend
npm test -- childAssignment.crossFamily.test.ts
```

Expected: FAIL - `vehicleAssignment.childAssignments` is undefined or only contains newly assigned child

**Step 4: Modify ChildAssignmentService.assignChildToScheduleSlot**

File: `backend/src/services/ChildAssignmentService.ts:285-304`

Change the `vehicleAssignment` include to add `childAssignments`:

```typescript
// BEFORE:
vehicleAssignment: {
  include: {
    vehicle: {
      select: {
        id: true,
        name: true,
        capacity: true,
        familyId: true,
        createdAt: true,
        updatedAt: true,
      },
    },
    driver: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
  },
}

// AFTER:
vehicleAssignment: {
  include: {
    vehicle: {
      select: {
        id: true,
        name: true,
        capacity: true,
        familyId: true,
        createdAt: true,
        updatedAt: true,
      },
    },
    driver: {
      select: {
        id: true,
        name: true,
        email: true,
      },
    },
    childAssignments: {  // ← ADD THIS
      include: {
        child: {
          select: {
            id: true,
            name: true,
            age: true,
            familyId: true,
          },
        },
      },
    },
  },
}
```

**Step 5: Run test to verify it passes**

```bash
cd backend
npm test -- childAssignment.crossFamily.test.ts
```

Expected: PASS - Response now includes all childAssignments for the vehicle

**Step 6: Commit**

```bash
git add backend/src/services/ChildAssignmentService.ts backend/tests/integration/childAssignment.crossFamily.test.ts
git commit -m "fix(childAssignment): return all childAssignments in vehicleAssignment on assign

Fixes cross-family carpooling cache issue where mobile app loses
existing child assignments when new child is assigned to same vehicle.

POST /schedule-slots/:id/children now returns complete VehicleAssignment
with all childAssignments from all families, not just newly assigned child.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Fix PUT /schedule-slots/:id/vehicles/:id/driver - Return VehicleAssignment with childAssignments

**Files:**
- Modify: `backend/src/repositories/ScheduleSlotRepository.ts:238-248`
- Modify: `backend/tests/integration/scheduleSlot.crossFamily.test.ts`

**Step 1: Add test to existing file**

Add to `backend/tests/integration/scheduleSlot.crossFamily.test.ts`:

```typescript
describe('PUT /schedule-slots/:id/vehicles/:id/driver - Cross-family', () => {
  let testData: any;

  beforeEach(async () => {
    // Setup similar to Task 1, with 2 children from different families already assigned
    const user1 = await prisma.user.create({
      data: { email: `user1-${Date.now()}@test.com`, name: 'User 1', timezone: 'Europe/Paris' },
    });
    const user2 = await prisma.user.create({
      data: { email: `user2-${Date.now()}@test.com`, name: 'User 2', timezone: 'Europe/Paris' },
    });
    const family1 = await prisma.family.create({ data: { name: 'Family 1' } });
    const family2 = await prisma.family.create({ data: { name: 'Family 2' } });

    await prisma.familyMember.create({
      data: { userId: user1.id, familyId: family1.id, role: 'OWNER', joinedAt: new Date() },
    });
    await prisma.familyMember.create({
      data: { userId: user2.id, familyId: family2.id, role: 'OWNER', joinedAt: new Date() },
    });

    const child1 = await prisma.child.create({
      data: { name: 'Child 1', age: 8, familyId: family1.id },
    });
    const child2 = await prisma.child.create({
      data: { name: 'Child 2', age: 9, familyId: family2.id },
    });

    const group = await prisma.group.create({
      data: { name: 'Test Group', familyId: family1.id, inviteCode: 'TEST' },
    });
    await prisma.groupFamilyMember.create({
      data: { groupId: group.id, familyId: family2.id, role: 'MEMBER', addedBy: user1.id, joinedAt: new Date() },
    });

    const vehicle = await prisma.vehicle.create({
      data: { name: 'Toyota Sienna', capacity: 6, familyId: family1.id },
    });

    const slot = await prisma.scheduleSlot.create({
      data: {
        groupId: group.id,
        datetime: new Date(Date.now() + 86400000),
      },
    });

    const vehicleAssignment = await prisma.scheduleSlotVehicle.create({
      data: {
        scheduleSlotId: slot.id,
        vehicleId: vehicle.id,
        driverId: user1.id,
        childAssignments: [
          { childId: child1.id },
          { childId: child2.id },
        ],
      },
    });

    testData = {
      slotId: slot.id,
      vehicleId: vehicle.id,
      vehicleAssignmentId: vehicleAssignment.id,
      newDriverId: user2.id,
      family1ChildId: child1.id,
      family2ChildId: child2.id,
    };
  });

  afterEach(async () => {
    const tables = [
      'scheduleSlotChild', 'scheduleSlotVehicle', 'scheduleSlot',
      'child', 'vehicle', 'groupFamilyMember', 'group',
      'familyMember', 'family', 'user',
    ];
    for (const table of tables) {
      try {
        await (prisma as any)[table].deleteMany({});
      } catch { }
    }
  });

  it('should return VehicleAssignment with all childAssignments after driver update', async () => {
    const { ScheduleSlotService } = await import('../../src/services/ScheduleSlotService');
    const prismaClient = new PrismaClient();
    const service = new ScheduleSlotService(prismaClient);

    const result = await service.updateVehicleDriver(
      testData.slotId,
      testData.vehicleId,
      testData.newDriverId
    );

    // ASSERT: Response includes childAssignments from BOTH families
    expect(result.childAssignments).toBeDefined();
    expect(result.childAssignments.length).toBe(2);

    const childIds = result.childAssignments.map((ca: any) => ca.childId);
    expect(childIds).toContain(testData.family1ChildId);
    expect(childIds).toContain(testData.family2ChildId);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd backend
npm test -- scheduleSlot.crossFamily.test.ts -t "driver update"
```

Expected: FAIL - `result.childAssignments` is undefined

**Step 3: Modify ScheduleSlotRepository.updateVehicleDriver**

File: `backend/src/repositories/ScheduleSlotRepository.ts:238-248`

```typescript
// BEFORE:
async updateVehicleDriver(scheduleSlotId: string, vehicleId: string, driverId: string | null): Promise<unknown> {
  return this.prisma.scheduleSlotVehicle.update({
    where: {
      scheduleSlotId_vehicleId: {
        scheduleSlotId,
        vehicleId,
      },
    },
    data: { driverId },
  });
}

// AFTER:
async updateVehicleDriver(scheduleSlotId: string, vehicleId: string, driverId: string | null): Promise<unknown> {
  return this.prisma.scheduleSlotVehicle.update({
    where: {
      scheduleSlotId_vehicleId: {
        scheduleSlotId,
        vehicleId,
      },
    },
    data: { driverId },
    include: {  // ← ADD THIS
      vehicle: {
        select: {
          id: true,
          name: true,
          capacity: true,
          familyId: true,
        },
      },
      driver: {
        select: {
          id: true,
          name: true,
        },
      },
      childAssignments: {  // ← ADD THIS
        include: {
          child: {
            select: {
              id: true,
              name: true,
              age: true,
              familyId: true,
            },
          },
        },
      },
    },
  });
}
```

**Step 4: Run test to verify it passes**

```bash
cd backend
npm test -- scheduleSlot.crossFamily.test.ts -t "driver update"
```

Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/repositories/ScheduleSlotRepository.ts backend/tests/integration/scheduleSlot.crossFamily.test.ts
git commit -m "fix(scheduleSlot): return all childAssignments when updating vehicle driver

Ensures mobile cache receives complete vehicle state with all children
from all families when driver is updated.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Fix PATCH /vehicle-assignments/:id/seat-override - Return VehicleAssignment with childAssignments

**Files:**
- Modify: `backend/src/repositories/ScheduleSlotRepository.ts:574-587`
- Modify: `backend/tests/integration/scheduleSlot.crossFamily.test.ts`

**Step 1: Add test**

Add to `backend/tests/integration/scheduleSlot.crossFamily.test.ts`:

```typescript
describe('PATCH /vehicle-assignments/:id/seat-override - Cross-family', () => {
  let testData: any;

  beforeEach(async () => {
    // Similar setup to Task 2 with 2 families' children
    // ... (same setup as driver test)
  });

  afterEach(async () => {
    // ... (same cleanup)
  });

  it('should return VehicleAssignment with all childAssignments after seat override', async () => {
    const { ScheduleSlotService } = await import('../../src/services/ScheduleSlotService');
    const prismaClient = new PrismaClient();
    const service = new ScheduleSlotService(prismaClient);

    const result = await service.updateSeatOverride({
      vehicleAssignmentId: testData.vehicleAssignmentId,
      seatOverride: 5
    });

    // ASSERT: Response includes childAssignments from BOTH families
    expect(result.childAssignments).toBeDefined();
    expect(result.childAssignments.length).toBe(2);

    const childIds = result.childAssignments.map((ca: any) => ca.childId);
    expect(childIds).toContain(testData.family1ChildId);
    expect(childIds).toContain(testData.family2ChildId);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd backend
npm test -- scheduleSlot.crossFamily.test.ts -t "seat override"
```

Expected: FAIL

**Step 3: Modify ScheduleSlotRepository.updateSeatOverride**

File: `backend/src/repositories/ScheduleSlotRepository.ts:574-587`

```typescript
// BEFORE:
async updateSeatOverride(vehicleAssignmentId: string, seatOverride?: number): Promise<unknown> {
  return this.prisma.scheduleSlotVehicle.update({
    where: { id: vehicleAssignmentId },
    data: { seatOverride: seatOverride || null },
    include: {
      vehicle: {
        select: { id: true, name: true, capacity: true },
      },
      driver: {
        select: { id: true, name: true },
      },
    },
  });
}

// AFTER:
async updateSeatOverride(vehicleAssignmentId: string, seatOverride?: number): Promise<unknown> {
  return this.prisma.scheduleSlotVehicle.update({
    where: { id: vehicleAssignmentId },
    data: { seatOverride: seatOverride || null },
    include: {
      vehicle: {
        select: { id: true, name: true, capacity: true },
      },
      driver: {
        select: { id: true, name: true },
      },
      childAssignments: {  // ← ADD THIS
        include: {
          child: {
            select: {
              id: true,
              name: true,
              age: true,
              familyId: true,
            },
          },
        },
      },
    },
  });
}
```

**Step 4: Run test to verify it passes**

```bash
cd backend
npm test -- scheduleSlot.crossFamily.test.ts -t "seat override"
```

Expected: PASS

**Step 5: Commit**

```bash
git add backend/src/repositories/ScheduleSlotRepository.ts backend/tests/integration/scheduleSlot.crossFamily.test.ts
git commit -m "fix(vehicleAssignment): return all childAssignments when updating seat override

Ensures mobile cache maintains complete vehicle state after capacity
changes in cross-family carpooling scenarios.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Fix DELETE /schedule-slots/:id/vehicles/:id - Return updated slot with remaining childAssignments

**⚠️ CRITICAL:** Verify with mobile team before implementing - this is a BREAKING CHANGE

**Files:**
- Modify: `backend/src/repositories/ScheduleSlotRepository.ts:206-236`
- Modify: `backend/src/controllers/v1/ScheduleSlotController.ts:924-971`
- Modify: `backend/tests/integration/scheduleSlot.crossFamily.test.ts`

**Step 1: Add test**

Add to `backend/tests/integration/scheduleSlot.crossFamily.test.ts`:

```typescript
describe('DELETE /schedule-slots/:id/vehicles/:id - Cross-family', () => {
  let testData: any;

  beforeEach(async () => {
    // Setup: Create slot with 2 vehicles, each with children from different families
    const user1 = await prisma.user.create({
      data: { email: `user1-${Date.now()}@test.com`, name: 'User 1', timezone: 'Europe/Paris' },
    });
    const family1 = await prisma.family.create({ data: { name: 'Family 1' } });
    await prisma.familyMember.create({
      data: { userId: user1.id, familyId: family1.id, role: 'OWNER', joinedAt: new Date() },
    });

    const child1 = await prisma.child.create({
      data: { name: 'Child 1', age: 8, familyId: family1.id },
    });
    const child2 = await prisma.child.create({
      data: { name: 'Child 2', age: 9, familyId: family1.id },
    });

    const group = await prisma.group.create({
      data: { name: 'Test Group', familyId: family1.id, inviteCode: 'TEST' },
    });

    const vehicle1 = await prisma.vehicle.create({
      data: { name: 'Vehicle 1', capacity: 6, familyId: family1.id },
    });
    const vehicle2 = await prisma.vehicle.create({
      data: { name: 'Vehicle 2', capacity: 4, familyId: family1.id },
    });

    const slot = await prisma.scheduleSlot.create({
      data: {
        groupId: group.id,
        datetime: new Date(Date.now() + 86400000),
      },
    });

    // Create first vehicle with 2 children
    const va1 = await prisma.scheduleSlotVehicle.create({
      data: {
        scheduleSlotId: slot.id,
        vehicleId: vehicle1.id,
        driverId: user1.id,
        childAssignments: [
          { childId: child1.id },
          { childId: child2.id },
        ],
      },
    });

    // Create second vehicle with 1 child
    const va2 = await prisma.scheduleSlotVehicle.create({
      data: {
        scheduleSlotId: slot.id,
        vehicleId: vehicle2.id,
        driverId: user1.id,
        childAssignments: [
          { childId: child1.id },
        ],
      },
    });

    testData = {
      slotId: slot.id,
      vehicle1Id: vehicle1.id,
      vehicle2Id: vehicle2.id,
      vehicle1AssignmentId: va1.id,
      vehicle2AssignmentId: va2.id,
    };
  });

  afterEach(async () => {
    const tables = [
      'scheduleSlotChild', 'scheduleSlotVehicle', 'scheduleSlot',
      'child', 'vehicle', 'group', 'familyMember', 'family', 'user',
    ];
    for (const table of tables) {
      try {
        await (prisma as any)[table].deleteMany({});
      } catch { }
    }
  });

  it('should return updated slot with all remaining childAssignments after vehicle removal', async () => {
    const { ScheduleSlotService } = await import('../../src/services/ScheduleSlotService');
    const prismaClient = new PrismaClient();
    const service = new ScheduleSlotService(prismaClient);

    // Remove first vehicle (which has 2 children)
    const result = await service.removeVehicleFromSlot(testData.slotId, testData.vehicle1Id);

    // ASSERT: Response is the updated slot with remaining vehicle and its childAssignments
    expect(result).toBeDefined();
    expect(result.vehicleAssignments).toBeDefined();
    expect(result.vehicleAssignments).toHaveLength(1); // Only vehicle2 remains

    // Verify the remaining vehicle has its childAssignments
    const remainingVa = result.vehicleAssignments[0];
    expect(remainingVa.vehicle.id).toBe(testData.vehicle2Id);
    expect(remainingVa.childAssignments).toBeDefined();
    expect(remainingVa.childAssignments).toHaveLength(1); // vehicle2's child
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd backend
npm test -- scheduleSlot.crossFamily.test.ts -t "remove vehicle"
```

Expected: FAIL - Returns `{ vehicleAssignment, slotDeleted }` instead of slot

**Step 3: Modify ScheduleSlotRepository.removeVehicleFromSlot**

File: `backend/src/repositories/ScheduleSlotRepository.ts:206-236`

**Note:** Prisma schema has `onDelete: Cascade` on ScheduleSlotChild.vehicleAssignment, so childAssignments are automatically deleted when vehicle is removed. No orphan cleanup needed.

```typescript
// BEFORE:
async removeVehicleFromSlot(scheduleSlotId: string, vehicleId: string): Promise<unknown> {
  return await this.prisma.$transaction(async (tx) => {
    const result = await tx.scheduleSlotVehicle.delete({
      where: {
        scheduleSlotId_vehicleId: {
          scheduleSlotId,
          vehicleId,
        },
      },
    });

    const remainingVehicleCount = await tx.scheduleSlotVehicle.count({
      where: { scheduleSlotId },
    });

    let slotDeleted = false;
    if (remainingVehicleCount === 0) {
      await tx.scheduleSlot.delete({
        where: { id: scheduleSlotId },
      });
      slotDeleted = true;
    }

    return { vehicleAssignment: result, slotDeleted };
  });
}

// AFTER:
async removeVehicleFromSlot(scheduleSlotId: string, vehicleId: string): Promise<unknown> {
  return await this.prisma.$transaction(async (tx) => {
    // Check remaining vehicles BEFORE deletion (avoid race condition)
    const remainingVehicleCount = await tx.scheduleSlotVehicle.count({
      where: { scheduleSlotId },
    });

    // Delete the vehicle assignment
    await tx.scheduleSlotVehicle.delete({
      where: {
        scheduleSlotId_vehicleId: {
          scheduleSlotId,
          vehicleId,
        },
      },
    });

    // If last vehicle, delete entire slot and return null
    if (remainingVehicleCount === 1) { // Was 1, now 0 after delete
      await tx.scheduleSlot.delete({
        where: { id: scheduleSlotId },
      });
      return null; // Slot deleted
    }

    // Return updated slot with remaining vehicles and their childAssignments
    return await tx.scheduleSlot.findUnique({
      where: { id: scheduleSlotId },
      include: {
        group: { select: { id: true, name: true } },
        vehicleAssignments: {
          include: {
            vehicle: true,
            driver: { select: { id: true, name: true } },
            childAssignments: {
              include: {
                child: {
                  select: {
                    id: true,
                    name: true,
                    age: true,
                    familyId: true,
                    createdAt: true,
                    updatedAt: true,
                  },
                },
              },
            },
          },
        },
        childAssignments: {
          select: {
            scheduleSlotId: true,
            childId: true,
            vehicleAssignmentId: true,
            assignedAt: true,
            child: {
              select: {
                id: true,
                name: true,
                age: true,
                familyId: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
      },
    });
  });
}
```

**Step 4: Update controller to handle null return**

File: `backend/src/controllers/v1/ScheduleSlotController.ts:924-971`

```typescript
// BEFORE:
app.openapi(removeVehicleRoute, async (c) => {
  const { scheduleSlotId } = c.req.valid('param');
  const input = c.req.valid('json');

  if (!input.vehicleId) {
    return c.json({
      success: false,
      error: 'Vehicle ID is required',
    }, 400);
  }

  try {
    const scheduleSlot = await scheduleSlotServiceInstance.getScheduleSlotDetails(scheduleSlotId);
    if (!scheduleSlot) {
      return c.json({
        success: false,
        error: 'Schedule slot not found',
      }, 404);
    }

    const result = await scheduleSlotServiceInstance.removeVehicleFromSlot(scheduleSlotId, input.vehicleId) as RemoveVehicleResult;

    if (result.slotDeleted) {
      SocketEmitter.broadcastScheduleSlotDeleted(scheduleSlot.groupId, scheduleSlotId);
    } else {
      SocketEmitter.broadcastScheduleSlotUpdate(scheduleSlot.groupId, scheduleSlotId, result);
    }
    SocketEmitter.broadcastScheduleUpdate(scheduleSlot.groupId);

    const responseData = {
      message: 'Vehicle removed successfully',
      slotDeleted: result.slotDeleted || false,
    };

    return c.json({
      success: true,
      data: responseData,
    }, 200);
  } catch (error) {
    return c.json({
      success: false,
      error: 'Failed to remove vehicle',
      code: 'REMOVE_FAILED',
    }, 500);
  }
});

// AFTER:
app.openapi(removeVehicleRoute, async (c) => {
  const { scheduleSlotId } = c.req.valid('param');
  const input = c.req.valid('json');

  if (!input.vehicleId) {
    return c.json({
      success: false,
      error: 'Vehicle ID is required',
    }, 400);
  }

  try {
    // Get slot first for WebSocket emissions
    const scheduleSlot = await scheduleSlotServiceInstance.getScheduleSlotDetails(scheduleSlotId);
    if (!scheduleSlot) {
      return c.json({
        success: false,
        error: 'Schedule slot not found',
      }, 404);
    }

    const result = await scheduleSlotServiceInstance.removeVehicleFromSlot(scheduleSlotId, input.vehicleId);

    // Handle slot deletion (result is null)
    if (result === null) {
      SocketEmitter.broadcastScheduleSlotDeleted(scheduleSlot.groupId, scheduleSlotId);
      SocketEmitter.broadcastScheduleUpdate(scheduleSlot.groupId);

      return c.json({
        success: true,
        data: {
          message: 'Vehicle removed successfully',
          slotDeleted: true,
        },
      }, 200);
    }

    // Transform updated slot to response format
    const transformedSlot = transformScheduleSlot(result);

    SocketEmitter.broadcastScheduleSlotUpdate(scheduleSlot.groupId, scheduleSlotId, result);
    SocketEmitter.broadcastScheduleUpdate(scheduleSlot.groupId);

    return c.json({
      success: true,
      data: transformedSlot,
    }, 200);
  } catch (error) {
    return c.json({
      success: false,
      error: 'Failed to remove vehicle',
      code: 'REMOVE_FAILED',
    }, 500);
  }
});
```

**Step 5: Remove unused RemoveVehicleResult interface**

File: `backend/src/controllers/v1/ScheduleSlotController.ts:47-51`

Remove the interface since it's no longer used:

```typescript
// Remove these lines (47-51):
// interface RemoveVehicleResult {
//   vehicleAssignment: unknown;
//   slotDeleted: boolean;
// }
```

**Step 6: Run test to verify it passes**

```bash
cd backend
npm test -- scheduleSlot.crossFamily.test.ts -t "remove vehicle"
```

Expected: PASS - Returns updated slot with remaining vehicles and all their childAssignments

**Step 7: Commit**

```bash
git add backend/src/repositories/ScheduleSlotRepository.ts backend/src/controllers/v1/ScheduleSlotController.ts backend/tests/integration/scheduleSlot.crossFamily.test.ts
git commit -m "refactor(scheduleSlot): return updated slot when removing vehicle

BREAKING CHANGE: DELETE /schedule-slots/:id/vehicles/:id now returns
the complete updated ScheduleSlot instead of { vehicleAssignment, slotDeleted }.

When slot is deleted (last vehicle removed), returns null and controller
sends { message, slotDeleted: true }.

This ensures mobile cache always has complete state of remaining vehicles
and all childAssignments after vehicle removal in cross-family carpooling.

Note: Prisma schema onDelete Cascade handles childAssignments cleanup.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Update OpenAPI documentation

**Files:**
- Modify: `backend/docs/openapi/swagger.json`

**Step 1: Regenerate OpenAPI schema**

```bash
cd backend
npm run swagger:generate
```

This updates swagger.json with new response schemas that include childAssignments.

**Step 2: Verify schema changes**

Manually check swagger.json for updated response schemas:
- POST /schedule-slots/:id/children response should include VehicleAssignment.childAssignments
- PATCH /vehicle-assignments/:id/seat-override response should include childAssignments
- DELETE /schedule-slots/:id/vehicles/:id response should return ScheduleSlot or { message, slotDeleted }

**Step 3: Commit**

```bash
git add backend/docs/openapi/swagger.json
git commit -m "docs(openapi): update response schemas for cross-family carpooling

Reflect API changes to return complete childAssignments in vehicle-related
operations for cross-family carpooling cache consistency.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Run full test suite

**Step 1: Run all tests**

```bash
cd backend
npm test
```

Expected: All tests pass

**Step 2: Run linting**

```bash
cd backend
npm run lint
```

Expected: No errors

**Step 3: Commit**

```bash
git commit --allow-empty -m "test: verify all tests pass after cross-family carpooling fix

Confirmed all existing tests still pass with new response schemas.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Summary

**Modified Endpoints:**
1. ✅ POST /schedule-slots/:id/children - Returns VehicleAssignment with all childAssignments
2. ✅ PUT /schedule-slots/:id/vehicles/:id/driver - Returns VehicleAssignment with all childAssignments
3. ✅ PATCH /vehicle-assignments/:id/seat-override - Returns VehicleAssignment with all childAssignments
4. ✅ DELETE /schedule-slots/:id/vehicles/:id - Returns updated ScheduleSlot or { message, slotDeleted }

**Pattern:** All endpoints now return complete state (all childAssignments from all families) instead of partial data, ensuring mobile cache consistency in cross-family carpooling scenarios.

**Testing:** Integration tests use real Prisma database (no mocks) following existing test patterns in `tests/integration/`.

**Key Changes from Original Plan:**
- Tests use existing setup pattern from `tests/setup.ts`
- No hardcoded IDs - Prisma generates UUIDs automatically
- Script is `swagger:generate` not `openapi:generate`
- Fixed race condition in delete (check count before delete)
- Confirmed Prisma schema has `onDelete: Cascade` for childAssignments cleanup
