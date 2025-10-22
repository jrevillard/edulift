# Timezone Handling Implementation Plan for Time-Only Values

**Date**: 2025-10-18
**Problem**: Flutter mobile app and Node.js backend have misaligned interpretations of time-only values (e.g., "07:30") in schedule configurations, causing validation failures when users interact across timezones.

---

## Executive Summary

### The Core Problem

The current system treats time-only strings like `"07:30"` as **UTC times** in the backend, but the mobile app needs to display/configure them in the **user's local timezone**. This creates a fundamental mismatch:

- **User Intent**: "I want to book a slot at 7:30 AM in my local time"
- **Current Behavior**: App converts 7:30 local → 5:30 UTC (for UTC+2) → Backend rejects because scheduleHours contains "07:30" UTC

### Recommended Solution: **Floating Time Model**

After extensive research and expert consultation, the industry-standard approach is to treat `scheduleHours` as **"floating" or "wall clock" times** - timezone-agnostic time-of-day values that represent local times wherever the user is.

**Key Principle**: The strings "07:30", "08:00" in `scheduleHours` are NOT UTC times. They are LOCAL times that should appear the same on any user's clock, regardless of timezone.

---

## Research Findings

### Industry Best Practices

1. **Floating Time Concept** (Apple Calendar, Google Calendar):
   - Time-only recurring events use "wall clock time" that stays constant regardless of timezone
   - Example: "7:30 AM daily standup" should happen at 7:30 local time in NYC, Tokyo, or London

2. **PostgreSQL Recommendations**:
   - Use `timestamptz` (timestamp with time zone) for absolute points in time
   - Store as UTC internally, but accept/return with timezone context
   - Don't use `timestamp without time zone` for multi-timezone applications

3. **Flutter/Dart Best Practices**:
   - Use `timezone` package with IANA database for accurate DST handling
   - Use `TZDateTime` constructed with explicit date parts (not `TZDateTime.from()`)
   - Always initialize timezone database: `tz.initializeTimeZones()`
   - Use `flutter_native_timezone` to get device's current IANA timezone

4. **Node.js Best Practices**:
   - Use `luxon` for timezone-aware datetime operations
   - Validate timezone names before using them
   - Store UTC timestamps, but perform validation in user's timezone context

### Expert Recommendations (Gemini Pro Consultation)

**The fundamental insight**: A time-only string like "07:30" doesn't represent a unique point in time globally - it represents a LOCAL CONVENTION. The backend should store these as timezone-naive strings, and the client must provide timezone context when creating actual datetime bookings.

