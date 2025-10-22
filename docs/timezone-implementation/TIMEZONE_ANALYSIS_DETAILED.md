# EduLift Timezone Handling Analysis: Week/Day/Schedule Slot Calculations

## Executive Summary

This analysis reveals **critical timezone handling inconsistencies** in the EduLift scheduling system that **will cause bugs** when implementing the Floating Time Model (where `scheduleHours` times are treated as wall-clock times, timezone-agnostic).

**Key Finding**: The codebase currently treats week/day calculations **inconsistently across frontend, mobile app, and backend**, mixing UTC and local time assumptions. When the Floating Time Model is introduced, these inconsistencies will cause:

1. Wrong weekdays being matched for schedule validation
2. Incorrect week boundaries when filtering schedules
3. Mismatched datetime components when constructing schedule slots
4. User-visible times that don't match what users configured

---

## 1. WEEK CALCULATIONS ANALYSIS

### 1.1 Current Implementation

#### Mobile App (`/workspace/mobile_app/lib/core/utils/date/iso_week_utils.dart`)

**Timezone Handling**: ISO week calculations **always use local time by default** when creating `DateTime()` without UTC suffix.

```dart
// Lines 87-97: getMondayOfISOWeek()
DateTime getMondayOfISOWeek(int year, int weekNumber) {
  // ✅ CRITICAL FIX: Create directly in UTC to avoid timezone conversion issues
  final jan4 = DateTime.utc(year, 1, 4);
  final week1Monday = jan4.subtract(Duration(days: jan4.weekday - 1));
  return week1Monday.add(Duration(days: (weekNumber - 1) * 7));
}

// Lines 49-53: getISOWeekString()
String getISOWeekString(DateTime date) {
  final year = getISOWeekYear(date);
  final weekNumber = getISOWeekNumber(date);
  return '$year-W${weekNumber.toString().padLeft(2, '0')}';
}

// Lines 21-37: getISOWeekNumber()
int getISOWeekNumber(DateTime date) {
  final thursday = date.add(Duration(days: DateTime.thursday - date.weekday));
  final jan4 = DateTime(thursday.year, 1, 4); // ⚠️ Creates LOCAL datetime
  final week1Monday = jan4.subtract(Duration(days: jan4.weekday - DateTime.monday));
  final daysSinceWeek1 = thursday.difference(week1Monday).inDays;
  final weekNumber = (daysSinceWeek1 / 7).floor() + 1;
  return weekNumber;
}
```

**Issue**: Line 27 creates `DateTime(thursday.year, 1, 4)` which is a **local datetime**, not UTC. This means week number calculations vary based on the device's timezone.

**Example (UTC+2 timezone - Europe/Paris)**:
- December 31, 2024 10:00 UTC = January 1, 2025 12:00 local
- `getISOWeekNumber(Dec 31 UTC)` calculates using Dec 31 → week 1 of 2025
- `getISOWeekNumber(Jan 1 local)` calculates using Jan 1 → week 1 of 2025
- Result: Same date, different week calculation based on how it's created

**Test Coverage**: Tests use `DateTime()` (local) which passes in test environment but masks the bug.

#### Frontend (`/workspace/frontend/src/utils/weekCalculations.ts`)

**Timezone Handling**: Also uses **local time assumptions**.

```typescript
// Lines 10-17: getISOWeekNumber()
export const getISOWeekNumber = (date: Date): number => {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7; // ⚠️ getDay() uses LOCAL time
  target.setDate(target.getDate() - dayNr + 3);
  const jan4 = new Date(target.getFullYear(), 0, 4); // ⚠️ LOCAL time
  const dayDiff = (target.getTime() - jan4.getTime()) / 86400000;
  return 1 + Math.ceil(dayDiff / 7);
};
```

**Issue**: Uses `getDay()` and local `Date` constructor, making calculations timezone-dependent.

#### Backend (None - no week calculation!)

**Finding**: Backend **does NOT calculate weeks**. It only validates times against configured `scheduleHours` by extracting UTC weekday/time from stored UTC datetime.

### 1.2 Should Week Numbers Use UTC or Local Time?

