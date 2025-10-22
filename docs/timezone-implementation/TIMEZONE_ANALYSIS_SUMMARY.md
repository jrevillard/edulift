# EduLift Timezone Handling Analysis - Executive Summary

## Analysis Completed: Timezone Effects on Week/Day/Schedule Calculations

This document provides an executive summary. See `TIMEZONE_ANALYSIS_DETAILED.md` for comprehensive analysis.

---

## Key Findings

### 1. MOBILE APP: Datetime Construction is CORRECT

**File**: `/workspace/mobile_app/lib/features/schedule/domain/services/schedule_datetime_service.dart` (Lines 57-71)

```dart
// ✅ CORRECT Implementation
final localDateTime = DateTime(
  date.year,
  date.month,
  date.day,
  hour,      // User clicked "07:30" = local time
  minute,
);

// Then convert to UTC for backend storage
final utcDateTime = localDateTime.toUtc();
```

**Status**: This correctly treats schedule times as "wall clock times" (timezone-agnostic). The flow is:
1. User clicks time in their local timezone
2. Mobile creates local datetime with that time
3. Converts to UTC for backend transmission
4. Tests verify round-trip conversion (not absolute UTC values)

---

### 2. BACKEND: Validation is BROKEN for Non-UTC Timezones

**File**: `/workspace/backend/src/services/ScheduleSlotValidationService.ts` (Lines 266-274)

```typescript
// ❌ BROKEN - Validates against UTC, not local time
const weekday = datetime.toLocaleDateString('en-US', {
  weekday: 'long',
  timeZone: 'UTC'  // ⚠️ Extracts UTC weekday
}).toUpperCase();

const hours = datetime.getUTCHours().toString().padStart(2, '0');  // ⚠️ UTC hours
const minutes = datetime.getUTCMinutes().toString().padStart(2, '0');

// Then validates against scheduleHours (which are LOCAL time configs!)
const configuredTimes = scheduleHours[weekday] || [];
```

**The Problem**: 
- `scheduleHours` are configured as local times (e.g., "MONDAY: ['07:30', '08:00']")
- But validation extracts UTC weekday/time
- These don't match for non-UTC timezones!

**Example (UTC+2, Europe/Paris)**:
```
User action:      "Create slot for Monday 07:30 local"
Mobile sends:     UTC datetime = Sunday 05:30 UTC
Backend receives: 2025-01-05T05:30:00Z
Backend extracts: SUNDAY + 05:30 UTC
Config has:       MONDAY: ['07:30']
Result:           Validation FAILS ❌ (Should PASS)
```

---

### 3. WEEK CALCULATIONS: Mixed UTC/Local

**File**: `/workspace/mobile_app/lib/core/utils/date/iso_week_utils.dart`

**Good (Line 90)**:
```dart
DateTime getMondayOfISOWeek(int year, int weekNumber) {
  final jan4 = DateTime.utc(year, 1, 4);  // ✅ UTC
  // ...
  return week1Monday.add(Duration(days: (weekNumber - 1) * 7));
}
```

**Bad (Line 27)**:
```dart
int getISOWeekNumber(DateTime date) {
  final thursday = date.add(Duration(days: DateTime.thursday - date.weekday));
  final jan4 = DateTime(thursday.year, 1, 4);  // ❌ LOCAL datetime
  // ...
}
```

**Impact**: Week calculations can vary by timezone because `getISOWeekNumber()` uses local time.

---

### 4. MOBILE APP DTO: Correctly Uses Local Time for Display

**File**: `/workspace/mobile_app/lib/core/network/models/schedule/schedule_slot_dto.dart` (Lines 40-49)

```dart
@override
ScheduleSlot toDomain() {
  // Convert UTC datetime to local time for display
  final localDatetime = datetime.toLocal();  // ✅ Correct

  // Extract weekday from LOCAL datetime (correct for display)
  final dayOfWeek = DayOfWeek.fromWeekday(localDatetime.weekday);  // ✅
  final timeOfDay = TimeOfDayValue.fromDateTime(localDatetime);    // ✅
  
  return ScheduleSlot(
    dayOfWeek: dayOfWeek,    // User sees correct day
    timeOfDay: timeOfDay,    // User sees correct time
    // ...
  );
}
```

**Status**: Correctly converts UTC → Local for display.

---

## Critical Issues Summary

| Issue | Severity | Location | Effect |
|-------|----------|----------|--------|
| Backend validates UTC against local config | **CRITICAL** | `ScheduleSlotValidationService.ts:266-274` | Schedule slots rejected for correct times in non-UTC timezones |
| Week calc mixes UTC/local | **HIGH** | `iso_week_utils.dart:27` | Different week numbers in different timezones |
| Backend week filtering broken | **HIGH** | `ScheduleSlotService.ts:265` | Wrong date ranges in non-UTC timezones |
| No timezone in requests | **CRITICAL** | All services | Backend cannot convert UTC to local |