**New API Contract**:
- Backend → Client: Continue sending `scheduleHours` as-is (they're floating times)
- Client → Backend: Send BOTH the UTC timestamp AND the user's IANA timezone name

---

## Approach Evaluation

### Option A: Store as UTC, Convert in Mobile App ❌ **REJECTED**
**Current approach - fundamentally flawed**

**How it works**:
- Store "07:30" as UTC time in scheduleHours
- Mobile app converts user's local 7:30 → UTC for API calls
- Backend validates against UTC schedule times

**Pros**:
- Simple backend logic
- No timezone calculations on server

**Cons**:
- ❌ **BROKEN**: User in UTC+2 clicking "7:30 local" sends "5:30 UTC" which doesn't match "07:30" in scheduleHours
- ❌ Forces complex, error-prone logic on client
- ❌ Confusing error messages (shows UTC times to users expecting local times)
- ❌ Doesn't match user mental model ("7:30 should be 7:30 everywhere")
- ❌ No way to distinguish between "7:30 UTC" and "7:30 floating"

**Verdict**: This is the source of the current bug. Must abandon this approach.

---

### Option B: Store with UTC Offset ("07:30+00:00") ❌ **REJECTED**
**More explicit but doesn't solve the problem**

**How it works**:
- Store times as "07:30+00:00" in scheduleHours
- Explicitly mark them as UTC
- Mobile app still needs to convert

**Pros**:
- More explicit than plain "07:30"
- Makes UTC assumption visible

**Cons**:
- ❌ Doesn't solve the core problem (just makes the broken approach more verbose)
- ❌ Still doesn't account for DST
- ❌ Still forces user to think in UTC, not local time
- ❌ Doesn't match user intent ("I want 7:30 local, not 7:30 UTC")

**Verdict**: Just a more verbose version of the flawed approach. Reject.

---

### Option C: Floating Time with Timezone Context ✅ **RECOMMENDED**
**Industry standard for recurring local-time events**

**How it works**:
1. Store `scheduleHours` as timezone-naive strings: `{"MONDAY": ["07:30", "08:00"]}`
2. These represent "local clock times" (floating times)
3. When creating a booking:
   - Client sends UTC timestamp of the selected slot
   - Client ALSO sends user's IANA timezone name (e.g., "America/New_York")
4. Backend validation:
   - Converts UTC timestamp → user's local time using provided timezone
   - Checks if resulting local time exists in scheduleHours

**Pros**:
- ✅ Matches user mental model ("7:30 is 7:30")
- ✅ Handles DST correctly (via IANA timezone database)
- ✅ Handles day boundary crossings automatically
- ✅ Error messages show local times to users
- ✅ Backend stays pure UTC for storage, timezone-aware for validation
- ✅ Aligns with industry standards (Apple Calendar, Google Calendar)
- ✅ Clear API contract with explicit timezone metadata

**Cons**:
- ⚠️ Requires backend timezone logic (but this is unavoidable for correctness)
- ⚠️ Slightly more complex API (must send timezone name)
- ⚠️ Requires timezone database on both client and server

**Verdict**: **RECOMMENDED**. This is the correct solution.

---

### Option D: Reference Date Approach ("2000-01-01T07:30:00Z") ⚠️ **ALTERNATIVE**
**Store recurring times as full timestamps on a reference date**

**How it works**:
- Store times as full ISO 8601 timestamps on a fixed reference date
- Example: "07:30" becomes "2000-01-01T07:30:00Z"
- Extract time portion when needed

**Pros**:
- ✅ Database-friendly (full timestamp type)
- ✅ Removes ambiguity in storage
- ✅ Works well for recurring events in some calendar systems

**Cons**:
- ⚠️ Over-engineering for simple time-only values
- ⚠️ Still doesn't solve the timezone context problem
- ⚠️ More complex queries (need to extract time part)
- ⚠️ Doesn't inherently convey "this is a floating time"
- ⚠️ Client still needs to understand these are reference times, not actual dates

**Verdict**: Could work as an implementation detail for Option C, but doesn't solve the core timezone context problem on its own. Not necessary for this use case.

---

## Chosen Approach: Option C - Floating Time with Timezone Context

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                      MOBILE APP (Flutter)                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Get device timezone: "America/New_York" ────────┐       │
│                                                      │       │
│  2. User selects: "MONDAY 07:30"                    │       │
│                                                      │       │
│  3. Create TZDateTime in user's timezone:           │       │
│     TZDateTime(NY, 2025, 10, 20, 7, 30)             │       │
│                                                      │       │
│  4. Convert to UTC: 2025-10-20T11:30:00.000Z        │       │
│                                                      │       │
│  5. Send to API:                                    │       │
│     {                                                │       │
│       "datetime": "2025-10-20T11:30:00.000Z", ──────┼──┐    │
│       "userTimezone": "America/New_York" ───────────┘  │    │
│     }                                                   │    │
│                                                         │    │
└─────────────────────────────────────────────────────────┼────┘
                                                          │
                                                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND (Node.js)                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Receive:                                                 │
│     - datetime: "2025-10-20T11:30:00.000Z" (UTC)            │
│     - userTimezone: "America/New_York"                      │
│                                                              │
│  2. Load scheduleHours (floating times):                    │
│     { "MONDAY": ["07:30", "08:00", "15:30"] }               │
│                                                              │
│  3. Convert UTC → User's Local Time:                        │
│     DateTime.fromISO(utc).setZone(userTimezone)             │
│     → 2025-10-20T07:30:00-04:00 (EDT)                       │
│                                                              │
│  4. Extract local time: "07:30"                             │
│     Extract weekday: "MONDAY"                               │
│                                                              │
│  5. Validate:                                               │
│     scheduleHours["MONDAY"].includes("07:30") ✓             │
│                                                              │
│  6. Store datetime in DB as UTC (timestamptz)               │
│                                                              │
└─────────────────────────────────────────────────────────────┘

Storage Layer:
┌──────────────────────────────────────────────────────┐
│ PostgreSQL                                           │
├──────────────────────────────────────────────────────┤
│ scheduleHours: JSONB                                 │
│   { "MONDAY": ["07:30", "08:00"] }  ← Floating times│
│                                                      │
│ scheduleslot.datetime: TIMESTAMPTZ                   │
│   2025-10-20 11:30:00+00  ← Actual UTC timestamp   │
└──────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Mobile App (Flutter) - **Critical Path**

#### 1.1 Add Required Dependencies

**File**: `/workspace/mobile_app/pubspec.yaml`

```yaml
dependencies:
  # Existing dependencies...
  intl: any  # Already present

  # ADD THESE:
  timezone: ^0.10.0  # IANA timezone database and TZDateTime
  flutter_native_timezone: ^2.0.0  # Get device timezone
```

**Actions**:
- Run `flutter pub add timezone flutter_native_timezone`
- Run `flutter pub get`

---

#### 1.2 Create Timezone Service

**File**: `/workspace/mobile_app/lib/core/utils/timezone/timezone_service.dart` (NEW)

```dart
import 'package:timezone/timezone.dart' as tz;
import 'package:timezone/data/latest.dart' as tz;
import 'package:flutter_native_timezone/flutter_native_timezone.dart';
import 'package:logging/logging.dart';

/// Service for timezone-aware operations
/// Handles IANA timezone initialization and conversions
class TimezoneService {
  static final _logger = Logger('TimezoneService');
  static bool _initialized = false;
  static String? _cachedTimezone;

  /// Initialize timezone database (call once at app startup)
  static Future<void> initialize() async {
    if (_initialized) return;

    try {
      tz.initializeTimeZones();
      _initialized = true;
      _logger.info('Timezone database initialized');
    } catch (e) {
      _logger.severe('Failed to initialize timezone database', e);
      rethrow;
    }
  }

  /// Get the device's current IANA timezone name (e.g., "America/New_York")
  /// Caches the result for performance
  static Future<String> getDeviceTimezone() async {
    if (_cachedTimezone != null) return _cachedTimezone!;

    try {
      final timezone = await FlutterNativeTimezone.getLocalTimezone();
      _cachedTimezone = timezone;
      _logger.fine('Device timezone: $timezone');
      return timezone;
    } catch (e) {
      _logger.warning('Failed to get device timezone, defaulting to UTC', e);
      return 'UTC';
    }
  }

  /// Convert a time-only string (HH:mm) to UTC DateTime
  ///
  /// This is the KEY method that solves the timezone problem.
  ///
  /// [timeString] - Time in HH:mm format (e.g., "07:30")
  /// [date] - The specific date to apply this time to (usually from week calculation)
  /// [ianaTimezone] - The user's IANA timezone (e.g., "America/New_York")
  ///
  /// Returns: UTC DateTime ready to send to the backend
  ///
  /// Example:
  ///   convertLocalTimeToUtc("07:30", DateTime(2025, 10, 20), "America/New_York")
  ///   → TZDateTime(NY, 2025, 10, 20, 7, 30) → 2025-10-20T11:30:00.000Z (UTC)
  static DateTime convertLocalTimeToUtc(
    String timeString,
    DateTime date,
    String ianaTimezone,
  ) {
    if (!_initialized) {
      throw StateError('TimezoneService not initialized. Call initialize() first.');
    }

    // Parse time string (HH:mm)
    final parts = timeString.split(':');
    if (parts.length != 2) {
      throw FormatException('Invalid time format. Expected HH:mm, got: $timeString');
    }

    final hour = int.parse(parts[0]);
    final minute = int.parse(parts[1]);

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
      throw ArgumentError('Invalid time values: $timeString');
    }

    // Get timezone location
    final location = tz.getLocation(ianaTimezone);

    // Create TZDateTime in user's local timezone
    // IMPORTANT: This constructor handles DST correctly
    final localDateTime = tz.TZDateTime(
      location,
      date.year,
      date.month,
      date.day,
      hour,
      minute,
    );

    // Convert to UTC
    final utcDateTime = localDateTime.toUtc();

    _logger.fine(
      'Converted: $timeString on ${date.toIso8601String().split('T')[0]} '
      'in $ianaTimezone → LOCAL: ${localDateTime.toIso8601String()} '
      '→ UTC: ${utcDateTime.toIso8601String()}'
    );

    return utcDateTime;
  }

  /// Convert UTC DateTime to local time string (HH:mm)
  /// Used when displaying times from the backend
  ///
  /// [utcDateTime] - UTC DateTime from the backend
  /// [ianaTimezone] - The user's IANA timezone
  ///
  /// Returns: Time string in HH:mm format in user's local timezone
  static String convertUtcToLocalTimeString(
    DateTime utcDateTime,
    String ianaTimezone,
  ) {
    if (!_initialized) {
      throw StateError('TimezoneService not initialized. Call initialize() first.');
    }

    final location = tz.getLocation(ianaTimezone);
    final tzDateTime = tz.TZDateTime.from(utcDateTime, location);

    final hour = tzDateTime.hour.toString().padLeft(2, '0');
    final minute = tzDateTime.minute.toString().padLeft(2, '0');

    return '$hour:$minute';
  }

  /// Clear cached timezone (useful when user changes device timezone)
  static void clearCache() {
    _cachedTimezone = null;
    _logger.fine('Timezone cache cleared');
  }
}
```

---

#### 1.3 Initialize Timezone Service at App Startup

**File**: `/workspace/mobile_app/lib/main.dart`

```dart
// Add import
import 'package:edulift/core/utils/timezone/timezone_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // INITIALIZE TIMEZONE SERVICE (add this early)
  await TimezoneService.initialize();

  // ... rest of existing initialization ...

  runApp(const MyApp());
}
```

---

#### 1.4 Update ScheduleDateTimeService

**File**: `/workspace/mobile_app/lib/features/schedule/domain/services/schedule_datetime_service.dart`

```dart
import 'package:logging/logging.dart';
import 'package:edulift/core/utils/date/iso_week_utils.dart';
import 'package:edulift/core/utils/timezone/timezone_service.dart';

/// Domain service for schedule date/time calculations
/// Now timezone-aware using TimezoneService
class ScheduleDateTimeService {
  static final _logger = Logger('ScheduleDateTimeService');

  const ScheduleDateTimeService();

  /// Calculate the start date of a week from week string (e.g., "2025-W02")
  DateTime? calculateWeekStartDate(String week) {
    try {
      return parseMondayFromISOWeek(week);
    } catch (e) {
      _logger.warning('Failed to parse week start date: $week, error: $e');
      return null;
    }
  }

  /// Calculate full DateTime from day string, time string, and week
  ///
  /// **NEW BEHAVIOR**: Uses user's actual timezone for accurate conversion
  ///
  /// Example:
  ///   User in "America/New_York" (UTC-4 in summer)
  ///   calculateDateTimeFromSlot("MONDAY", "07:30", "2025-W42")
  ///   → Local: 2025-10-20T07:30:00-04:00
  ///   → UTC: 2025-10-20T11:30:00.000Z (sent to backend)
  ///
  /// Returns DateTime in UTC timezone for API compatibility
  Future<DateTime?> calculateDateTimeFromSlot(
    String day,
    String time,
    String week,
  ) async {
    try {
      final weekStart = calculateWeekStartDate(week);
      if (weekStart == null) return null;

      // Parse day to get offset (Monday = 0, Tuesday = 1, etc.)
      final dayLower = day.toLowerCase();
      final dayOffset = switch (dayLower) {
        'monday' || 'mon' => 0,
        'tuesday' || 'tue' => 1,
        'wednesday' || 'wed' => 2,
        'thursday' || 'thu' => 3,
        'friday' || 'fri' => 4,
        'saturday' || 'sat' => 5,
        'sunday' || 'sun' => 6,
        _ => throw ArgumentError('Invalid day: $day'),
      };

      // Calculate the specific date
      final date = weekStart.add(Duration(days: dayOffset));

      // Get user's timezone
      final userTimezone = await TimezoneService.getDeviceTimezone();

      // Convert local time to UTC using timezone service
      // This correctly handles DST and timezone offsets
      final utcDateTime = TimezoneService.convertLocalTimeToUtc(
        time,
        date,
        userTimezone,
      );

      _logger.fine(
        'Calculated datetime: day=$day, time=$time, week=$week, '
        'timezone=$userTimezone → UTC: ${utcDateTime.toIso8601String()}'
      );

      return utcDateTime;
    } catch (e) {
      _logger.warning(
        'Failed to calculate datetime: day=$day, time=$time, week=$week, error: $e'
      );
      return null;
    }
  }

  /// Get the user's timezone name (for sending to backend)
  Future<String> getUserTimezone() async {
    return await TimezoneService.getDeviceTimezone();
  }

  /// Calculate the end date of a week (Sunday 23:59:59.999 UTC)
  DateTime calculateWeekEndDate(DateTime weekStart) {
    return weekStart
        .add(const Duration(days: 7))
        .subtract(const Duration(milliseconds: 1));
  }
}
```

---

#### 1.5 Update API DTOs to Include Timezone

**File**: `/workspace/mobile_app/lib/core/network/models/schedule/create_schedule_slot_dto.dart` (check if exists, or create)

```dart
import 'package:freezed_annotation/freezed_annotation.dart';

part 'create_schedule_slot_dto.freezed.dart';
part 'create_schedule_slot_dto.g.dart';

/// DTO for creating a schedule slot
/// NOW INCLUDES userTimezone for backend validation
@freezed
class CreateScheduleSlotDto with _$CreateScheduleSlotDto {
  const factory CreateScheduleSlotDto({
    required String groupId,
    required DateTime datetime,  // UTC datetime
    required String userTimezone,  // IANA timezone name (e.g., "America/New_York")
  }) = _CreateScheduleSlotDto;

  factory CreateScheduleSlotDto.fromJson(Map<String, dynamic> json) =>
      _$CreateScheduleSlotDtoFromJson(json);
}
```

**File**: `/workspace/mobile_app/lib/core/network/models/schedule/assign_child_dto.dart` (update if exists)

```dart
// Add userTimezone field to any child assignment DTO
@freezed
class AssignChildToSlotDto with _$AssignChildToSlotDto {
  const factory AssignChildToSlotDto({
    required String slotId,
    required String childId,
    required DateTime datetime,  // The slot's datetime in UTC
    required String userTimezone,  // NEW: IANA timezone for validation
  }) = _AssignChildToSlotDto;

  factory AssignChildToSlotDto.fromJson(Map<String, dynamic> json) =>
      _$AssignChildToSlotDtoFromJson(json);
}
```

---

#### 1.6 Update Repository Layer

**File**: `/workspace/mobile_app/lib/features/schedule/data/repositories/schedule_repository_impl.dart`

```dart
// Update methods that create/update schedule slots

class ScheduleRepositoryImpl implements ScheduleRepository {
  final ScheduleDateTimeService _dateTimeService;
  // ... other dependencies

  @override
  Future<Result<ScheduleSlot>> createScheduleSlot({
    required String groupId,
    required String day,
    required String time,
    required String week,
  }) async {
    try {
      // Calculate UTC datetime
      final utcDateTime = await _dateTimeService.calculateDateTimeFromSlot(
        day,
        time,
        week,
      );

      if (utcDateTime == null) {
        return Result.failure(
          DomainError.validation('Invalid datetime calculation')
        );
      }

      // Get user's timezone
      final userTimezone = await _dateTimeService.getUserTimezone();

      // Create DTO with timezone
      final dto = CreateScheduleSlotDto(
        groupId: groupId,
        datetime: utcDateTime,
        userTimezone: userTimezone,  // NEW: Include timezone
      );

      // Send to API
      final response = await _apiClient.createScheduleSlot(dto);

      return Result.success(response.toDomain());
    } catch (e) {
      _logger.severe('Failed to create schedule slot', e);
      return Result.failure(DomainError.network(e.toString()));
    }
  }

  // Similar updates for assignChildToSlot, updateScheduleSlot, etc.
}
```

---

### Phase 2: Backend (Node.js) - **Critical Path**

#### 2.1 Add Luxon Dependency

**File**: `/workspace/backend/package.json`

```bash
npm install luxon
npm install --save-dev @types/luxon
```

---

#### 2.2 Create Timezone Validation Utility

**File**: `/workspace/backend/src/utils/timezoneUtils.ts` (NEW)

```typescript
import { DateTime } from 'luxon';

/**
 * Validate if a string is a valid IANA timezone name
 * Examples: "America/New_York", "Europe/London", "Asia/Tokyo"
 */
export function isValidTimezone(timezone: string): boolean {
  try {
    // Try to create a DateTime with this timezone
    const dt = DateTime.now().setZone(timezone);
    return dt.isValid;
  } catch {
    return false;
  }
}

/**
 * Convert UTC DateTime to local time in specified timezone
 * Returns the time string (HH:mm) and weekday in the user's timezone
 */
export function convertUtcToLocalTime(
  utcDatetime: Date,
  userTimezone: string
): { timeString: string; weekday: string } {
  // Validate timezone
  if (!isValidTimezone(userTimezone)) {
    throw new Error(`Invalid timezone: ${userTimezone}`);
  }

  // Convert to Luxon DateTime in user's timezone
  const localTime = DateTime.fromJSDate(utcDatetime, { zone: 'utc' })
    .setZone(userTimezone);

  if (!localTime.isValid) {
    throw new Error(`Invalid datetime conversion: ${utcDatetime}`);
  }

  // Extract time (HH:mm) and weekday
  const timeString = localTime.toFormat('HH:mm');
  const weekday = localTime.toFormat('EEEE').toUpperCase(); // "MONDAY", "TUESDAY", etc.

  return { timeString, weekday };
}

/**
 * Check if a time string is valid (HH:mm format)
 */
export function isValidTimeString(time: string): boolean {
  const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return regex.test(time);
}
```

---

#### 2.3 Update ScheduleSlotValidationService

**File**: `/workspace/backend/src/services/ScheduleSlotValidationService.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { convertUtcToLocalTime, isValidTimezone } from '../utils/timezoneUtils';

export class ScheduleSlotValidationService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Validates that a schedule slot time is configured in the group's schedule config
   *
   * **NEW BEHAVIOR**: Now accepts userTimezone and validates in user's local time
   *
   * @param groupId - The group ID
   * @param datetime - The datetime to validate (UTC)
   * @param userTimezone - The user's IANA timezone (e.g., "America/New_York")
   * @throws Error if time is not configured in group schedule
   */
  async validateScheduleTime(
    groupId: string,
    datetime: Date,
    userTimezone: string
  ): Promise<void> {
    // Validate timezone parameter
    if (!userTimezone || !isValidTimezone(userTimezone)) {
      throw new Error(
        `Invalid timezone: ${userTimezone}. Must be a valid IANA timezone name.`
      );
    }

    // Get the group's schedule configuration
    const scheduleConfig = await this.prisma.groupScheduleConfig.findUnique({
      where: { groupId }
    });

    // If no schedule config exists, reject the creation
    if (!scheduleConfig) {
      throw new Error(
        'Group has no schedule configuration. Please contact an administrator to configure schedule times.'
      );
    }

    // Convert UTC datetime to user's local time
    const { timeString, weekday } = convertUtcToLocalTime(datetime, userTimezone);

    // Get configured times for this weekday
    const scheduleHours = scheduleConfig.scheduleHours as Record<string, string[]>;
    const configuredTimes = scheduleHours[weekday] || [];

    // Check if the time is configured
    if (!configuredTimes.includes(timeString)) {
      // Build a helpful error message with available times IN USER'S LOCAL TIMEZONE
      const allConfiguredTimes = Object.values(scheduleHours).flat();
      const uniqueTimes = Array.from(new Set(allConfiguredTimes)).sort();

      throw new Error(
        `Time ${timeString} is not configured for ${weekday} in this group. ` +
        `Available times (in your local time ${userTimezone}): ${uniqueTimes.join(', ')}`
      );
    }

    // Success: time is valid
    console.log(
      `✓ Validated schedule time: ${timeString} ${weekday} ` +
      `(user timezone: ${userTimezone}, UTC: ${datetime.toISOString()})`
    );
  }

  // ... rest of existing methods (keep as-is) ...
}
```

---

#### 2.4 Update GroupScheduleConfigService

**File**: `/workspace/backend/src/services/GroupScheduleConfigService.ts`

```typescript
import { convertUtcToLocalTime } from '../utils/timezoneUtils';

export class GroupScheduleConfigService {
  // ... existing code ...

  /**
   * Validate that proposed schedule changes don't conflict with existing schedule slots
   *
   * **UPDATED**: Now checks against UTC slots converted to floating times
   */
  private async validateNoConflictsWithExistingSlots(
    groupId: string,
    proposedScheduleHours: ScheduleHours
  ): Promise<void> {
    const existingSlots = await this.prisma.scheduleSlot.findMany({
      where: {
        groupId,
        datetime: {
          gte: new Date() // Only check future slots
        }
      },
      select: {
        id: true,
        datetime: true,
        _count: {
          select: {
            childAssignments: true
          }
        }
      }
    });

    const conflicts: string[] = [];

    for (const slot of existingSlots) {
      // NOTE: We interpret existing slots as UTC for this validation
      // In a future migration, we might add a timezone column to slots
      const slotDate = new Date(slot.datetime);

      // Extract weekday and time IN UTC (treating stored datetimes as floating times)
      const weekday = slotDate.toLocaleDateString('en-US', {
        weekday: 'long',
        timeZone: 'UTC'
      }).toUpperCase();

      const timeSlot = slotDate.getUTCHours().toString().padStart(2, '0') + ':' +
                     slotDate.getUTCMinutes().toString().padStart(2, '0');

      // Check if this time slot would be removed in the new configuration
      const proposedTimes = proposedScheduleHours[weekday] || [];

      if (!proposedTimes.includes(timeSlot) && slot._count.childAssignments > 0) {
        conflicts.push(
          `${weekday} ${timeSlot} (${slot._count.childAssignments} children assigned)`
        );
      }
    }

    if (conflicts.length > 0) {
      throw new Error(
        `Cannot update schedule configuration. The following existing slots have children assigned and would be removed:\n` +
        conflicts.map(c => `  - ${c}`).join('\n')
      );
    }
  }

  // ... rest of existing methods ...
}
```

---

#### 2.5 Update API Route Handlers

**File**: `/workspace/backend/src/routes/scheduleSlotRoutes.ts` (or wherever schedule slot creation is handled)

```typescript
import { Request, Response } from 'express';
import { ScheduleSlotValidationService } from '../services/ScheduleSlotValidationService';

// Example route handler
router.post('/schedule-slots', async (req: Request, res: Response) => {
  try {
    const { groupId, datetime, userTimezone } = req.body;

    // Validate required fields
    if (!groupId || !datetime || !userTimezone) {
      return res.status(400).json({
        error: 'Missing required fields: groupId, datetime, userTimezone'
      });
    }

    // Parse datetime
    const datetimeObj = new Date(datetime);
    if (isNaN(datetimeObj.getTime())) {
      return res.status(400).json({
        error: 'Invalid datetime format'
      });
    }

    // Validate schedule time (NOW WITH TIMEZONE)
    const validationService = new ScheduleSlotValidationService(prisma);
    await validationService.validateScheduleTime(
      groupId,
      datetimeObj,
      userTimezone  // NEW: Pass user's timezone
    );

    // Create the schedule slot (store UTC datetime)
    const scheduleSlot = await prisma.scheduleSlot.create({
      data: {
        groupId,
        datetime: datetimeObj,  // Store as UTC (timestamptz)
        // ... other fields
      }
    });

    res.status(201).json(scheduleSlot);
  } catch (error) {
    console.error('Error creating schedule slot:', error);
    res.status(400).json({ error: error.message });
  }
});
```

---

#### 2.6 Update API Request Validation Schema

**File**: `/workspace/backend/src/validators/scheduleSlotValidator.ts` (create if doesn't exist)

```typescript
import { z } from 'zod';
import { isValidTimezone } from '../utils/timezoneUtils';

export const createScheduleSlotSchema = z.object({
  groupId: z.string().uuid(),
  datetime: z.string().datetime(),  // ISO 8601 format
  userTimezone: z.string().refine(
    (tz) => isValidTimezone(tz),
    { message: 'Invalid IANA timezone name' }
  ),
});

export const assignChildToSlotSchema = z.object({
  slotId: z.string().uuid(),
  childId: z.string().uuid(),
  datetime: z.string().datetime(),
  userTimezone: z.string().refine(
    (tz) => isValidTimezone(tz),
    { message: 'Invalid IANA timezone name' }
  ),
});

// Use in route handlers:
// const validatedData = createScheduleSlotSchema.parse(req.body);
```

---

### Phase 3: Testing Strategy

#### 3.1 Flutter Unit Tests

**File**: `/workspace/mobile_app/test/core/utils/timezone/timezone_service_test.dart` (NEW)

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:edulift/core/utils/timezone/timezone_service.dart';
import 'package:timezone/timezone.dart' as tz;

void main() {
  setUpAll(() async {
    await TimezoneService.initialize();
  });

  group('TimezoneService', () {
    test('convertLocalTimeToUtc handles UTC+2 correctly', () {
      final date = DateTime(2025, 10, 20); // Monday
      final timeString = '07:30';
      final timezone = 'Europe/Berlin'; // UTC+2 in summer

      final utc = TimezoneService.convertLocalTimeToUtc(
        timeString,
        date,
        timezone,
      );

      // 07:30 in Berlin (UTC+2) = 05:30 UTC
      expect(utc.hour, 5);
      expect(utc.minute, 30);
      expect(utc.isUtc, true);
    });

    test('convertLocalTimeToUtc handles UTC-5 correctly', () {
      final date = DateTime(2025, 10, 20);
      final timeString = '07:30';
      final timezone = 'America/New_York'; // UTC-4 in summer (EDT)

      final utc = TimezoneService.convertLocalTimeToUtc(
        timeString,
        date,
        timezone,
      );

      // 07:30 in NY (UTC-4) = 11:30 UTC
      expect(utc.hour, 11);
      expect(utc.minute, 30);
    });

    test('convertLocalTimeToUtc handles day boundary crossing', () {
      final date = DateTime(2025, 10, 20);
      final timeString = '23:30';
      final timezone = 'Europe/Berlin'; // UTC+2

      final utc = TimezoneService.convertLocalTimeToUtc(
        timeString,
        date,
        timezone,
      );

      // 23:30 in Berlin (UTC+2) = 21:30 UTC SAME DAY
      expect(utc.day, 20);
      expect(utc.hour, 21);
      expect(utc.minute, 30);
    });

    test('convertLocalTimeToUtc handles reverse day boundary', () {
      final date = DateTime(2025, 10, 20);
      final timeString = '01:30';
      final timezone = 'Pacific/Auckland'; // UTC+13

      final utc = TimezoneService.convertLocalTimeToUtc(
        timeString,
        date,
        timezone,
      );

      // 01:30 in Auckland (UTC+13) = 12:30 UTC PREVIOUS DAY
      expect(utc.day, 19);
      expect(utc.hour, 12);
      expect(utc.minute, 30);
    });

    test('convertUtcToLocalTimeString works correctly', () {
      final utc = DateTime.utc(2025, 10, 20, 11, 30);
      final timezone = 'America/New_York'; // UTC-4

      final timeString = TimezoneService.convertUtcToLocalTimeString(
        utc,
        timezone,
      );

      expect(timeString, '07:30');
    });

    test('throws on invalid time format', () {
      final date = DateTime(2025, 10, 20);

      expect(
        () => TimezoneService.convertLocalTimeToUtc('25:00', date, 'UTC'),
        throwsA(isA<ArgumentError>()),
      );

      expect(
        () => TimezoneService.convertLocalTimeToUtc('7:30', date, 'UTC'),
        throwsA(isA<FormatException>()),
      );
    });
  });
}
```

---

#### 3.2 Backend Unit Tests

**File**: `/workspace/backend/src/utils/__tests__/timezoneUtils.test.ts` (NEW)

```typescript
import { convertUtcToLocalTime, isValidTimezone, isValidTimeString } from '../timezoneUtils';

describe('timezoneUtils', () => {
  describe('isValidTimezone', () => {
    it('should validate correct IANA timezones', () => {
      expect(isValidTimezone('America/New_York')).toBe(true);
      expect(isValidTimezone('Europe/London')).toBe(true);
      expect(isValidTimezone('Asia/Tokyo')).toBe(true);
      expect(isValidTimezone('UTC')).toBe(true);
    });

    it('should reject invalid timezones', () => {
      expect(isValidTimezone('Invalid/Timezone')).toBe(false);
      expect(isValidTimezone('EST')).toBe(false); // Abbreviations not supported
      expect(isValidTimezone('')).toBe(false);
    });
  });

  describe('convertUtcToLocalTime', () => {
    it('should convert UTC to America/New_York correctly', () => {
      const utc = new Date('2025-10-20T11:30:00.000Z');
      const result = convertUtcToLocalTime(utc, 'America/New_York');

      expect(result.timeString).toBe('07:30'); // UTC-4 in summer
      expect(result.weekday).toBe('MONDAY');
    });

    it('should convert UTC to Europe/Berlin correctly', () => {
      const utc = new Date('2025-10-20T05:30:00.000Z');
      const result = convertUtcToLocalTime(utc, 'Europe/Berlin');

      expect(result.timeString).toBe('07:30'); // UTC+2 in summer
      expect(result.weekday).toBe('MONDAY');
    });

    it('should handle day boundary crossing', () => {
      const utc = new Date('2025-10-20T23:00:00.000Z');
      const result = convertUtcToLocalTime(utc, 'Pacific/Auckland');

      expect(result.weekday).toBe('TUESDAY'); // Crosses to next day
    });

    it('should throw on invalid timezone', () => {
      const utc = new Date('2025-10-20T11:30:00.000Z');

      expect(() => convertUtcToLocalTime(utc, 'Invalid/TZ')).toThrow('Invalid timezone');
    });
  });

  describe('isValidTimeString', () => {
    it('should validate correct time strings', () => {
      expect(isValidTimeString('07:30')).toBe(true);
      expect(isValidTimeString('00:00')).toBe(true);
      expect(isValidTimeString('23:59')).toBe(true);
    });

    it('should reject invalid time strings', () => {
      expect(isValidTimeString('24:00')).toBe(false);
      expect(isValidTimeString('7:30')).toBe(false); // Must be zero-padded
      expect(isValidTimeString('07:60')).toBe(false);
      expect(isValidTimeString('invalid')).toBe(false);
    });
  });
});
```

---

#### 3.3 Integration Tests

**File**: `/workspace/backend/src/services/__tests__/ScheduleSlotValidationService.integration.test.ts`

```typescript
import { PrismaClient } from '@prisma/client';
import { ScheduleSlotValidationService } from '../ScheduleSlotValidationService';

describe('ScheduleSlotValidationService Integration', () => {
  let prisma: PrismaClient;
  let service: ScheduleSlotValidationService;
  let testGroupId: string;

  beforeAll(async () => {
    prisma = new PrismaClient();
    service = new ScheduleSlotValidationService(prisma);

    // Create test group with schedule config
    const group = await prisma.group.create({
      data: {
        name: 'Test Group',
        scheduleConfig: {
          create: {
            scheduleHours: {
              MONDAY: ['07:30', '08:00', '15:30'],
              TUESDAY: ['07:30', '08:00', '15:30'],
            }
          }
        }
      },
      include: { scheduleConfig: true }
    });

    testGroupId = group.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.groupScheduleConfig.delete({ where: { groupId: testGroupId } });
    await prisma.group.delete({ where: { id: testGroupId } });
    await prisma.$disconnect();
  });

  it('should validate correct time in user timezone', async () => {
    // User in New York (UTC-4) wants 7:30 AM local
    // That's 11:30 UTC
    const utcDatetime = new Date('2025-10-20T11:30:00.000Z'); // Monday
    const userTimezone = 'America/New_York';

    await expect(
      service.validateScheduleTime(testGroupId, utcDatetime, userTimezone)
    ).resolves.not.toThrow();
  });

  it('should reject time not in schedule config', async () => {
    // User wants 10:00 AM local (not in config)
    const utcDatetime = new Date('2025-10-20T14:00:00.000Z'); // Monday 10:00 EDT
    const userTimezone = 'America/New_York';

    await expect(
      service.validateScheduleTime(testGroupId, utcDatetime, userTimezone)
    ).rejects.toThrow('Time 10:00 is not configured');
  });

  it('should work across different timezones', async () => {
    // User in Berlin (UTC+2) wants 7:30 AM local
    // That's 05:30 UTC
    const utcDatetime = new Date('2025-10-20T05:30:00.000Z'); // Monday
    const userTimezone = 'Europe/Berlin';

    await expect(
      service.validateScheduleTime(testGroupId, utcDatetime, userTimezone)
    ).resolves.not.toThrow();
  });

  it('should reject invalid timezone', async () => {
    const utcDatetime = new Date('2025-10-20T11:30:00.000Z');
    const invalidTimezone = 'Invalid/Timezone';

    await expect(
      service.validateScheduleTime(testGroupId, utcDatetime, invalidTimezone)
    ).rejects.toThrow('Invalid timezone');
  });
});
```

---

### Phase 4: Migration & Rollout

#### 4.1 Data Migration (if needed)

**Current State**: Existing `scheduleslot` records are stored as UTC timestamps.

**Future State**: Same! We're not changing how we store slots, just how we validate them.

**Migration**: NO DATABASE MIGRATION NEEDED ✅

The beauty of this approach is that it's **backward compatible**:
- Existing slots in the database remain unchanged
- New API calls include `userTimezone` for validation
- Old mobile app versions without timezone support will continue to work (with the old bug)
- New mobile app versions with timezone support will work correctly

---

#### 4.2 API Versioning (Optional)

If you want to maintain backward compatibility more explicitly:

**Option A: Make `userTimezone` optional with fallback**

```typescript
async validateScheduleTime(
  groupId: string,
  datetime: Date,
  userTimezone?: string  // Optional
): Promise<void> {
  // If no timezone provided, fall back to old behavior (UTC validation)
  if (!userTimezone) {
    console.warn('No userTimezone provided, using legacy UTC validation');
    userTimezone = 'UTC';
  }

  // ... rest of validation logic
}
```

**Option B: API versioning**

Create `/api/v2/schedule-slots` endpoint with required `userTimezone`, keep `/api/v1/schedule-slots` as-is.

---

#### 4.3 Rollout Plan

**Week 1: Backend Deployment**
1. Deploy backend changes to staging
2. Run integration tests
3. Test with Postman/manual API calls
4. Deploy to production
5. Monitor error logs

**Week 2: Mobile App Deployment**
1. Release mobile app update to internal testers (beta)
2. Test across multiple timezones (use VPN or device timezone changes)
3. Monitor crash reports and user feedback
4. Release to production (phased rollout: 10% → 50% → 100%)

**Week 3: Monitoring**
1. Monitor API error rates
2. Check for timezone-related validation failures
3. Collect user feedback
4. Fix any edge cases discovered

---

## Edge Cases & Testing Scenarios

### Edge Case 1: Day Boundary Crossing (West of UTC)

**Scenario**: User in `America/Los_Angeles` (UTC-7) books "00:30" (12:30 AM Monday)

**Calculation**:
- Local: Monday 2025-10-20 00:30 PDT
- UTC: Monday 2025-10-20 07:30 UTC (SAME DAY, 7 hours ahead)

**Validation**:
- Backend converts UTC back to Los Angeles time
- Extracts: "00:30" and "MONDAY"
- Checks if scheduleHours["MONDAY"] contains "00:30" ✓

**Test**:
```dart
test('Day boundary west of UTC', () {
  final utc = DateTime.utc(2025, 10, 20, 7, 30);
  final local = TimezoneService.convertUtcToLocalTimeString(utc, 'America/Los_Angeles');
  expect(local, '00:30');
});
```

---

### Edge Case 2: Day Boundary Crossing (East of UTC)

**Scenario**: User in `Pacific/Auckland` (UTC+13) books "00:30" (12:30 AM Tuesday)

**Calculation**:
- Local: Tuesday 2025-10-21 00:30 NZDT
- UTC: Monday 2025-10-20 11:30 UTC (PREVIOUS DAY!)

**Validation**:
- Backend converts UTC (Monday 11:30) to Auckland time (Tuesday 00:30)
- Extracts: "00:30" and "TUESDAY"
- Checks if scheduleHours["TUESDAY"] contains "00:30" ✓

**Test**:
```dart
test('Day boundary east of UTC', () {
  final date = DateTime(2025, 10, 21); // Tuesday local
  final utc = TimezoneService.convertLocalTimeToUtc('00:30', date, 'Pacific/Auckland');

  // Should convert to previous day in UTC
  expect(utc.day, 20); // Monday
  expect(utc.hour, 11);
  expect(utc.minute, 30);
});
```

---

### Edge Case 3: Daylight Saving Time Transition (Spring Forward)

**Scenario**: User in `America/New_York` on DST transition day (March 9, 2025 at 2:00 AM clocks jump to 3:00 AM)

**Problem**: What happens if user tries to book "02:30" which doesn't exist?

**Solution**: The `timezone` package handles this automatically:
- `TZDateTime(location, 2025, 3, 9, 2, 30)` will either:
  - Round to 3:00 AM (most likely)
  - Throw an error (depends on implementation)

**Test**:
```dart
test('DST spring forward handles non-existent time', () {
  final date = DateTime(2025, 3, 9); // DST transition day
  final timezone = 'America/New_York';

  // 02:30 doesn't exist on this day (clock jumps 2:00 → 3:00)
  final utc = TimezoneService.convertLocalTimeToUtc('02:30', date, timezone);

  // Should handle gracefully (likely maps to 3:00 or 2:30 pre-DST)
  expect(utc, isNotNull);
  // The exact behavior depends on timezone package implementation
});
```

**Recommendation**: Add validation to warn users if they're trying to create a slot during DST transition hour.

---

### Edge Case 4: Daylight Saving Time Transition (Fall Back)

**Scenario**: User in `America/New_York` on DST end day (November 2, 2025 at 2:00 AM clocks fall back to 1:00 AM)

**Problem**: "01:30" occurs TWICE on this day (once in EDT, once in EST)

**Solution**: `TZDateTime` will choose one (usually the later occurrence)

**Test**:
```dart
test('DST fall back handles ambiguous time', () {
  final date = DateTime(2025, 11, 2); // DST end day
  final timezone = 'America/New_York';

  // 01:30 occurs twice on this day
  final utc1 = TimezoneService.convertLocalTimeToUtc('01:30', date, timezone);

  // The timezone package will pick one (likely the second occurrence)
  expect(utc1, isNotNull);
  // For production, you might want to add a flag to specify which occurrence
});
```

---

### Edge Case 5: User Traveling Across Timezones

**Scenario**:
1. User sets up schedule in `America/New_York` with "07:30" slots
2. User flies to `Asia/Tokyo` and opens the app

**Current Behavior** (with this implementation):
- App gets device timezone: `Asia/Tokyo`
- Displays scheduleHours "07:30" as-is (floating time)
- If user books a "07:30" slot, it creates it for 07:30 Tokyo time

**Is this correct?** It depends on business logic:

**Option A: Floating Time (Recommended)**
- "07:30" always means 7:30 AM local time, wherever you are
- Makes sense for recurring personal tasks ("wake up at 7:30")

**Option B: Fixed Timezone**
- Schedule is tied to the group's timezone
- Would need to store `groupTimezone` in database
- Display: "07:30 EDT (20:30 JST)"

**Recommendation**: Start with Option A (floating time). If users complain, add Option B as a feature.

---

### Edge Case 6: Timezone Name Changes

**Scenario**: Government changes timezone rules or names (rare but happens)

**Solution**:
- Update timezone database when new version is released
- Flutter: `timezone` package updates with `flutter pub upgrade`
- Node.js: Luxon automatically uses system timezone database

**Mitigation**:
- Store IANA timezone names (e.g., "America/New_York"), NOT abbreviations (EST)
- IANA names are stable; rules change but names don't
- Regularly update dependencies

---

## Testing Checklist

### Manual Testing

- [ ] User in UTC+2 (Europe/Berlin) books "07:30" → Backend receives and validates correctly
- [ ] User in UTC-5 (America/New_York) books "07:30" → Works correctly
- [ ] User in UTC+12 (Pacific/Auckland) books "23:30" → Handles day boundary
- [ ] User books time not in scheduleHours → Gets clear error message in local time
- [ ] User with invalid timezone string → Gets validation error
- [ ] Change device timezone mid-session → App recalculates correctly
- [ ] Test on DST transition days (March & November in US)
- [ ] Test with all timezones: UTC-12 to UTC+14

### Automated Testing

- [ ] All Flutter unit tests pass (`flutter test`)
- [ ] All backend unit tests pass (`npm test`)
- [ ] Integration tests pass (schedule creation, validation)
- [ ] End-to-end tests across multiple timezones

### Performance Testing

- [ ] Timezone conversion doesn't cause lag (<100ms)
- [ ] Timezone database initialization is fast (<500ms at app startup)
- [ ] Caching of device timezone works (no repeated async calls)

---

## Documentation Updates

### API Documentation

Update API docs (Swagger/OpenAPI) to include `userTimezone` parameter:

```yaml
/api/schedule-slots:
  post:
    requestBody:
      required: true
      content:
        application/json:
          schema:
            type: object
            required:
              - groupId
              - datetime
              - userTimezone
            properties:
              groupId:
                type: string
                format: uuid
              datetime:
                type: string
                format: date-time
                description: "UTC datetime in ISO 8601 format"
                example: "2025-10-20T11:30:00.000Z"
              userTimezone:
                type: string
                description: "IANA timezone name"
                example: "America/New_York"
```

---

### Code Comments

Add clear comments explaining the floating time model:

```dart
/// scheduleHours contains FLOATING TIMES - timezone-agnostic time-of-day values
/// Example: {"MONDAY": ["07:30", "08:00"]}
///
/// These times represent LOCAL clock times, meaning "07:30" should appear as
/// 7:30 AM on the user's clock regardless of their timezone.
///
/// When creating a schedule slot:
/// 1. Convert the floating time to the user's local timezone
/// 2. Convert the local datetime to UTC for storage
/// 3. Send both UTC datetime AND user timezone to the backend
///
/// The backend will validate by converting UTC back to the user's local time
/// and checking if it matches a floating time in scheduleHours.
```

---

## Potential Pitfalls & How to Avoid Them

### Pitfall 1: Using DateTime.parse() without timezone awareness

**Bad**:
```dart
final dt = DateTime.parse('2025-10-20T07:30:00'); // What timezone?
```

**Good**:
```dart
final utc = DateTime.parse('2025-10-20T07:30:00Z'); // Explicit UTC
// OR
final local = TimezoneService.convertLocalTimeToUtc('07:30', date, timezone);
```

---

### Pitfall 2: Using TZDateTime.from() instead of TZDateTime constructor

**Bad** (may give wrong DST offset):
```dart
final dt = DateTime(2025, 10, 20, 7, 30);
final tz = tz.TZDateTime.from(dt, location); // ⚠️ Uses CURRENT offset, not date's offset
```

**Good**:
```dart
final tz = tz.TZDateTime(location, 2025, 10, 20, 7, 30); // ✅ Correct DST for this date
```

---

### Pitfall 3: Not validating timezone names

**Bad**:
```typescript
const tz = req.body.userTimezone; // Could be "asdfasdf"
const dt = DateTime.fromISO(utc).setZone(tz); // Silently fails
```

**Good**:
```typescript
if (!isValidTimezone(userTimezone)) {
  throw new Error('Invalid timezone');
}
const dt = DateTime.fromISO(utc).setZone(userTimezone);
```

---

### Pitfall 4: Storing timezone abbreviations (EST, PST) instead of IANA names

**Bad**:
```dart
final timezone = 'EST'; // ❌ Ambiguous, doesn't handle DST
```

**Good**:
```dart
final timezone = 'America/New_York'; // ✅ Unambiguous, handles DST
```

---

### Pitfall 5: Forgetting to initialize timezone database

**Bad**:
```dart
void main() {
  runApp(MyApp()); // ❌ Timezone database not initialized
}
```

**Good**:
```dart
Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await TimezoneService.initialize(); // ✅ Initialize first
  runApp(MyApp());
}
```

---

## Success Metrics

### How to know if the implementation is successful:

1. **Zero validation errors** due to timezone mismatch (current bug is fixed)
2. **User-facing times are in local timezone** (no more "why is my 7:30 AM showing as 5:30?")
3. **Error messages show local times** (e.g., "7:30 is not available" instead of "5:30 UTC")
4. **Works across all timezones** (UTC-12 to UTC+14)
5. **Handles DST transitions** without crashes
6. **No performance regression** (timezone conversions are fast)

---

## Alternative Approaches Considered (but not recommended)

### 1. Store Everything in User's Local Timezone ❌

**Why not**:
- Backend would need to store different timezones per user
- Database queries become complex
- Violates "store in UTC" best practice
- Doesn't handle group coordination (users in different timezones)

---

### 2. Duplicate Storage (UTC + Local) ❌

**Why not**:
- Data redundancy
- Synchronization issues
- Wastes storage
- Complexity without benefit

---

### 3. Client-Side Only Solution (No Backend Changes) ❌

**Why not**:
- Backend validation would still fail (the current bug)
- Security risk (client can't be trusted for validation)
- Backend needs to know user's context for correct validation

---

## Conclusion

### Summary of Chosen Approach

**Floating Time Model with Timezone Context** is the industry-standard solution that:

1. ✅ Treats `scheduleHours` as timezone-agnostic "wall clock times"
2. ✅ Requires client to send user's IANA timezone with every booking
3. ✅ Backend validates by converting UTC → user's local time → check against floating times
4. ✅ Handles all edge cases: DST, day boundaries, timezone changes
5. ✅ Aligns with user mental model ("7:30 should be 7:30")
6. ✅ Maintains UTC storage for absolute timestamps
7. ✅ Works across all timezones globally

### Next Steps

1. **Review this plan** with the team
2. **Add dependencies** (timezone packages)
3. **Implement Phase 1** (Mobile App - 2-3 days)
4. **Implement Phase 2** (Backend - 1-2 days)
5. **Write tests** (Phase 3 - 2 days)
6. **Deploy to staging** and test manually
7. **Deploy to production** with phased rollout
8. **Monitor** for edge cases and user feedback

---

## References

### Research Sources

1. **Web Search Results**:
   - Flutter timezone handling best practices (2025)
   - PostgreSQL timestamp storage recommendations
   - Calendar app floating time implementations
   - Luxon timezone validation patterns

2. **Expert Consultation**:
   - Gemini Pro analysis of timezone handling approaches
   - Recommendations for IANA timezone usage
   - DST handling strategies

3. **Industry Standards**:
   - Apple Calendar floating time zone feature
   - Google Calendar recurring event timezone handling
   - RFC 5545 (iCalendar) recurrence rules

### Key Packages

- **Flutter**: `timezone` (^0.10.0), `flutter_native_timezone` (^2.0.0)
- **Node.js**: `luxon` (^3.7.2)
- **Database**: PostgreSQL `timestamptz` type

---

**End of Implementation Plan**
