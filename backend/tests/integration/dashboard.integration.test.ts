import { prisma } from '../tests/setup';
import { DashboardService } from '../../src/services/DashboardService';
import { PrismaClient } from '@prisma/client';

describe('DashboardService Integration Tests', () => {
  let testData: any;
  let dashboardService: DashboardService;

  beforeEach(async () => {
    testData = await createTestData();
    // Create a new PrismaClient instance for DashboardService to avoid type issues
    const prismaClient = new PrismaClient();
    dashboardService = new DashboardService(prismaClient);
  });

  afterEach(async () => {
    // Nettoyer les données créées
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
        await prisma[table].deleteMany({});
      } catch {
        // Ignorer les erreurs de nettoyage
      }
    }
  });

  describe('getWeeklyDashboard - Real Database Testing', () => {
    it('should return 7 days with empty transports when no slots exist', async () => {
      const result = await dashboardService.getWeeklyDashboard(testData.user.id);

      expect(result.success).toBe(true);
      expect(result.data?.days).toHaveLength(7);
      expect(result.data?.days.every(day => day.transports.length === 0)).toBe(true);
    });

    it('should correctly filter slots with DB-level queries', async () => {
      // Créer des slots avec différents scénarios
      const family2 = await prisma.family.create({
        data: { name: 'Other Family' },
      });

      const child2 = await prisma.child.create({
        data: { name: 'Other Child', familyId: family2.id },
      });

      const vehicle2 = await prisma.vehicle.create({
        data: { name: 'Other Vehicle', capacity: 6, familyId: family2.id },
      });

      // Slot avec famille 123 - doit être inclus
      const slot1 = await prisma.scheduleSlot.create({
        data: {
          groupId: testData.group.id,
          datetime: new Date(),
        },
      });

      await prisma.scheduleSlotVehicle.create({
        data: {
          scheduleSlotId: slot1.id,
          vehicleId: testData.vehicle.id,
          driverId: testData.user.id,
        },
      });

      await prisma.scheduleSlotChild.create({
        data: {
          scheduleSlotId: slot1.id,
          childId: testData.child.id,
          vehicleAssignmentId: (await prisma.scheduleSlotVehicle.findFirst({
            where: { scheduleSlotId: slot1.id },
          }))!.id,
        },
      });

      // Slot avec autre famille - doit être filtré par DB-level filtering
      const slot2 = await prisma.scheduleSlot.create({
        data: {
          groupId: testData.group.id,
          datetime: new Date(Date.now() + 2 * 60 * 60 * 1000),
        },
      });

      await prisma.scheduleSlotVehicle.create({
        data: {
          scheduleSlotId: slot2.id,
          vehicleId: vehicle2.id,
        },
      });

      await prisma.scheduleSlotChild.create({
        data: {
          scheduleSlotId: slot2.id,
          childId: child2.id,
          vehicleAssignmentId: (await prisma.scheduleSlotVehicle.findFirst({
            where: { scheduleSlotId: slot2.id },
          }))!.id,
        },
      });

      // Slot sans véhicules - doit être filtré
      const _slot3 = await prisma.scheduleSlot.create({
        data: {
          groupId: testData.group.id,
          datetime: new Date(Date.now() + 4 * 60 * 60 * 1000),
        },
      });

      // Test le service
      const result = await dashboardService.getWeeklyDashboard(testData.user.id);

      // Vérifications
      expect(result.success).toBe(true);
      expect(result.data?.days).toHaveLength(7);

      // Trouver le jour avec slot-1
      const dayWithTransports = result.data?.days.find(d => d.transports.length > 0);
      expect(dayWithTransports).toBeDefined();

      // Seulement le jour avec slot-1 devrait avoir un seul transport
      expect(dayWithTransports!.transports).toHaveLength(1);

      // Le transport doit contenir le véhicule de famille 123 avec l'enfant Emma
      const transport = dayWithTransports!.transports[0];
      expect(transport.vehicleAssignmentSummaries).toHaveLength(1);

      const vehicleSummary = transport.vehicleAssignmentSummaries[0];
      expect(vehicleSummary.isFamilyVehicle).toBe(true);
      expect(vehicleSummary.vehicleFamilyId).toBe(testData.family.id);
      expect(vehicleSummary.assignedChildrenCount).toBe(1);
      expect(vehicleSummary.children[0].childId).toBe(testData.child.id);
    });

    it('should handle vehicle filtering correctly per slot', async () => {
      // Scénario: Plusieurs véhicules dans un slot
      const slot = await prisma.scheduleSlot.create({
        data: {
          groupId: testData.group.id,
          datetime: new Date(),
        },
      });

      // Véhicule de famille 123 (inclus)
      await prisma.scheduleSlotVehicle.create({
        data: {
          scheduleSlotId: slot.id,
          vehicleId: testData.vehicle.id,
          driverId: testData.user.id,
        },
        childAssignments: [
          { childId: testData.child.id },
        ],
      });

      // Véhicule d'autre famille (inclus car il a des enfants de famille 123)
      const otherFamily = await prisma.family.create({
        data: { name: 'Test Other Family 2' },
      });

      const childOfOtherFamily = await prisma.child.create({
        data: { name: 'Child of Other Family', familyId: otherFamily.id },
      });

      const otherVehicle = await prisma.vehicle.create({
        data: { name: 'Other Vehicle', capacity: 6, familyId: otherFamily.id },
      });

      await prisma.scheduleSlotVehicle.create({
        data: {
          scheduleSlotId: slot.id,
          vehicleId: otherVehicle.id,
          driverId: testData.user.id,
        },
        childAssignments: [
          { childId: childOfOtherFamily.id },
        ],
      });

      // Véhicule d'autre famille (exclus car pas d'enfants de famille 123)
      const unrelatedVehicle = await prisma.vehicle.create({
        data: { name: 'Unrelated Vehicle', capacity: 4, familyId: 'unrelated-family' },
      });

      await prisma.scheduleSlotVehicle.create({
        data: {
          scheduleSlotId: slot.id,
          vehicleId: unrelatedVehicle.id,
        },
      });

      // Test le résultat
      const result = await dashboardService.getWeeklyDashboard(testData.user.id);

      const dayWithTransports = result.data?.days.find(d => d.transports.length > 0);
      expect(dayWithTransports).toBeDefined();

      // Doit contenir 3 véhicules:
      // 1. Véhicule de famille 123 (inclus)
      // 2. Véhicule d'autre famille (inclus car il a enfant de famille 123)
      // 3. Véhicule non lié à la famille (exclus car pas d'enfants de famille 123)
      const dayTransports = dayWithTransports!.transports;
      expect(dayTransports.length).toBe(3);

      const familyVehicles = dayTransports.filter(t =>
        t.vehicleAssignmentSummaries.some(v => v.isFamilyVehicle),
      );
      expect(familyVehicles.length).toBe(1);

      const hasFamilyChildren = dayTransports.every(t =>
        t.vehicleAssignmentSummaries.some(v =>
          v.assignedChildrenCount > 0 &&
          v.children.some(c => c.childId === testData.child.id),
        ),
      );
      expect(hasFamilyChildren).toBe(true);
    });

    it('should handle complex filtering scenarios', async () => {
      // Créer plusieurs familles et groupes
      const family2 = await prisma.family.create({ data: { name: 'Family 2' } });
      const family3 = await prisma.family.create({ data: { name: 'Family 3' } });

      const child2 = await prisma.child.create({ data: { name: 'Child 2', familyId: family2.id } });
      const child3 = await prisma.child.create({ data: { name: 'Child 3', familyId: family3.id } });

      const vehicle2 = await prisma.vehicle.create({ data: { name: 'Vehicle 2', capacity: 4, familyId: family2.id } });
      const vehicle3 = await prisma.vehicle.create({ data: { name: 'Vehicle 3', capacity: 4, familyId: family3.id } });

      const group2 = await prisma.group.create({ data: { name: 'Group 2', familyId: family2.id } });
      const group3 = await prisma.group.create({ data: { name: 'Group 3', familyId: family3.id } });

      // Ajouter famille aux groupes existants
      await prisma.groupFamilyMember.create({
        data: { familyId: family2.id, groupId: group2.id, role: 'MEMBER' },
      });
      await prisma.groupFamilyMember.create({
        data: { familyId: family3.id, groupId: group3.id, role: 'MEMBER' },
      });

      // Créer des slots dans différents groupes
      const slotInGroup1 = await prisma.scheduleSlot.create({
        data: {
          groupId: testData.group.id,
          datetime: new Date(),
        },
      });

      await prisma.scheduleSlotVehicle.create({
        data: {
          scheduleSlotId: slotInGroup1.id,
          vehicleId: testData.vehicle.id,
          childAssignments: [{ childId: testData.child.id }],
        },
      });

      const slotInGroup2 = await prisma.scheduleSlot.create({
        data: {
          groupId: group2.id,
          datetime: new Date(),
        },
      });

      await prisma.scheduleSlotVehicle.create({
        data: {
          scheduleSlotId: slotInGroup2.id,
          vehicleId: vehicle2.id,
          childAssignments: [{ childId: child2.id }],
        },
      });

      const slotInGroup3 = await prisma.scheduleSlot.create({
        data: {
          groupId: group3.id,
          datetime: new Date(),
        },
      });

      await prisma.scheduleSlotVehicle.create({
        data: {
          scheduleSlotId: slotInGroup3.id,
          vehicleId: vehicle3.id,
          childAssignments: [{ childId: child3.id }],
        },
      });

      // Tester le service
      const result = await dashboardService.getWeeklyDashboard(testData.user.id);

      // Le résultat devrait inclure les slots de tous les groupes où la famille est membre
      expect(result.success).toBe(true);
      expect(result.data?.days).toHaveLength(7);

      const transportsWithVehicles = result.data?.days.filter(d => d.transports.length > 0);
      expect(transportsWithVehicles.length).toBeGreaterThan(2);

      // Vérifier que chaque transport a au moins un véhicule
      expect(transportsWithVehicles.every(d => d.vehicleAssignmentSummaries.length > 0)).toBe(true);

      // Vérifier que les enfants de famille sont bien inclus
      const hasFamilyChildrenInEach = transportsWithVehicles.every(d =>
        d.vehicleAssignmentSummaries.some(v =>
          v.children.some(c => c.childId === testData.child.id),
        ),
      );
      expect(hasFamilyChildrenInEach).toBe(true);
    });

    it('should handle edge cases gracefully', async () => {
      // Cas: Utilisateur sans famille
      const userNoFamily = await prisma.user.create({
        data: {
          email: 'nofamily@example.com',
          name: 'No Family User',
        },
      });

      const result = await dashboardService.getWeeklyDashboard(userNoFamily.id);
      expect(result.success).toBe(false);
      expect(result.error).toBe('User has no family');
    });
  });
});

// Helper function pour créer des données de test
async function createTestData() {
  return {
    user: await prisma.user.create({
      data: {
        email: 'integration@test.com',
        name: 'Integration Test User',
        timezone: 'Europe/Paris',
      },
    }),
    family: await prisma.family.create({
      data: { name: 'Test Family' },
    }),
    group: await prisma.group.create({
      data: {
        name: 'Test Group',
        inviteCode: 'INTEGRATION_TEST',
        familyId: (await prisma.family.findFirst({ where: { name: 'Test Family' }}))!.id,
      },
    }),
    vehicle: await prisma.vehicle.create({
      data: {
        name: 'Integration Vehicle',
        capacity: 6,
        familyId: (await prisma.family.findFirst({ where: { name: 'Test Family' }}))!.id,
      },
    }),
    child: await prisma.child.create({
      data: {
        name: 'Integration Child',
        familyId: (await prisma.family.findFirst({ where: { name: 'Test Family' }}))!.id,
      },
    }),
  };
}

// Exporter pour les autres tests d'intégration
export { prisma, createTestData };
export default {};