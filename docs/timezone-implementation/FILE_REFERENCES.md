# Complete File Reference List - Timezone Analysis

## Analysis Documents

- `/workspace/TIMEZONE_ANALYSIS_SUMMARY.md` - Executive summary with key findings
- `/workspace/TIMEZONE_ANALYSIS_DETAILED.md` - Comprehensive technical analysis

## Mobile App Files (Dart/Flutter)

### Core Logic
- `/workspace/mobile_app/lib/features/schedule/domain/services/schedule_datetime_service.dart` - Datetime construction (Lines 57-71: CORRECT implementation)
- `/workspace/mobile_app/lib/core/utils/date/iso_week_utils.dart` - Week calculations (Line 27: Issue with local datetime, Line 90: Correct UTC usage)
- `/workspace/mobile_app/lib/core/domain/entities/schedule/day_of_week.dart` - Weekday enum

### DTOs & Network Models
- `/workspace/mobile_app/lib/core/network/models/schedule/schedule_slot_dto.dart` - Schedule slot data transfer object (Lines 40-49: Correct UTC→Local conversion)
- `/workspace/mobile_app/lib/core/network/models/schedule/vehicle_assignment_dto.dart` - Vehicle assignment DTO
- `/workspace/mobile_app/lib/core/network/models/dashboard/weekly_schedule_dto.dart` - Weekly schedule DTO

### Tests
- `/workspace/mobile_app/test/unit/features/schedule/domain/services/schedule_datetime_service_test.dart` - Datetime service tests (Lines 30-47: Round-trip verification)
- `/workspace/mobile_app/test/unit/core/network/models/schedule/schedule_slot_dto_test.dart` - DTO conversion tests (Lines 163-265: Comprehensive test coverage)
- `/workspace/mobile_app/test/unit/features/schedule/utils/iso_week_utils_test.dart` - Week calculation tests

### Domain Entities
- `/workspace/mobile_app/lib/core/domain/entities/schedule/schedule_slot.dart` - Domain schedule slot entity
- `/workspace/mobile_app/lib/core/domain/entities/schedule/time_of_day.dart` - Time of day value object
- `/workspace/mobile_app/lib/core/domain/entities/schedule/weekly_schedule.dart` - Weekly schedule entity

## Backend Files (TypeScript/Node.js)

### Validation Services
- `/workspace/backend/src/services/ScheduleSlotValidationService.ts` - Schedule slot validation
  - Lines 266-274: **CRITICAL** - Validates UTC instead of local time
  - Lines 253-291: validateScheduleTime() method
  - Method signatures for all validation methods

- `/workspace/backend/src/services/GroupScheduleConfigService.ts` - Group schedule configuration
  - Lines 310-316: Weekday extraction for config validation
  - Lines 50-91: Schedule hours validation
  - DEFAULT_SCHEDULE_HOURS template

- `/workspace/backend/src/services/ScheduleSlotService.ts` - Schedule slot operations
  - Lines 254-275: getSchedule() method (Issues with week boundary calculation)
  - Lines 36-65: createScheduleSlotWithVehicle() method
  - All scheduling operations

### Repository & Data Access
- `/workspace/backend/src/repositories/ScheduleSlotRepository.ts` - Data access layer
- `/workspace/backend/prisma/schema.prisma` - Database schema (Lines 64-75: GroupScheduleConfig definition)

### Controllers & Routes
- `/workspace/backend/src/controllers/ScheduleSlotController.ts` - API endpoint handlers
- `/workspace/backend/src/controllers/GroupScheduleConfigController.ts` - Configuration endpoints
- `/workspace/backend/src/routes/scheduleSlots.ts` - Route definitions

### Tests
- `/workspace/backend/src/integration/__tests__/schedule-time-validation.integration.test.ts` - Integration tests (Lines 72-150: Current tests only for UTC)
- `/workspace/backend/src/services/__tests__/ScheduleSlotValidationService.test.ts` - Unit tests
- `/workspace/backend/src/services/__tests__/ScheduleSlotService.test.ts` - Service tests
- `/workspace/backend/src/services/__tests__/GroupScheduleConfigService.test.ts` - Config service tests

## Frontend Files (TypeScript/React)