**RECOMMENDATION: Use UTC for all week calculations**

**Reasoning**:
1. **Consistency**: Week is a calendar concept, not a local concept
2. **Boundary Issues**: A date can be in different weeks in different timezones
3. **Backend sync**: Backend validation uses UTC
4. **ISO 8601 standard**: Week boundaries are absolute, not timezone-dependent

**Current Status**: Mobile app partially does this (line 90 uses `DateTime.utc()`), but mix of UTC and local creates confusion.

---

## 2. DAY/WEEKDAY CALCULATIONS ANALYSIS

### 2.1 Current Implementation

#### Backend (`/workspace/backend/src/services/ScheduleSlotValidationService.ts`, lines 266-274)

```typescript
// Get weekday from UTC datetime
const weekday = datetime.toLocaleDateString('en-US', {
  weekday: 'long',
  timeZone: 'UTC'  // ✅ Correctly extracts UTC weekday
}).toUpperCase();

const hours = datetime.getUTCHours().toString().padStart(2, '0');
const minutes = datetime.getUTCMinutes().toString().padStart(2, '0');
const timeSlot = `${hours}:${minutes}`;
```

**Current Behavior**: Extracts weekday and time in **UTC**.

**Validation Logic**:
```typescript
const configuredTimes = scheduleHours[weekday] || [];
if (!configuredTimes.includes(timeSlot)) {
  throw new Error(`Time ${timeSlot} is not configured for ${weekday}...`);
}
```

**Example Problem** (with Floating Time Model - NOT YET IMPLEMENTED):
- User in Europe/Paris (UTC+2) schedules "Monday 07:30 local"
- Mobile app sends: week=2025-W02, day=MONDAY, time=07:30
- Backend should convert to UTC: Sunday 05:30 UTC
- But validation might check SUNDAY (UTC) vs MONDAY (configured)
- **Result**: Schedule rejected or wrong day matched

#### Mobile App DTOs (`/workspace/mobile_app/lib/core/network/models/schedule/schedule_slot_dto.dart`, lines 40-49)

```dart
@override
ScheduleSlot toDomain() {
  final now = DateTime.now();

  // Convert UTC datetime to local time for display
  final localDatetime = datetime.toLocal();  // ✅ Correct approach

  // Convert backend datetime to TYPE-SAFE domain entities
  final weekNumber = _getWeekFromDateTime(localDatetime);
  final dayOfWeek = DayOfWeek.fromWeekday(localDatetime.weekday);  // ⚠️ Local weekday
  final timeOfDay = TimeOfDayValue.fromDateTime(localDatetime);
```

**Current Behavior**: 
1. Receives UTC datetime from backend
2. Converts to local with `.toLocal()`
3. **Extracts weekday from local datetime** (correct for display)

**Example**:
- Backend sends: `2025-01-13T23:30:00Z` (Monday 23:30 UTC)
- Local conversion (UTC+2): Tuesday 01:30 local
- `localDatetime.weekday` → **Tuesday** (correct!)
- Display shows Tuesday (correct!)

#### Mobile App Datetime Construction (`/workspace/mobile_app/lib/features/schedule/domain/services/schedule_datetime_service.dart`, lines 57-71)

```dart
// ✅ FIX: Build datetime in LOCAL timezone first (what the user sees/clicks)
final date = weekStart.add(Duration(days: dayOffset));
final localDateTime = DateTime(
  date.year,
  date.month,
  date.day,
  hour,
  minute,  // User clicked "07:30" meaning 07:30 in LOCAL time
);

// ✅ Then convert to UTC for API/backend storage
final utcDateTime = localDateTime.toUtc();
```

**Current Behavior**: 
1. Takes week start (Monday of ISO week)
2. Adds day offset to get specific day
3. Creates **local datetime** with user's clicked time
4. Converts to UTC for transmission
5. **CRITICAL**: This implementation is correct for the Floating Time Model!

### 2.2 Should Weekday Extraction Use UTC or Local Time?

**RECOMMENDATION: Depends on context**

**For Display/UI** (Mobile App): **Use LOCAL time**
- User sees "Monday 07:30" in their timezone
- Correct to extract weekday from local datetime
- ✅ Already implemented correctly in DTO

