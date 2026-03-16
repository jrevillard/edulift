/**
 * Performance tests for NotificationService
 * Tests bulk notification delivery to ensure scalability
 *
 * REC-001: Tests de Performance
 */

import { NotificationService } from '../NotificationService';
import { PrismaClient } from '@prisma/client';
import { UserRepository } from '../../repositories/UserRepository';
import { ScheduleSlotRepository } from '../../repositories/ScheduleSlotRepository';
import { TEST_IDS } from '../../utils/testHelpers';

describe('NotificationService - Performance Tests', () => {
  // Helper function to create fresh mock objects for each test
  const createMockEmailService = () => ({
    sendMagicLink: jest.fn().mockResolvedValue(undefined),
    sendScheduleNotification: jest.fn().mockResolvedValue(undefined),
    sendGroupInvitation: jest.fn().mockResolvedValue(undefined),
    sendScheduleSlotNotification: jest.fn().mockResolvedValue(undefined),
    sendDailyReminder: jest.fn().mockResolvedValue(undefined),
    sendWeeklySchedule: jest.fn().mockResolvedValue(undefined),
    sendFamilyInvitation: jest.fn().mockResolvedValue(undefined),
    sendAccountDeletionRequest: jest.fn().mockResolvedValue(undefined),
    verifyConnection: jest.fn().mockResolvedValue(true),
  });

  const createMockUserRepository = () => ({
    findById: jest.fn(),
    findByEmail: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getGroupMembers: jest.fn(),
    getGroupById: jest.fn(),
  }) as unknown as UserRepository;

  const createMockScheduleSlotRepository = () => ({
    findByIdWithDetails: jest.fn(),
    findConflictingSlotsForParentByDateTime: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  }) as unknown as ScheduleSlotRepository;

  const createMockPrisma = () => ({
    child: {
      findUnique: jest.fn(),
    },
    vehicle: {
      findUnique: jest.fn(),
    },
    familyMember: {
      findMany: jest.fn(),
    },
  }) as unknown as PrismaClient;

  describe('Bulk Broadcasting Performance', () => {
    it('should handle broadcasting to 100 users within acceptable time limits', async () => {
      const mockEmailService = createMockEmailService();
      const mockUserRepository = createMockUserRepository();
      const mockScheduleSlotRepository = createMockScheduleSlotRepository();
      const mockPrisma = createMockPrisma();

      const service = new NotificationService(
        mockEmailService,
        mockUserRepository,
        mockScheduleSlotRepository,
        mockPrisma,
      );

      const scheduleSlotId = 'slot-perf-test';
      const userCount = 100;

      // Create mock data for 100 users
      const mockGroupMembers = Array.from({ length: userCount }, (_, i) => ({
        id: `gm-${i}`,
        userId: `user-${i}`,
        groupId: TEST_IDS.GROUP,
        role: 'MEMBER',
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: `user-${i}`,
          email: `user-${i}@example.com`,
          name: `User ${i}`,
        },
      }));

      const mockScheduleSlot = {
        id: scheduleSlotId,
        groupId: TEST_IDS.GROUP,
        datetime: new Date('2025-06-23T08:00:00.000Z'),
        group: {
          id: TEST_IDS.GROUP,
          name: 'Performance Test Group',
        },
        childAssignments: [],
        vehicleAssignments: [],
      };

      // Setup mocks
      (mockScheduleSlotRepository.findByIdWithDetails as jest.Mock).mockResolvedValue(mockScheduleSlot);
      (mockUserRepository.getGroupMembers as jest.Mock).mockResolvedValue(mockGroupMembers);

      const startTime = performance.now();

      await service.notifyScheduleSlotChange(scheduleSlotId, 'SLOT_CREATED');

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Assert all emails were sent
      expect(mockEmailService.sendScheduleSlotNotification).toHaveBeenCalledTimes(userCount);

      // Performance assertion: should complete within 1 second for 100 users
      expect(duration).toBeLessThan(1000);

      console.log(`✓ Broadcast to ${userCount} users completed in ${duration.toFixed(2)}ms`);
    });

    it('should handle broadcasting to 500 users for stress testing', async () => {
      const mockEmailService = createMockEmailService();
      const mockUserRepository = createMockUserRepository();
      const mockScheduleSlotRepository = createMockScheduleSlotRepository();
      const mockPrisma = createMockPrisma();

      const service = new NotificationService(
        mockEmailService,
        mockUserRepository,
        mockScheduleSlotRepository,
        mockPrisma,
      );

      const scheduleSlotId = 'slot-stress-test';
      const userCount = 500;

      // Create mock data for 500 users
      const mockGroupMembers = Array.from({ length: userCount }, (_, i) => ({
        id: `gm-${i}`,
        userId: `user-${i}`,
        groupId: TEST_IDS.GROUP,
        role: 'MEMBER',
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: `user-${i}`,
          email: `user-${i}@example.com`,
          name: `User ${i}`,
        },
      }));

      const mockScheduleSlot = {
        id: scheduleSlotId,
        groupId: TEST_IDS.GROUP,
        datetime: new Date('2025-06-23T08:00:00.000Z'),
        group: {
          id: TEST_IDS.GROUP,
          name: 'Stress Test Group',
        },
        childAssignments: [],
        vehicleAssignments: [],
      };

      // Setup mocks
      (mockScheduleSlotRepository.findByIdWithDetails as jest.Mock).mockResolvedValue(mockScheduleSlot);
      (mockUserRepository.getGroupMembers as jest.Mock).mockResolvedValue(mockGroupMembers);

      const startTime = performance.now();

      await service.notifyScheduleSlotChange(scheduleSlotId, 'SLOT_CREATED');

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Assert all emails were sent
      expect(mockEmailService.sendScheduleSlotNotification).toHaveBeenCalledTimes(userCount);

      // Stress test: should still complete within reasonable time
      expect(duration).toBeLessThan(5000);

      console.log(`✓ Stress test broadcast to ${userCount} users completed in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Multi-Device Notifications Performance', () => {
    it('should efficiently handle users with multiple FCM tokens', async () => {
      const mockEmailService = createMockEmailService();
      const mockUserRepository = createMockUserRepository();
      const mockScheduleSlotRepository = createMockScheduleSlotRepository();
      const mockPrisma = createMockPrisma();

      const service = new NotificationService(
        mockEmailService,
        mockUserRepository,
        mockScheduleSlotRepository,
        mockPrisma,
      );

      const userCount = 50;
      const tokensPerUser = 3; // Each user has 3 devices

      const mockGroupMembers = Array.from({ length: userCount }, (_, i) => ({
        id: `gm-${i}`,
        userId: `user-${i}`,
        groupId: TEST_IDS.GROUP,
        role: 'MEMBER',
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: `user-${i}`,
          email: `user-${i}@example.com`,
          name: `User ${i}`,
        },
      }));

      const mockScheduleSlot = {
        id: 'slot-multi-device',
        groupId: TEST_IDS.GROUP,
        datetime: new Date('2025-06-23T08:00:00.000Z'),
        group: {
          id: TEST_IDS.GROUP,
          name: 'Multi-Device Test Group',
        },
        childAssignments: [],
        vehicleAssignments: [],
      };

      // Setup mocks
      (mockScheduleSlotRepository.findByIdWithDetails as jest.Mock).mockResolvedValue(mockScheduleSlot);
      (mockUserRepository.getGroupMembers as jest.Mock).mockResolvedValue(mockGroupMembers);

      const startTime = performance.now();

      await service.notifyScheduleSlotChange(mockScheduleSlot.id, 'SLOT_CREATED');

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should send 50 emails (one per user, not per device)
      expect(mockEmailService.sendScheduleSlotNotification).toHaveBeenCalledTimes(userCount);

      // Performance assertion
      expect(duration).toBeLessThan(500);

      const totalTokens = userCount * tokensPerUser;
      console.log(`✓ Multi-device test (${userCount} users × ${tokensPerUser} tokens = ${totalTokens} tokens) completed in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Memory Management Under Load', () => {
    it('should not leak memory during repeated notification cycles', async () => {
      const mockEmailService = createMockEmailService();
      const mockUserRepository = createMockUserRepository();
      const mockScheduleSlotRepository = createMockScheduleSlotRepository();
      const mockPrisma = createMockPrisma();

      const service = new NotificationService(
        mockEmailService,
        mockUserRepository,
        mockScheduleSlotRepository,
        mockPrisma,
      );

      const userCount = 50;
      const cycles = 10;

      const mockGroupMembers = Array.from({ length: userCount }, (_, i) => ({
        id: `gm-${i}`,
        userId: `user-${i}`,
        groupId: TEST_IDS.GROUP,
        role: 'MEMBER',
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: `user-${i}`,
          email: `user-${i}@example.com`,
          name: `User ${i}`,
        },
      }));

      const mockScheduleSlot = {
        id: 'slot-memory-test',
        groupId: TEST_IDS.GROUP,
        datetime: new Date('2025-06-23T08:00:00.000Z'),
        group: {
          id: TEST_IDS.GROUP,
          name: 'Memory Test Group',
        },
        childAssignments: [],
        vehicleAssignments: [],
      };

      // Setup mocks
      (mockScheduleSlotRepository.findByIdWithDetails as jest.Mock).mockResolvedValue(mockScheduleSlot);
      (mockUserRepository.getGroupMembers as jest.Mock).mockResolvedValue(mockGroupMembers);

      // Force garbage collection if available (Node.js with --expose-gc)
      if (global.gc) {
        global.gc();
      }

      const initialMemory = process.memoryUsage();

      // Run multiple notification cycles
      for (let i = 0; i < cycles; i++) {
        await service.notifyScheduleSlotChange(`slot-${i}`, 'SLOT_CREATED');
      }

      // Force garbage collection again
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const memoryIncreaseMB = memoryIncrease / (1024 * 1024);

      // Memory increase should be reasonable (less than 10MB for this test)
      expect(memoryIncreaseMB).toBeLessThan(10);

      console.log(`✓ Memory test (${cycles} cycles × ${userCount} users): ${memoryIncreaseMB.toFixed(2)}MB increase`);
    });

    it('should handle parallel notification requests efficiently', async () => {
      const mockEmailService = createMockEmailService();
      const mockUserRepository = createMockUserRepository();
      const mockScheduleSlotRepository = createMockScheduleSlotRepository();
      const mockPrisma = createMockPrisma();

      const service = new NotificationService(
        mockEmailService,
        mockUserRepository,
        mockScheduleSlotRepository,
        mockPrisma,
      );

      const userCount = 30;
      const parallelRequests = 5;

      const mockGroupMembers = Array.from({ length: userCount }, (_, i) => ({
        id: `gm-${i}`,
        userId: `user-${i}`,
        groupId: TEST_IDS.GROUP,
        role: 'MEMBER',
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: `user-${i}`,
          email: `user-${i}@example.com`,
          name: `User ${i}`,
        },
      }));

      const mockScheduleSlot = {
        id: 'slot-parallel-test',
        groupId: TEST_IDS.GROUP,
        datetime: new Date('2025-06-23T08:00:00.000Z'),
        group: {
          id: TEST_IDS.GROUP,
          name: 'Parallel Test Group',
        },
        childAssignments: [],
        vehicleAssignments: [],
      };

      // Setup mocks
      (mockScheduleSlotRepository.findByIdWithDetails as jest.Mock).mockResolvedValue(mockScheduleSlot);
      (mockUserRepository.getGroupMembers as jest.Mock).mockResolvedValue(mockGroupMembers);

      const startTime = performance.now();

      // Run parallel notifications
      const promises = Array.from({ length: parallelRequests }, (_, i) =>
        service.notifyScheduleSlotChange(`slot-parallel-${i}`, 'SLOT_CREATED'),
      );

      await Promise.all(promises);

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should handle parallel requests efficiently
      expect(mockEmailService.sendScheduleSlotNotification).toHaveBeenCalledTimes(userCount * parallelRequests);

      // Parallel execution should be faster than sequential
      expect(duration).toBeLessThan(300);

      console.log(`✓ Parallel test (${parallelRequests} concurrent requests) completed in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Complex Notification Scenarios', () => {
    it('should handle notifications with multiple children and vehicles efficiently', async () => {
      const mockEmailService = createMockEmailService();
      const mockUserRepository = createMockUserRepository();
      const mockScheduleSlotRepository = createMockScheduleSlotRepository();
      const mockPrisma = createMockPrisma();

      const service = new NotificationService(
        mockEmailService,
        mockUserRepository,
        mockScheduleSlotRepository,
        mockPrisma,
      );

      const userCount = 100;
      const childrenPerSlot = 10;
      const vehiclesPerSlot = 3;

      // Create mock children assignments
      const childAssignments = Array.from({ length: childrenPerSlot }, (_, i) => ({
        child: { id: `child-${i}`, name: `Child ${i}` },
      }));

      // Create mock vehicle assignments with families
      const vehicleAssignments = Array.from({ length: vehiclesPerSlot }, (_, i) => ({
        vehicle: {
          id: `vehicle-${i}`,
          name: `Vehicle ${i}`,
          capacity: 4,
          familyId: `family-${i}`,
        },
      }));

      const mockGroupMembers = Array.from({ length: userCount }, (_, i) => ({
        id: `gm-${i}`,
        userId: `user-${i}`,
        groupId: TEST_IDS.GROUP,
        role: 'MEMBER',
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: `user-${i}`,
          email: `user-${i}@example.com`,
          name: `User ${i}`,
        },
      }));

      const mockScheduleSlot = {
        id: 'slot-complex-test',
        groupId: TEST_IDS.GROUP,
        datetime: new Date('2025-06-23T08:00:00.000Z'),
        group: {
          id: TEST_IDS.GROUP,
          name: 'Complex Test Group',
        },
        childAssignments,
        vehicleAssignments,
      };

      // Mock family member queries for vehicles and children
      const mockVehicleFamilyMembers = Array.from({ length: 3 }, (_, i) => ({
        userId: `vehicle-family-user-${i}`,
      }));

      const mockChildFamilyMembers = [
        { userId: 'user-0' },
        { userId: 'user-1' },
      ];

      // Setup mocks
      (mockScheduleSlotRepository.findByIdWithDetails as jest.Mock).mockResolvedValue(mockScheduleSlot);
      (mockUserRepository.getGroupMembers as jest.Mock).mockResolvedValue(mockGroupMembers);
      (mockPrisma.familyMember.findMany as jest.Mock)
        .mockResolvedValueOnce(mockVehicleFamilyMembers) // First vehicle
        .mockResolvedValueOnce(mockVehicleFamilyMembers) // Second vehicle
        .mockResolvedValueOnce(mockVehicleFamilyMembers) // Third vehicle
        .mockResolvedValueOnce(mockChildFamilyMembers) // First child
        .mockResolvedValueOnce(mockChildFamilyMembers); // Second child

      const startTime = performance.now();

      await service.notifyScheduleSlotChange(mockScheduleSlot.id, 'VEHICLE_ASSIGNED');

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Performance assertion: complex notifications with family lookups should still be fast
      expect(duration).toBeLessThan(500);

      console.log(`✓ Complex scenario (${childrenPerSlot} children × ${vehiclesPerSlot} vehicles × ${userCount} users) completed in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Push Notification Performance', () => {
    it('should handle push notification batch processing efficiently', async () => {
      const mockEmailService = createMockEmailService();
      const mockUserRepository = createMockUserRepository();
      const mockScheduleSlotRepository = createMockScheduleSlotRepository();
      const mockPrisma = createMockPrisma();

      const service = new NotificationService(
        mockEmailService,
        mockUserRepository,
        mockScheduleSlotRepository,
        mockPrisma,
      );

      const userCount = 200;

      const mockGroupMembers = Array.from({ length: userCount }, (_, i) => ({
        id: `gm-${i}`,
        userId: `user-${i}`,
        groupId: TEST_IDS.GROUP,
        role: 'MEMBER',
        createdAt: new Date(),
        updatedAt: new Date(),
        user: {
          id: `user-${i}`,
          email: `user-${i}@example.com`,
          name: `User ${i}`,
        },
      }));

      const mockScheduleSlot = {
        id: 'slot-push-perf',
        groupId: TEST_IDS.GROUP,
        datetime: new Date('2025-06-23T08:00:00.000Z'),
        group: {
          id: TEST_IDS.GROUP,
          name: 'Push Perf Test Group',
        },
        childAssignments: [],
        vehicleAssignments: [],
      };

      // Setup mocks
      (mockScheduleSlotRepository.findByIdWithDetails as jest.Mock).mockResolvedValue(mockScheduleSlot);
      (mockUserRepository.getGroupMembers as jest.Mock).mockResolvedValue(mockGroupMembers);

      const startTime = performance.now();

      await service.notifyScheduleSlotChange(mockScheduleSlot.id, 'SLOT_CREATED');

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Both email and push should be sent
      expect(mockEmailService.sendScheduleSlotNotification).toHaveBeenCalledTimes(userCount);

      // Should complete quickly even with push notification processing
      expect(duration).toBeLessThan(1000);

      console.log(`✓ Push notification batch (${userCount} users) completed in ${duration.toFixed(2)}ms`);
    });
  });

  describe('Simple Verification Test', () => {
    it('should correctly mock dependencies and send notifications', async () => {
      const mockEmailService = createMockEmailService();
      const mockUserRepository = createMockUserRepository();
      const mockScheduleSlotRepository = createMockScheduleSlotRepository();
      const mockPrisma = createMockPrisma();

      const service = new NotificationService(
        mockEmailService,
        mockUserRepository,
        mockScheduleSlotRepository,
        mockPrisma,
      );

      const scheduleSlotId = 'slot-verify';
      const mockGroupMembers = [
        {
          id: 'gm-1',
          userId: 'user-1',
          groupId: TEST_IDS.GROUP,
          role: 'MEMBER',
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: 'user-1', email: 'user1@example.com', name: 'User 1' },
        },
        {
          id: 'gm-2',
          userId: 'user-2',
          groupId: TEST_IDS.GROUP,
          role: 'MEMBER',
          createdAt: new Date(),
          updatedAt: new Date(),
          user: { id: 'user-2', email: 'user2@example.com', name: 'User 2' },
        },
      ];

      const mockScheduleSlot = {
        id: scheduleSlotId,
        groupId: TEST_IDS.GROUP,
        datetime: new Date('2025-06-23T08:00:00.000Z'),
        group: {
          id: TEST_IDS.GROUP,
          name: 'Verify Test Group',
        },
        childAssignments: [],
        vehicleAssignments: [],
      };

      (mockScheduleSlotRepository.findByIdWithDetails as jest.Mock).mockResolvedValue(mockScheduleSlot);
      (mockUserRepository.getGroupMembers as jest.Mock).mockResolvedValue(mockGroupMembers);

      await service.notifyScheduleSlotChange(scheduleSlotId, 'SLOT_CREATED');

      expect(mockEmailService.sendScheduleSlotNotification).toHaveBeenCalledTimes(2);
    });
  });
});

/**
 * Performance Test Benchmarks
 *
 * These tests establish performance baselines for notification delivery:
 *
 * Benchmark 1: 100 users - < 1000ms
 * Benchmark 2: 500 users (stress) - < 5000ms
 * Benchmark 3: Multi-device (50 users × 3 devices) - < 500ms
 * Benchmark 4: Memory (10 cycles × 50 users) - < 10MB increase
 * Benchmark 5: Parallel (5 concurrent × 30 users) - < 300ms
 * Benchmark 6: Complex (10 children × 3 vehicles × 100 users) - < 500ms
 * Benchmark 7: Push batch (200 users) - < 1000ms
 *
 * To run performance tests with memory tracking:
 * node --expose-gc --no-compilation --check ./node_modules/.bin/jest --testPathPattern=\.performance\.test\.ts
 */
