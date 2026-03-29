/**
 * EduLift E2E - Test Data Generator
 * Generates unique test data to ensure complete test isolation
 * Each test gets its own unique namespace preventing data conflicts
 *
 * Ported from Flutter mobile E2E approach
 * See: /workspace/flutter/test/helpers/test_data_generator.dart
 *
 * Usage:
 * ```typescript
 * const email = TestDataGenerator.generateUniqueEmail();
 * const familyName = TestDataGenerator.generateUniqueFamilyName();
 * const childData = TestDataGenerator.generateChildData({ userPrefix: 'O' });
 * ```
 */

import { randomUUID } from 'crypto';

/**
 * Generates unique test data to ensure test isolation
 * Each test gets its own unique namespace preventing conflicts
 */
export class TestDataGenerator {
  private static lastTimestamp: number = 0;
  private static counter: number = 0;

  /**
   * Get unique timestamp with increment guarantee
   * Ensures uniqueness even if multiple calls in same millisecond
   */
  private static getUniqueTimestamp(): number {
    const now = Date.now();

    // Ensure uniqueness by incrementing if same timestamp
    if (now <= this.lastTimestamp) {
      this.lastTimestamp = this.lastTimestamp + 1;
    } else {
      this.lastTimestamp = now;
    }

    return this.lastTimestamp;
  }

  /**
   * Get unique counter (alternative to timestamp for simpler cases)
   */
  private static getUniqueCounter(): number {
    return ++this.counter;
  }

  /**
   * Generate short UUID (first 8 characters)
   * For full UUID, use randomUUID() from 'crypto' module directly
   */
  private static shortUUID(): string {
    return randomUUID().substring(0, 8);
  }

  /**
   * Generate unique email with timestamp and short UUID
   * Format: test_<timestamp>_<uuid>@e2e.edulift.com
   *
   * Example: test_1704123456789_a1b2c3d4@e2e.edulift.com
   */
  static generateUniqueEmail(): string {
    const timestamp = this.getUniqueTimestamp();
    const uuid = this.shortUUID();
    return `test_${timestamp}_${uuid}@e2e.edulift.com`;
  }

  /**
   * Generate unique email with prefix for test categorization
   * Format: <prefix>_<timestamp>_<uuid>@e2e.edulift.com
   *
   * Example: auth_1704123456789_a1b2c3d4@e2e.edulift.com
   *
   * Recommended prefixes:
   * - 'auth' for authentication tests
   * - 'family' for family management tests
   * - 'invite' for invitation tests
   * - 'group' for group management tests
   * - 'schedule' for schedule tests
   * - 'child' for children management tests
   * - 'vehicle' for vehicle management tests
   */
  static generateEmailWithPrefix(prefix: string): string {
    const timestamp = this.getUniqueTimestamp();
    const uuid = this.shortUUID();
    return `${prefix}_${timestamp}_${uuid}@e2e.edulift.com`;
  }

  /**
   * Generate unique family name
   * Format: Family_<timestamp>_<uuid>
   *
   * Example: Family_1704123456789_a1b2c3d4
   */
  static generateUniqueFamilyName(): string {
    const timestamp = this.getUniqueTimestamp();
    const uuid = this.shortUUID();
    return `Family_${timestamp}_${uuid}`;
  }

  /**
   * Generate unique child name
   * Format: <Prefix><Name> <UUID letters only>
   *
   * Example: O-Emma abcdefgh
   *
   * @param userPrefix - User prefix for this child (e.g., 'O' for Owner, 'M' for Member, 'A' for Admin)
   */
  static generateUniqueChildName(userPrefix: string = ''): string {
    const timestamp = this.getUniqueTimestamp();

    // Keep only letters from UUID - filter out ALL digits
    const fullUuid = randomUUID();
    const uuid = fullUuid
      .replace(/-/g, '')
      .replace(/\d/g, '')
      .toLowerCase()
      .substring(0, 8);

    const names = [
      'Emma', 'Liam', 'Olivia', 'Noah', 'Ava',
      'Ethan', 'Sophia', 'Mason', 'Isabella', 'William',
    ];

    const name = names[timestamp % names.length];

    // Safe substring: ensure UUID is long enough
    const uuidSuffix = uuid.length >= 8
      ? uuid.substring(0, 8)
      : uuid + 'abcdefgh'.substring(0, 8 - uuid.length);

    const prefix = userPrefix ? `${userPrefix}-` : '';
    return `${prefix}${name} ${uuidSuffix}`;
  }