**For Backend Validation** (Current Code): **Currently uses UTC**
- Validates against `scheduleHours` which are defined by user as wall-clock times
- ❌ **PROBLEM**: Backend should convert to local time first, then validate

**Example of the Bug**:
```
Group config:   MONDAY: ['07:30', '08:00']
User timezone:  UTC+2 (Europe/Paris)
User action:    Tries to create slot for Monday 07:30 local

Current behavior:
  - Mobile: user_time(Monday 07:30) → sends UTC(Sunday 05:30)
  - Backend: UTC(Sunday 05:30) → extracts SUNDAY + 05:30
  - Validation: SUNDAY 05:30 NOT in config → REJECTS ❌

Expected behavior with Floating Time Model:
  - Mobile: user_time(Monday 07:30) → sends UTC(Sunday 05:30) + timezone(Europe/Paris)
  - Backend: UTC(Sunday 05:30) + timezone → converts to MONDAY 07:30 local
  - Validation: MONDAY 07:30 IS in config → ACCEPTS ✅
```

---

## 3. SCHEDULE SLOT DATETIME CONSTRUCTION ANALYSIS

### 3.1 Current Flow

**Mobile App - When Creating a Slot** (Lines 57-71 in `schedule_datetime_service.dart`):

```
Input:    day="Monday", time="07:30", week="2025-W02"
          + User's local timezone (implied from device)

Step 1:   Get Monday of week 2025-W02
          Monday = 2025-01-06 (UTC datetime from getMondayOfISOWeek)

Step 2:   Add days to get specific day
          date = 2025-01-06 + 0 days = 2025-01-06 (Monday)

Step 3:   Create LOCAL datetime with time
          localDateTime = DateTime(2025, 1, 6, 7, 30) = 2025-01-06 07:30 local

Step 4:   Convert to UTC
          utcDateTime = localDateTime.toUtc()
          IF timezone is UTC+2: utcDateTime = 2025-01-06 05:30 UTC

Output:   2025-01-06T05:30:00Z (UTC)
```

**Test Verification** (Lines 30-47 in `schedule_datetime_service_test.dart`):

```dart
test('should calculate correct UTC datetime for Monday 07:30', () {
  final result = service.calculateDateTimeFromSlot('Monday', '07:30', '2025-W02');
  
  expect(result!.isUtc, isTrue);
  expect(result.year, equals(2025));
  expect(result.month, equals(1));
  expect(result.day, equals(6));

  // ✅ FIX: Verify round-trip instead of direct UTC hour
  final local = result.toLocal();
  expect(local.hour, equals(7), reason: 'Local hour should be 7');
  expect(local.minute, equals(30), reason: 'Local minute should be 30');
});
```

**Key Point**: Tests verify **round-trip conversion** (UTC → Local), not absolute UTC values, which correctly handles variable timezones.

### 3.2 Is There a Timezone Bug in Datetime Construction?

**Status**: **NO - Mobile app implementation is CORRECT**

The mobile app correctly:
1. Parses user's local time (what they see/click)
2. Creates local datetime
3. Converts to UTC for backend transmission
4. Tests verify round-trip behavior

**However**: Backend validation is **currently broken** for this flow because:
- Backend receives UTC datetime
- Backend extracts UTC weekday (instead of local)
- Backend validates against local-time-based scheduleHours

---

## 4. DATE BOUNDARY ISSUES ANALYSIS

### 4.1 Example Scenario: Crossing Day Boundaries

**Scenario**: User in Tokyo (UTC+9) wants to schedule "Monday 08:00 local"

