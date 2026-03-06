import { createDashboardExtension } from '../src/extensions/prisma-dashboard-extension';

// Use the same Prisma client configuration as the main application
// This ensures tests run against the same database type
import { prisma as mainPrisma } from '../src/config/database';

const basePrisma = mainPrisma;

// Extend Prisma with dashboard service functionality
export const prisma = createDashboardExtension(basePrisma);

// Test database configuration
beforeAll(async () => {
  // Use the existing database connection
  try {
    await prisma.$connect();
    console.log('Connected to test database successfully');
  } catch (error) {
    console.error('Failed to connect to test database:', error);
    throw error;
  }
}, 30000); // 30 second timeout for setup

// Cleanup after tests
afterAll(async () => {
  await prisma.$disconnect();
});

// Utilities to create realistic test data
export const createTestData = async () => {
  // Create a test user
  const user = await prisma.user.create({
    data: {
      email: 'test-user@example.com',
      name: 'Test User',
      timezone: 'Europe/Paris',
    },
  });

  // Create a family
  const family = await prisma.family.create({
    data: {
      name: 'Test Family',
    },
  });

  // Associate user with the family
  await prisma.familyMember.create({
    data: {
      familyId: family.id,
      userId: user.id,
      role: 'ADMIN',
      joinedAt: new Date(),
    },
  });

  // Create a group
  const group = await prisma.group.create({
    data: {
      name: 'Test Group',
      inviteCode: 'TESTCODE123',
      familyId: family.id,
    },
  });

  // Add family as group member
  await prisma.groupFamilyMember.create({
    data: {
      familyId: family.id,
      groupId: group.id,
      role: 'MEMBER',
      addedBy: user.id,
      joinedAt: new Date(),
    },
  });

  // Create a vehicle
  const vehicle = await prisma.vehicle.create({
    data: {
      name: 'Test Vehicle',
      capacity: 8,
      familyId: family.id,
    },
  });

  // Create a child
  const child = await prisma.child.create({
    data: {
      name: 'Test Child',
      familyId: family.id,
    },
  });

  // Create test slots with different scenarios
  const today = new Date();
  const slot1 = await prisma.scheduleSlot.create({
    data: {
      groupId: group.id,
      datetime: new Date(today.getTime() + 8 * 60 * 60 * 1000), // +8 heures
    },
  });

  // Add vehicle and child to the slot
  await prisma.scheduleSlotVehicle.create({
    data: {
      scheduleSlotId: slot1.id,
      vehicleId: vehicle.id,
      driverId: user.id,
    },
  });

  await prisma.scheduleSlotChild.create({
    data: {
      scheduleSlotId: slot1.id,
      childId: child.id,
      vehicleAssignmentId: (await prisma.scheduleSlotVehicle.findFirst({
        where: { scheduleSlotId: slot1.id },
      }))!.id,
    },
  });

  return {
    user,
    family,
    group,
    vehicle,
    child,
    slot: slot1,
  };
};

// Quick cleanup between tests
afterEach(async () => {
  // Clean up tables created during the test
  const tables = [
    'scheduleSlotChild',
    'scheduleSlotVehicle',
    'scheduleSlot',
    'child',
    'vehicle',
    'group',
    'groupFamilyMember',
    'familyMember',
    'user',
  ];

  for (const table of tables) {
      try {
        await (prisma as any)[table].deleteMany({});
      } catch {
        // Ignore cleanup errors
      }
    }
  },
);