---

## Answers to Specific Questions

### Q1: Should week numbers be calculated in UTC or local time?

**ANSWER**: **UTC for calculations**

- Week is a calendar concept (absolute, not relative)
- Avoids boundary issues where same date is in different weeks in different timezones
- Currently: Mixed approach creates inconsistency

**Fix**: Make all week calculations use UTC consistently
```dart
// Change line 27 from:
final jan4 = DateTime(thursday.year, 1, 4);
// To:
final jan4 = DateTime.utc(thursday.year, 1, 4);
```

### Q2: Should weekday extraction use UTC or local time?

**ANSWER**: **Depends on context**

| Context | Should Use | Current | Correct? |
|---------|-----------|---------|----------|
| **UI Display** | Local | Mobile app (DTO) | ✅ YES |
| **Backend Validation** | Local | Backend (UTC) | ❌ NO |
| **Week Calculation** | UTC | Mixed | ❌ NO |

**Fix for Backend**:
```typescript
// Change from UTC validation to LOCAL validation
// Need to add timezone parameter and convert:
const localDateTime = convertUTCToLocal(datetime, timezone);
const weekday = localDateTime.toLocaleDateString('en-US', {
  weekday: 'long',
  // timeZone removed - using local datetime object
}).toUpperCase();
```

### Q3: Do we need to adjust datetime construction logic?

**ANSWER**: **NO** - Mobile app is already correct

The `calculateDateTimeFromSlot()` implementation is exactly right for the Floating Time Model:
1. ✅ Treats input times as local (wall-clock times)
2. ✅ Creates local datetime
3. ✅ Converts to UTC for backend
4. ✅ Tests verify round-trip behavior

**No changes needed** - but backend validation must be fixed to receive/use timezone.

### Q4: Are there edge cases where timezone causes day mismatches?

**ANSWER**: **YES - Multiple edge cases**

#### Edge Case 1: Day Boundary Crossing

```
Scenario: Tokyo (UTC+9) user creates "Monday 08:00 local"

Timeline:
  Monday 08:00 JST = Sunday 23:00 UTC (crosses into previous day!)

Mobile sends:  "2025-01-05T23:00:00Z" (Sunday UTC)
Backend gets:  Sunday 23:00 UTC
Config has:    MONDAY 08:00
Result:        Mismatch ❌
```

**Impact**: User's Monday schedule becomes invalid in backend validation.

#### Edge Case 2: Year Boundary

```
Scenario: Dec 31, 2024 10:00 UTC in UTC+10 timezone

UTC time:      2024-12-31 10:00
Local time:    2025-01-01 20:00 (crosses year boundary!)
ISO week:      2025-W01 (not 2024-W52)

Mobile correctly handles this by converting to local first.
```

**Impact**: Week calculations can jump across year boundaries.

#### Edge Case 3: Week Boundary

```
Scenario: Monday 00:00 UTC in UTC+2 timezone

UTC Monday:    2025-01-06 00:00
Local time:    2025-01-06 02:00 (still Monday)

But if user is in UTC-10:
UTC Monday:    2025-01-06 00:00
Local time:    2025-01-05 14:00 (crosses to previous day!)
Local weekday: Sunday (not Monday!)

Backend validation would check SUNDAY, but config has MONDAY!
```

**Impact**: Validation fails for edge times.

---

## Floating Time Model Implementation Requirements

### What's Working Now
- ✅ Mobile app correctly constructs UTC datetimes from local times
- ✅ Mobile app DTO correctly converts UTC → Local for display
- ✅ Mobile app tests verify round-trip conversions

### What's Broken
- ❌ Backend validates UTC instead of local (primary issue)
- ❌ Backend has no timezone information to convert with
- ❌ Week calculations have timezone inconsistencies (secondary issue)

### What Must Be Added

**1. Send Timezone with Requests** (Mobile App - Non-breaking)
```dart
class CreateScheduleSlotRequest {
  final String datetime;  // UTC ISO string (existing)
  final String timezone;  // IANA format: "Europe/Paris" (NEW)
  final String groupId;
}
```

**2. Convert UTC→Local in Backend** (Backend - Breaking change)
```typescript
async validateScheduleTime(
  groupId: string, 
  datetime: Date, 
  timezone: string  // NEW parameter
): Promise<void> {
  // NEW: Convert UTC to local using timezone
  const localDateTime = convertUTCToLocal(datetime, timezone);
  
  // CHANGED: Extract from LOCAL instead of UTC
  const weekday = formatLocalWeekday(localDateTime);
  const timeSlot = formatLocalTime(localDateTime);
  
  // Validate against local-time-based config
  // Now works correctly for all timezones!
}
```