```
Timeline:
  Monday 08:00 JST (Tokyo) = Sunday 23:00 UTC
  ↑ Monday locally
  ↑ But Sunday in UTC!

Current mobile app behavior:
  1. User clicks "Monday 08:00"
  2. calculateDateTimeFromSlot("Monday", "08:00", "2025-W02")
  3. Gets Monday 2025-01-06 from week
  4. Creates DateTime(2025, 1, 6, 8, 0) local = Monday 08:00 JST
  5. Converts to UTC: 2025-01-05 23:00 UTC
  6. Sends to backend: "2025-01-05T23:00:00Z"

Current backend validation:
  1. Receives: 2025-01-05T23:00:00Z
  2. Extracts weekday with UTC: SUNDAY (WRONG!)
  3. Extracts time: 23:00 (WRONG!)
  4. Looks for SUNDAY 23:00 in scheduleHours
  5. Config probably has MONDAY 08:00, not SUNDAY 23:00
  6. Validation FAILS ❌

With Floating Time Model (needed):
  1. Mobile sends timezone: "Asia/Tokyo" with the request
  2. Backend receives: datetime + timezone
  3. Backend converts: UTC 2025-01-05 23:00 → Local 2025-01-06 08:00 JST
  4. Backend extracts: MONDAY + 08:00
  5. Validation SUCCEEDS ✅
```

### 4.2 Edge Case: Year Boundaries

**From test** (`schedule_slot_dto_test.dart`, lines 460-473):

```dart
test('should handle year boundary correctly', () {
  final dto = ScheduleSlotDto(
    id: 'slot-1',
    groupId: 'group-1',
    datetime: DateTime.utc(2024, 12, 31, 8),
  );
  
  final domain = dto.toDomain();
  
  expect(domain.dayOfWeek, DayOfWeek.tuesday);
  expect(domain.week.startsWith('2025-W'), isTrue); // Crosses year boundary!
});
```

**Analysis**: December 31 at 08:00 UTC in some timezones (e.g., UTC+10) becomes January 1 local time, which is in week 1 of 2025 (ISO 8601). The mobile app correctly handles this by converting to local time first.

---

## 5. SCHEDULE DISPLAY/FILTERING ANALYSIS

### 5.1 Backend Schedule Retrieval (`/workspace/backend/src/services/ScheduleSlotService.ts`, lines 254-275)

```typescript
async getSchedule(groupId: string, startDate?: string, endDate?: string) {
  let rangeStart: Date;
  let rangeEnd: Date;

  if (startDate && endDate) {
    rangeStart = new Date(startDate);
    rangeEnd = new Date(endDate);
  } else {
    // Default to current week (Monday to Sunday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    rangeStart = new Date(now);
    rangeStart.setDate(now.getDate() + daysToMonday);
    rangeStart.setUTCHours(0, 0, 0, 0);  // ⚠️ Sets UTC hours

    rangeEnd = new Date(rangeStart);
    rangeEnd.setDate(rangeStart.getDate() + 6);
    rangeEnd.setUTCHours(23, 59, 59, 999);
  }

  const slots = await this.scheduleSlotRepository.getWeeklyScheduleByDateRange(
    groupId, 
    rangeStart, 
    rangeEnd
  );
}
```

**Issue**: 
1. Uses `now.getDay()` which is **local weekday** (line 265)
2. But then calculates with `setUTCHours()` which is **UTC-based** (line 270)
3. Creates week boundary mismatch

**Example (UTC+2, user in Europe/Paris)**:
```
now = 2025-01-13 12:00 local = 2025-01-13 10:00 UTC
now.getDay() = 1 (Monday local)
daysToMonday = 0
rangeStart = setDate(13), setUTCHours(0,0,0,0)
           = 2025-01-13 00:00 UTC
           = 2025-01-13 02:00 local (still Monday locally)
rangeEnd = 2025-01-19 23:59:59 UTC

But if it were UTC+9 (Tokyo):
now = 2025-01-13 21:00 local = 2025-01-13 12:00 UTC (Tuesday locally!)
now.getDay() = 2 (Tuesday local)
daysToMonday = -1
rangeStart = setDate(12), setUTCHours(0,0,0,0)
           = 2025-01-12 00:00 UTC
           = 2025-01-12 09:00 local (Monday)
           
Result: Correct week start, but by accident!
```

### 5.2 Frontend Week Filtering

Frontend generates week display using `weekCalculations.ts` which uses **local time**. When comparing with backend results (UTC), there can be mismatches.

---

## 6. CRITICAL ISSUES SUMMARY