  /**
   * Generate unique vehicle name
   * Format: <VehicleType> <Timestamp> <UUID>
   *
   * Example: Honda Civic 1704123456789 a1b2c3d4
   *
   * @param userPrefix - User prefix for this vehicle (e.g., 'O' for Owner, 'M' for Member)
   */
  static generateUniqueVehicleName(userPrefix: string = ''): string {
    const timestamp = this.getUniqueTimestamp();
    const uuid = this.shortUUID().toLowerCase();

    const vehicles = [
      'Honda Civic', 'Toyota Camry', 'Ford Focus',
      'Nissan Sentra', 'Hyundai Elantra', 'Mazda 3',
      'Kia Forte', 'Chevrolet Cruze',
    ];

    const vehicle = vehicles[timestamp % vehicles.length];
    const prefix = userPrefix ? `${userPrefix}-` : '';

    return `${prefix}${vehicle} ${timestamp} ${uuid}`;
  }

  /**
   * Generate unique group name
   * Format: Group_<timestamp>_<uuid>
   *
   * Example: Group_1704123456789_a1b2c3d4
   */
  static generateUniqueGroupName(): string {
    const timestamp = this.getUniqueTimestamp();
    const uuid = this.shortUUID();
    return `Group_${timestamp}_${uuid}`;
  }

  /**
   * Generate unique display name
   * Format: Name_<timestamp>
   *
   * Example: Name_1704123456789
   */
  static generateUniqueName(): string {
    const timestamp = this.getUniqueTimestamp();
    return `Name_${timestamp}`;
  }

  /**
   * Generate unique invitation code
   * Format: INV_<timestamp>_<UUID_UPPER>
   *
   * Example: INV_1704123456789_A1B2C3D4
   */
  static generateUniqueInvitationCode(): string {
    const timestamp = this.getUniqueTimestamp();
    const uuid = this.shortUUID().toUpperCase();
    return `INV_${timestamp}_${uuid}`;
  }

  /**
   * Generate unique phone number (for testing)
   * Format: +1555<timestamp_last_7_digits>
   *
   * Example: +15551234567
   */
  static generateUniquePhoneNumber(): string {
    const timestamp = this.getUniqueTimestamp().toString();
    const last7Digits = timestamp.substring(timestamp.length - 7);
    return `+1555${last7Digits}`;
  }

  /**
   * Generate a set of unique data for a complete user profile
   *
   * @param prefix - Optional prefix for email categorization
   * @returns Object with email and name
   */
  static generateUniqueUserProfile(prefix?: string): { email: string; name: string } {
    const email = prefix
      ? this.generateEmailWithPrefix(prefix)
      : this.generateUniqueEmail();

    return {
      email,
      name: this.generateUniqueName(),
    };
  }

  /**
   * Generate a set of unique data for a complete family
   *
   * @param prefix - Optional prefix for categorization
   * @returns Object with familyName, admin profile, and invitationCode
   */
  static generateUniqueFamilyProfile(prefix?: string): {
    familyName: string;
    admin: { email: string; name: string };
    invitationCode: string;
  } {
    const adminProfile = this.generateUniqueUserProfile(prefix);

    return {
      familyName: this.generateUniqueFamilyName(),
      admin: adminProfile,
      invitationCode: this.generateUniqueInvitationCode(),
    };
  }

