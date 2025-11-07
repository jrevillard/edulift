import { prisma } from '../../../tests/setup';
import { DayTransportSummary } from '../../types/DashboardTypes';
import { DashboardService } from '../DashboardService';
import { PrismaClient } from '@prisma/client';

describe('DashboardService Integration Tests', () => {
  let testData: any;
  let dashboardService: DashboardService;

  beforeEach(async () => {
    // Créer les données de test spécifiques pour ce test
    const user = await prisma.user.create({
      data: {
        email: 'integration@test.com',
        name: 'Integration Test User',
        timezone: 'Europe/Paris',
      },
    });

    const family = await prisma.family.create({
      data: { name: 'Test Family' },
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

    const group = await prisma.group.create({
      data: {
        name: 'Test Group',
        inviteCode: 'INTEGRATION_TEST',
        familyId: family.id,
      },
    });

    const vehicle = await prisma.vehicle.create({
      data: {
        name: 'Integration Vehicle',
        capacity: 6,
        familyId: family.id,
      },
    });

    const child = await prisma.child.create({
      data: {
        name: 'Integration Child',
        familyId: family.id,
      },
    });

    testData = { user, family, group, vehicle, child };
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
        await (prisma as any)[table].deleteMany({});
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
      expect(result.data?.days.every((day: DayTransportSummary) => day.transports.length === 0)).toBe(true);
    });

    it('should correctly filter slots with DB-level queries', async () => {
      // Créer un slot simple avec véhicule et enfant
      const slot = await prisma.scheduleSlot.create({
        data: {
          groupId: testData.group.id,
          datetime: new Date(),
        },
      });

      const vehicleAssignment = await prisma.scheduleSlotVehicle.create({
        data: {
          scheduleSlotId: slot.id,
          vehicleId: testData.vehicle.id,
          driverId: testData.user.id,
        },
      });

      await prisma.scheduleSlotChild.create({
        data: {
          scheduleSlotId: slot.id,
          childId: testData.child.id,
          vehicleAssignmentId: vehicleAssignment.id,
        },
      });

      // Test le service
      const result = await dashboardService.getWeeklyDashboard(testData.user.id);

      // Vérifications
      expect(result.success).toBe(true);
      expect(result.data?.days).toHaveLength(7);

      const dayWithTransports = result.data?.days.find((d: DayTransportSummary) => d.transports.length > 0);
      expect(dayWithTransports).toBeDefined();

      // Le jour avec le slot devrait avoir un seul transport
      expect(dayWithTransports!.transports).toHaveLength(1);

      // Le transport doit contenir le véhicule de famille avec l'enfant
      const transport = dayWithTransports!.transports[0];
      expect(transport.vehicleAssignmentSummaries).toHaveLength(1);

      const vehicleSummary = transport.vehicleAssignmentSummaries[0];
      expect(vehicleSummary.isFamilyVehicle).toBe(true);
      expect(vehicleSummary.vehicleFamilyId).toBe(testData.family.id);
      expect(vehicleSummary.assignedChildrenCount).toBe(1);
      expect(vehicleSummary.children![0].childId).toBe(testData.child.id);
    });

    it('should handle vehicle filtering correctly per slot', async () => {
      // Créer un slot avec plusieurs véhicules
      const slot = await prisma.scheduleSlot.create({
        data: {
          groupId: testData.group.id,
          datetime: new Date(),
        },
      });

      // Véhicule de famille 123
      const vehicleAssignment1 = await prisma.scheduleSlotVehicle.create({
        data: {
          scheduleSlotId: slot.id,
          vehicleId: testData.vehicle.id,
          driverId: testData.user.id,
        },
      });

      await prisma.scheduleSlotChild.create({
        data: {
          scheduleSlotId: slot.id,
          childId: testData.child.id,
          vehicleAssignmentId: vehicleAssignment1.id,
        },
      });

      // Véhicule d'autre famille
      const otherFamily = await prisma.family.create({
        data: { name: 'Test Other Family 2' },
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
      });

      // Test le résultat
      const result = await dashboardService.getWeeklyDashboard(testData.user.id);

      const dayWithTransports = result.data?.days.find((d: DayTransportSummary) => d.transports.length > 0);
      expect(dayWithTransports).toBeDefined();

      const dayTransports = dayWithTransports!.transports;
      expect(dayTransports.length).toBe(1); // Un seul slot = un seul transport

      const familyVehicles = dayTransports.filter((t: any) =>
        t.vehicleAssignmentSummaries.some((v: any) => v.isFamilyVehicle),
      );
      expect(familyVehicles.length).toBe(1);

      const hasFamilyChildren = dayTransports.every((t: any) =>
        t.vehicleAssignmentSummaries.some((v: any) =>
          v.assignedChildrenCount > 0 &&
          v.children!.some((c: any) => c.childId === testData.child.id),
        ),
      );
      expect(hasFamilyChildren).toBe(true);
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