| # | Issue | Location | Severity | Impact |
|---|-------|----------|----------|--------|
| 1 | Week calculation mixes UTC and local | `iso_week_utils.dart` line 27 | HIGH | Different weeks in different timezones |
| 2 | Backend validates UTC weekday against local config | `ScheduleSlotValidationService.ts` lines 266-274 | CRITICAL | Schedule slots rejected for correct times |
| 3 | Date boundary crossing not handled | `ScheduleSlotService.ts` line 265 | HIGH | Week boundaries wrong in non-UTC timezones |
| 4 | Frontend week calculations timezone-dependent | `weekCalculations.ts` | MEDIUM | UI shows wrong weeks in non-UTC timezones |
| 5 | No timezone sent with requests | All services | CRITICAL | Backend can't convert UTC to local |

---

## 7. FLOATING TIME MODEL REQUIREMENTS

To implement the Floating Time Model correctly, the following changes are REQUIRED:

### 7.1 Mobile App Changes

**ADD: Send timezone with all schedule requests**

```dart
// New DTO field
class CreateScheduleSlotRequest {
  final String datetime;  // UTC ISO string
  final String timezone;  // IANA timezone (e.g., "Europe/Paris")
  final String groupId;
}

// Usage
final request = CreateScheduleSlotRequest(
  datetime: utcDateTime.toIso8601String(),
  timezone: await _getDeviceTimezone(),  // NEW
  groupId: groupId,
);
```

### 7.2 Backend Changes

**CHANGE: Validate against local time, not UTC**

```typescript
async validateScheduleTime(groupId: string, datetime: Date, timezone: string): Promise<void> {
  // NEW: Receive timezone from request
  const scheduleConfig = await this.prisma.groupScheduleConfig.findUnique({
    where: { groupId }
  });

  if (!scheduleConfig) {
    throw new Error('Group has no schedule configuration.');
  }

  // NEW: Convert UTC datetime to user's local time
  const localDateTime = this.convertUTCToLocal(datetime, timezone);
  
  // CHANGED: Extract weekday and time from LOCAL datetime
  const weekday = localDateTime.toLocaleDateString('en-US', {
    weekday: 'long',
  }).toUpperCase();

  const hours = localDateTime.getHours().toString().padStart(2, '0');
  const minutes = localDateTime.getMinutes().toString().padStart(2, '0');
  const timeSlot = `${hours}:${minutes}`;

  const scheduleHours = scheduleConfig.scheduleHours as Record<string, string[]>;
  const configuredTimes = scheduleHours[weekday] || [];

  if (!configuredTimes.includes(timeSlot)) {
    throw new Error(`Time ${timeSlot} is not configured for ${weekday}`);
  }
}

// NEW: Helper function
private convertUTCToLocal(utcDate: Date, timezone: string): Date {
  // Use date-fns, moment-tz, or similar library
  // This is non-trivial because JavaScript Date doesn't support timezones natively
  // Recommendation: Use date-fns-tz library
}
```

### 7.3 Week Calculation Fix (Mobile App)

```dart
// CHANGE: Use UTC consistently
int getISOWeekNumber(DateTime date) {
  // Convert to UTC if not already
  final utcDate = date.isUtc ? date : date.toUtc();
  
  final thursday = utcDate.add(Duration(days: DateTime.thursday - utcDate.weekday));
  final jan4 = DateTime.utc(thursday.year, 1, 4);  // ✅ Use UTC
  final week1Monday = jan4.subtract(Duration(days: jan4.weekday - DateTime.monday));
  final daysSinceWeek1 = thursday.difference(week1Monday).inDays;
  final weekNumber = (daysSinceWeek1 / 7).floor() + 1;

  return weekNumber;
}
```

---

## 8. SPECIFIC RECOMMENDATIONS

### Question 1: Should week numbers use UTC or local time?

**ANSWER**: **UTC for calculations, but configure scheduleHours in local time**

- Week calculations should use UTC (absolute)
- scheduleHours configuration is user-facing (local interpretation)
- Backend converts UTC → local to validate against scheduleHours

### Question 2: Should weekday extraction use UTC or local time?

**ANSWER**: **Local time for validation**