  /**
   * Generate debugging info for test data (useful for troubleshooting)
   *
   * @param data - The generated data to describe
   * @returns Human-readable info about the generated data
   */
  static debugInfo(data: string): string {
    const now = new Date();
    return `
Generated test data: ${data}
Timestamp: ${now.toISOString()}
Milliseconds: ${now.getTime()}
`;
  }

  // ============================================================
  // CHILD DATA GENERATION
  // ============================================================

  /**
   * Generates unique test child data
   * Application stores: name and age
   * Matches the actual application data model
   *
   * @param userPrefix - User prefix for this child (e.g., 'O' for Owner, 'M' for Member, 'A' for Admin)
   * @returns Object with child name and age
   *
   * Example:
   * ```typescript
   * const child1 = TestDataGenerator.generateChildData({ userPrefix: 'O' });
   * // Returns: { name: 'O-Emma abcdefgh', age: 10 }
   * ```
   */
  static generateChildData(userPrefix: string): { name: string; age: number } {
    return {
      name: this.generateUniqueChildName(userPrefix),
      age: 10, // Fixed age for consistency
    };
  }

  // ============================================================
  // VEHICLE DATA GENERATION
  // ============================================================

  /**
   * Generates unique test vehicle data
   * Application stores: name and capacity
   * Matches the actual application data model
   *
   * @param userPrefix - User prefix for this vehicle (e.g., 'O' for Owner, 'M' for Member)
   * @returns Object with vehicle name and capacity
   *
   * Example:
   * ```typescript
   * const vehicle1 = TestDataGenerator.generateVehicleData({ userPrefix: 'O' });
   * // Returns: { name: 'O-Toyota Camry 1705071234567 abc12345', capacity: 6 }
   * ```
   */
  static generateVehicleData(userPrefix: string): { name: string; capacity: number } {
    return {
      name: this.generateUniqueVehicleName(userPrefix),
      capacity: 6, // Default 6 seats
    };
  }

  // ============================================================
  // SCHEDULE DATA GENERATION (Phase 1+)
  // ============================================================

  /**
   * Generate unique schedule configuration
   *
   * Creates a complete schedule configuration with unique name
   * for test isolation. All time-based configurations use UTC for consistency.
   *
   * @param prefix - Unique prefix for this test (e.g., 'schdl_config_01')
   * @returns Object with schedule configuration
   *
   * Example:
   * ```typescript
   * const config = TestDataGenerator.generateUniqueScheduleConfig({
   *   prefix: 'schdl_owner'
   * });
   * // Returns: {
   * //   name: 'Test Schedule schdl_owner_1705071234567',
   * //   startTime: '08:00',
   * //   endTime: '17:00',
   * //   defaultCapacity: 5,
   * //   timezone: 'UTC',
   * //   enabled: true
   * // }
   * ```
   */
  static generateUniqueScheduleConfig(prefix: string): {
    name: string;
    startTime: string;
    endTime: string;
    defaultCapacity: number;
    timezone: string;
    enabled: boolean;
  } {
    const timestamp = this.getUniqueTimestamp();

    return {
      name: `Test Schedule ${prefix}_${timestamp}`,
      startTime: '08:00', // 08:00
      endTime: '17:00', // 17:00
      defaultCapacity: 5,
      timezone: 'UTC', // Important for consistency
      enabled: true,
    };
  }