**3. Fix Week Calculations** (Mobile App - Non-breaking)
```dart
int getISOWeekNumber(DateTime date) {
  // Convert to UTC first
  final utcDate = date.isUtc ? date : date.toUtc();
  final thursday = utcDate.add(...);
  final jan4 = DateTime.utc(thursday.year, 1, 4);  // ← Use UTC
  // ...
}
```

---

## Code File References

### Mobile App (Dart/Flutter)

| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| `schedule_datetime_service.dart` | 57-71 | Construct UTC datetime from local | ✅ Correct |
| `iso_week_utils.dart` | 27 | Calculate week number | ⚠️ Mixed UTC/local |
| `iso_week_utils.dart` | 90 | Get Monday of week | ✅ Uses UTC |
| `schedule_slot_dto.dart` | 40-49 | Convert UTC→Local for display | ✅ Correct |
| Tests: `schedule_datetime_service_test.dart` | 30-47 | Verify round-trip | ✅ Good coverage |
| Tests: `schedule_slot_dto_test.dart` | 163-265 | Verify DTO conversion | ✅ Comprehensive |

### Backend (TypeScript/Node.js)

| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| `ScheduleSlotValidationService.ts` | 266-274 | Validate schedule times | ❌ Uses UTC (wrong) |
| `ScheduleSlotService.ts` | 254-275 | Get week schedule | ⚠️ Mixes UTC/local |
| `GroupScheduleConfigService.ts` | 310-316 | Validate config changes | ⚠️ Uses UTC |
| Tests: `schedule-time-validation.integration.test.ts` | 72-150 | Integration tests | ⚠️ Only tests UTC |

### Frontend (TypeScript/React)

| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| `weekCalculations.ts` | 10-17 | Calculate ISO weeks | ⚠️ Uses local time |
| `weekCalculations.ts` | 23-40 | Get week start date | ⚠️ Uses local time |

---

## Implementation Plan

### Phase 1: Mobile App Enhancement (Non-Breaking)
1. Fix `getISOWeekNumber()` to use UTC consistently
2. Add timezone detection using `package:timezone`
3. Update request DTOs to include timezone field
4. Add timezone-specific test cases

### Phase 2: Backend Validation (Breaking Change)
1. Add timezone parameter to API endpoints
2. Implement `convertUTCToLocal()` helper (use `date-fns-tz` library)
3. Update `validateScheduleTime()` to use local time
4. Update `GroupScheduleConfigService` validation similarly
5. Update integration tests for multiple timezones

### Phase 3: Frontend Updates (Optional)
1. Fix week calculations to use UTC
2. Test in multiple timezones
3. Update UI tests

### Phase 4: Verification
1. Add timezone-specific integration tests
2. Test edge cases: DST transitions, year boundaries, day boundaries
3. Verify round-trip: local → UTC → local

---

## Risk Assessment

**Current Risk Level: HIGH**

- Code appears to work in UTC environments (tests use UTC)
- Fails silently for non-UTC timezones when Floating Time Model is implemented
- Backend validation will reject valid schedules for non-UTC users
- Day boundary crossing creates validation failures

**Testing Gap**: No existing tests for non-UTC timezones. Tests use `DateTime()` without timezone specification, which passes in test environment but masks production issues.

---

## Success Criteria

Once implemented, the system will:

- ✅ Accept schedule creation for "Monday 08:00" in any timezone
- ✅ Validate correctly for UTC+12, UTC-12, and all timezones in between
- ✅ Handle day boundary crossings (e.g., Monday 08:00 JST = Sunday 23:00 UTC)
- ✅ Handle year boundary edge cases (Dec 31 → Jan 1)
- ✅ Week calculations consistent across all components
- ✅ User sees local times, backend validates correctly

---

## Questions Answered

1. **Should week numbers be calculated in UTC or local time?**
   - **UTC for calculations**, local for display
   - Current: Mixed approach
   - Fix: Consistently use UTC

2. **Should weekday extraction use UTC or local time?**
   - **Local for validation**, UTC for calculations
   - Current: Backend uses UTC (wrong), Mobile uses local (correct)
   - Fix: Backend must convert UTC→Local first

3. **Do we need to adjust datetime construction logic?**
   - **NO** - Mobile app is already correct
   - Keep current approach: local input → UTC storage
   - Just need timezone in requests

4. **Are there edge cases where timezone causes day mismatches?**
   - **YES** - Multiple edge cases identified
   - Day boundary crossing (main issue)
   - Year boundaries (correctly handled)
   - Week boundaries (will be fixed by UTC consistency)

---

## Conclusion

The Floating Time Model **cannot work without sending timezone with requests**. The mobile app is already correctly structured for it, but the backend must be updated to receive and use timezone information for validation.

Current code works for UTC timezones only due to lucky alignment of local and UTC time. For non-UTC users, the Floating Time Model will fail at schedule creation time.

**Priority**: Fix backend validation before implementing Floating Time Model.