- ✅ **For UI Display**: Local time (already correct)
- ✅ **For Backend Validation**: Local time (NEEDS FIX)
  - Currently uses UTC (WRONG!)
  - Must convert UTC datetime to user's local time first
  - Then extract weekday from local datetime
  - Then match against scheduleHours

### Question 3: Do we need to adjust datetime construction logic?

**ANSWER**: **NO - Mobile app implementation is already correct**

The `calculateDateTimeFromSlot()` function correctly:
1. Treats user input as local time
2. Constructs local datetime
3. Converts to UTC
4. Sends to backend

Tests verify this with round-trip conversion.

### Question 4: Are there edge cases where timezone causes day mismatches?

**ANSWER**: **YES - Multiple edge cases identified**

1. **Day boundary crossing**: UTC weekday ≠ local weekday (FIXED by using local for validation)
2. **Year boundaries**: Dec 31 UTC ≠ Jan 1 local (correctly handled by ISO 8601)
3. **Week boundaries**: Monday UTC ≠ Monday local (FIXED by using UTC for week calculations)
4. **Validation mismatch**: Currently validates against UTC, should validate against local (CRITICAL FIX)

---

## 9. IMPLEMENTATION CHECKLIST

### Phase 1: Mobile App (Non-Breaking)
- [ ] Fix `getISOWeekNumber()` to consistently use UTC
- [ ] Add timezone field to all schedule requests
- [ ] Device timezone detection (use `package:timezone` or similar)
- [ ] Add tests for timezone-specific edge cases

### Phase 2: Backend (Breaking Change)
- [ ] Add timezone parameter to `validateScheduleTime()`
- [ ] Implement UTC → Local conversion helper
- [ ] Update validation to use LOCAL weekday/time
- [ ] Update API endpoint to accept timezone in request body
- [ ] Add tests for timezone validation scenarios

### Phase 3: Frontend (Optional, lower priority)
- [ ] Fix `getISOWeekNumber()` to use UTC
- [ ] Update week display to match backend calculation
- [ ] Test in multiple timezones

### Phase 4: Testing
- [ ] Add integration tests for multiple timezones
- [ ] Test edge cases: year boundaries, DST transitions
- [ ] Verify round-trip: create local time → store UTC → display local

---

## 10. EXAMPLE INTEGRATION TEST

```typescript
describe('Schedule Slot Validation with Timezone - Integration Test', () => {
  it('should validate correctly for user in UTC+2 timezone', async () => {
    const groupId = 'group-paris';
    const timezone = 'Europe/Paris'; // UTC+2 in January
    
    // Group config defines MONDAY 08:00 (local interpretation)
    const config = {
      MONDAY: ['08:00', '08:30'],
      TUESDAY: ['08:00', '08:30'],
    };
    
    // User tries to create Monday 08:00 local
    // In UTC, this is Sunday 23:00
    const userLocalTime = DateTime(2025, 1, 6, 8, 0); // Monday 08:00 local
    const utcTime = userLocalTime.toUtc(); // Converts to Sunday 23:00 UTC
    
    // Validation should:
    // 1. Receive: utcTime + timezone
    // 2. Convert: UTC Sunday 23:00 → Local Monday 08:00
    // 3. Extract: MONDAY + 08:00
    // 4. Validate: MONDAY 08:00 IS in config
    // 5. Result: PASS ✓
    
    const result = await validationService.validateScheduleTime(
      groupId,
      utcTime,
      timezone
    );
    
    expect(result).toBe(true);
  });
});
```

---

## 11. CONCLUSIONS

1. **Current state**: Mobile app datetime construction is CORRECT, but backend validation is BROKEN for non-UTC timezones

2. **Root cause**: Backend validates UTC weekday/time against local-time-based scheduleHours without timezone conversion

3. **Floating Time Model incompatible**: Cannot work without timezone information transmitted to backend

4. **Required changes**:
   - Send timezone with requests ✅ (Non-breaking, add field)
   - Backend validate against local time (Breaking, changes validation logic)
   - Fix week calculation consistency (Non-breaking, improves reliability)

5. **Risk level**: HIGH - Current code appears to work but will fail for non-UTC timezones when Floating Time Model is implemented

