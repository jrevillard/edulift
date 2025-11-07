import { createDashboardExtension } from '../src/extensions/prisma-dashboard-extension';

// Use the same Prisma client configuration as the main application
// This ensures tests run against the same database type
import { prisma as mainPrisma } from '../src/config/database';

const basePrisma = mainPrisma;

// Extend Prisma with dashboard service functionality
export const prisma = createDashboardExtension(basePrisma);

// Configuration de la base de données de test
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

// Nettoyage après les tests
afterAll(async () => {
  await prisma.$disconnect();
});

// Utilitaires pour créer des données de test réalistes
export const createTestData = async () => {
  // Créer un utilisateur de test
  const user = await prisma.user.create({
    data: {
      email: 'test-user@example.com',
      name: 'Test User',
      timezone: 'Europe/Paris',
    },
  });

  // Créer une famille
  const family = await prisma.family.create({
    data: {
      name: 'Test Family',
    },
  });

  // Associer l'utilisateur à la famille
  await prisma.familyMember.create({
    data: {
      familyId: family.id,
      userId: user.id,
      role: 'ADMIN',
      joinedAt: new Date(),
    },
  });

  // Créer un groupe
  const group = await prisma.group.create({
    data: {
      name: 'Test Group',
      inviteCode: 'TESTCODE123',
      familyId: family.id,
    },
  });

  // Ajouter la famille comme membre du groupe
  await prisma.groupFamilyMember.create({
    data: {
      familyId: family.id,
      groupId: group.id,
      role: 'MEMBER',
      addedBy: user.id,
      joinedAt: new Date(),
    },
  });

  // Créer un véhicule
  const vehicle = await prisma.vehicle.create({
    data: {
      name: 'Test Vehicle',
      capacity: 8,
      familyId: family.id,
    },
  });

  // Créer un enfant
  const child = await prisma.child.create({
    data: {
      name: 'Test Child',
      familyId: family.id,
    },
  });

  // Créer des slots de test avec différents scénarios
  const today = new Date();
  const slot1 = await prisma.scheduleSlot.create({
    data: {
      groupId: group.id,
      datetime: new Date(today.getTime() + 8 * 60 * 60 * 1000), // +8 heures
    },
  });

  // Ajouter véhicule et enfant au slot
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

// Nettoyage rapide entre les tests
afterEach(async () => {
  // Nettoyer les tables créées pendant le test
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
        // Ignorer les erreurs de nettoyage
      }
    }
  },
);