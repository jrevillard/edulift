/**
 * Prisma Mock Factory
 *
 * Mock complet pour PrismaClient utilisable dans les tests
 */

interface MockPrismaClient {
  [key: string]: jest.Mocked<any>
}

export const createPrismaMock = (): MockPrismaClient => {
  const createMockModel = (_modelName: string) => ({
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
    delete: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
    aggregate: jest.fn(),
    groupBy: jest.fn(),
    findFirstOrThrow: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    createMany: jest.fn(),
    upsert: jest.fn(),
  });

  // Create mock for all Prisma models
  const models = [
    'user', 'family', 'familyMember', 'group', 'groupFamilyMember',
    'child', 'vehicle', 'scheduleSlot', 'scheduleSlotChild',
    'scheduleSlotVehicle', 'fcmToken', 'invitation', 'notification',
    'notificationPreference', 'route', 'routeStop', 'trip',
    'tripPassenger', 'tripLog', 'userPreference', 'groupSetting',
  ];

  const mockPrisma: MockPrismaClient = {};

  models.forEach(model => {
    mockPrisma[model] = createMockModel(model);
  });

  // Add $connect, $disconnect, $transaction methods
  mockPrisma.$connect = jest.fn();
  mockPrisma.$disconnect = jest.fn();
  mockPrisma.$transaction = jest.fn();

  return mockPrisma;
};

export default createPrismaMock;