  /**
   * Generates a valid time slot in the future (not in the past)
   *
   * IMPORTANT: Always generates future slots to avoid "past time" errors
   * Handles timezone consistency and daylight saving time edge cases
   *
   * @param dayOfWeek - Day of week (1=Monday, 7=Sunday)
   * @param hour - Hour in 24-hour format (0-23)
   * @param minute - Minute (0-59)
   * @param durationMinutes - Slot duration in minutes (default 30)
   * @returns Object with time slot data
   *
   * Example:
   * ```typescript
   * const mondaySlot = TestDataGenerator.generateValidTimeSlot({
   *   dayOfWeek: 1, // Monday
   *   hour: 8,
   *   minute: 30,
   *   durationMinutes: 30
   * });
   * ```
   */
  static generateValidTimeSlot(params: {
    dayOfWeek: number; // 1=Monday to 7=Sunday
    hour: number; // 0-23
    minute: number; // 0-59
    durationMinutes?: number;
  }): {
    dayOfWeek: number;
    startTime: Date;
    endTime: Date;
    durationMinutes: number;
    timezone: string;
    capacity: number;
  } {
    const {
      dayOfWeek,
      hour,
      minute,
      durationMinutes = 30,
    } = params;

    const now = new Date();

    // Find the next occurrence of the specified day of week
    const currentDay = now.getDay() || 7; // Convert 0 (Sunday) to 7
    let daysToAdd = (dayOfWeek - currentDay + 7) % 7;

    // If today is the target day, ensure it's not in the past
    if (daysToAdd === 0) {
      const slotTime = new Date(now);
      slotTime.setHours(hour, minute, 0, 0);

      if (slotTime <= now) {
        daysToAdd = 7; // Next week
      }
    }

    const slotDate = new Date(now);
    slotDate.setDate(slotDate.getDate() + daysToAdd);

    const slotStartTime = new Date(slotDate);
    slotStartTime.setHours(hour, minute, 0, 0);

    const slotEndTime = new Date(slotStartTime);
    slotEndTime.setMinutes(slotEndTime.getMinutes() + durationMinutes);

    return {
      dayOfWeek,
      startTime: slotStartTime,
      endTime: slotEndTime,
      durationMinutes,
      timezone: 'UTC', // Critical for consistency
      capacity: 5, // Default capacity
    };
  }

  /**
   * Generate unique booking code
   *
   * Creates a unique booking code for testing booking scenarios
   *
   * @returns Booking code with format: BOOK_<timestamp>_<random>
   *
   * Example: "BOOK_1705071234567_123"
   */
  static generateUniqueBookingCode(): string {
    const timestamp = this.getUniqueTimestamp();
    const random = Math.floor(Math.random() * 1000);
    return `BOOK_${timestamp}_${random}`;
  }

  // ============================================================
  // BATCH GENERATION HELPERS
  // ============================================================

  /**
   * Generate multiple children at once
   * Useful for testing family with multiple children
   *
   * @param count - Number of children to generate
   * @param userPrefix - Prefix for child names (e.g., 'O', 'M')
   * @returns Array of child data objects
   */
  static generateMultipleChildren(count: number, userPrefix: string): Array<{ name: string; age: number }> {
    const children = [];
    for (let i = 0; i < count; i++) {
      children.push(this.generateChildData(userPrefix));
    }
    return children;
  }

  /**
   * Generate multiple vehicles at once
   * Useful for testing family with multiple vehicles
   *
   * @param count - Number of vehicles to generate
   * @param userPrefix - Prefix for vehicle names (e.g., 'O', 'M')
   * @returns Array of vehicle data objects
   */
  static generateMultipleVehicles(count: number, userPrefix: string): Array<{ name: string; capacity: number }> {
    const vehicles = [];
    for (let i = 0; i < count; i++) {
      vehicles.push(this.generateVehicleData(userPrefix));
    }
    return vehicles;
  }

  // ============================================================
  // FILE PREFIX GENERATION (for test organization)
  // ============================================================

  /**
   * Generate a file-safe identifier for test artifacts
   * Useful for naming screenshots, videos, logs
   *
   * @param testName - Name of the test
   * @returns File-safe identifier (timestamp-based)
   *
   * Example:
   * ```typescript
   * const fileId = TestDataGenerator.generateFilePrefix('login-test');
   * // Returns: 'login-test_1705071234567'
   * ```
   */
  static generateFilePrefix(testName: string): string {
    const timestamp = this.getUniqueTimestamp();
    // Remove special characters, keep alphanumeric and hyphens
    const cleanName = testName.replace(/[^a-zA-Z0-9-]/g, '_');
    return `${cleanName}_${timestamp}`;
  }
}