### Utilities
- `/workspace/frontend/src/utils/weekCalculations.ts` - Week calculation utilities
  - Lines 10-17: getISOWeekNumber() - Uses local time
  - Lines 23-40: getWeekStartDate() - Uses local time
  - Lines 65-69: getCurrentWeek() - Uses local time

- `/workspace/frontend/src/utils/dateFormatting.ts` - Date formatting utilities
- `/workspace/frontend/src/utils/dateValidation.ts` - Date validation utilities

### Services
- `/workspace/frontend/src/services/scheduleConfigService.ts` - Schedule configuration service
- `/workspace/frontend/src/types/schedule.ts` - TypeScript types for schedule

### Tests
- `/workspace/frontend/src/utils/__tests__/weekCalculations.test.ts` - Week calculation tests
- `/workspace/frontend/src/services/__tests__/scheduleConfigService.test.ts` - Service tests

## Documentation

- `/workspace/CLAUDE.md` - Project instructions and structure
- `/workspace/mobile_app/CHILD_ASSIGNMENT_FILTERING_SUMMARY.md` - Related scheduling feature
- `/workspace/mobile_app/docs/VEHICLE_CHILD_ASSIGNMENT_FLOW.md` - Data flow documentation

## Key Issue Locations

### CRITICAL Issues

1. **Backend UTC vs Local Validation**
   - File: `/workspace/backend/src/services/ScheduleSlotValidationService.ts`
   - Lines: 266-274
   - Method: `validateScheduleTime()`
   - Issue: Extracts UTC weekday/time, validates against local-time config

2. **Missing Timezone Information**
   - File: All schedule creation endpoints
   - Issue: No timezone sent with requests, backend cannot convert

### HIGH Priority Issues

3. **Week Calculation Inconsistency**
   - File: `/workspace/mobile_app/lib/core/utils/date/iso_week_utils.dart`
   - Line: 27 (getISOWeekNumber)
   - Line: 90 (getMondayOfISOWeek)
   - Issue: Mixed UTC and local datetime usage

4. **Backend Week Filtering**
   - File: `/workspace/backend/src/services/ScheduleSlotService.ts`
   - Lines: 254-275
   - Method: `getSchedule()`
   - Issue: Mixes local getDay() with UTC setUTCHours()

### GOOD Implementation Examples

1. **Mobile App Datetime Construction**
   - File: `/workspace/mobile_app/lib/features/schedule/domain/services/schedule_datetime_service.dart`
   - Lines: 57-71
   - Status: Correctly treats times as local, converts to UTC

2. **Mobile App DTO Conversion**
   - File: `/workspace/mobile_app/lib/core/network/models/schedule/schedule_slot_dto.dart`
   - Lines: 40-49
   - Status: Correctly converts UTC to local for display

3. **Test Round-Trip Verification**
   - File: `/workspace/mobile_app/test/unit/features/schedule/domain/services/schedule_datetime_service_test.dart`
   - Lines: 30-47
   - Status: Tests verify round-trip conversion (not absolute values)

## Quick Navigation by Problem Type

### To understand the bug:
1. Start: `/workspace/TIMEZONE_ANALYSIS_SUMMARY.md` sections 1-2
2. See code: `/workspace/backend/src/services/ScheduleSlotValidationService.ts:266-274`
3. Understand impact: `/workspace/TIMEZONE_ANALYSIS_DETAILED.md` section 2

### To see correct implementation:
1. Mobile app datetime: `/workspace/mobile_app/lib/features/schedule/domain/services/schedule_datetime_service.dart:57-71`
2. Mobile app tests: `/workspace/mobile_app/test/unit/features/schedule/domain/services/schedule_datetime_service_test.dart`
3. Analysis: `/workspace/TIMEZONE_ANALYSIS_SUMMARY.md` section 3

### To fix backend validation:
1. Change target: `/workspace/backend/src/services/ScheduleSlotValidationService.ts:253-291`
2. Reference implementation: See `TIMEZONE_ANALYSIS_DETAILED.md` section 7.2
3. Add tests: Extend `/workspace/backend/src/integration/__tests__/schedule-time-validation.integration.test.ts`

### To fix week calculations:
1. Change target: `/workspace/mobile_app/lib/core/utils/date/iso_week_utils.dart:27`
2. Reference: `/workspace/mobile_app/lib/core/utils/date/iso_week_utils.dart:90`
3. Implementation: `/workspace/TIMEZONE_ANALYSIS_SUMMARY.md` section Q1 fix

