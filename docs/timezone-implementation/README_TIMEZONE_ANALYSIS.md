# Timezone Analysis for EduLift Floating Time Model

## Quick Start

Read these documents in order:

1. **START HERE**: `/workspace/TIMEZONE_ANALYSIS_SUMMARY.md` (5-10 min read)
   - Key findings summarized
   - All questions answered
   - Quick navigation to specific issues

2. **DETAILED ANALYSIS**: `/workspace/TIMEZONE_ANALYSIS_DETAILED.md` (20-30 min read)
   - Comprehensive technical breakdown
   - All code examples with explanations
   - Edge cases and root cause analysis

3. **FILE REFERENCE**: `/workspace/FILE_REFERENCES.md`
   - Complete list of all relevant files
   - Quick navigation by problem type
   - Line numbers for each issue

---

## What This Analysis Covers

### Scope
- Week calculations (ISO 8601 week numbers)
- Day/weekday extraction from datetimes
- Schedule slot datetime construction
- Date boundary issues (day/year transitions)
- Schedule display and filtering
- Timezone effects on all above

### Components Analyzed
- **Mobile App** (Flutter/Dart): Complete analysis ✓
- **Backend** (Node.js/TypeScript): Complete analysis ✓
- **Frontend** (React/TypeScript): Complete analysis ✓

### Methodology
- Code review of all schedule-related logic
- Analysis of test coverage
- Identification of timezone-dependent code
- Edge case analysis
- Impact assessment

---

## Key Findings Summary

### Finding 1: Mobile App is CORRECT (Unexpected!)

The mobile app's datetime construction is already correctly structured for the Floating Time Model:

```dart
// User clicks "07:30" in their local timezone
// Mobile treats this as LOCAL time
final localDateTime = DateTime(year, month, day, hour, minute);

// Then converts to UTC for backend
final utcDateTime = localDateTime.toUtc();

// Tests verify round-trip (not absolute values)
// This handles variable timezones correctly!
```

**Status**: No changes needed to this implementation.

### Finding 2: Backend Validation is BROKEN (Critical!)

Backend currently validates UTC times against local-time configs:

```typescript
// WRONG: Extracts UTC weekday/time
const weekday = datetime.toLocaleDateString('en-US', {
  weekday: 'long',
  timeZone: 'UTC'  // ← Problem!
}).toUpperCase();

// Then validates against scheduleHours
// But scheduleHours are defined as LOCAL times!
// This fails for non-UTC timezones
```

**Example**: User in Paris (UTC+2) tries to create "Monday 07:30 local"
- Mobile sends: 2025-01-05T05:30:00Z (Sunday 05:30 UTC)
- Backend extracts: SUNDAY + 05:30 UTC
- Config has: MONDAY: ['07:30']
- Result: Validation FAILS (should PASS!)

**Status**: Must be fixed before Floating Time Model can work.

### Finding 3: No Timezone Information Transmitted

All schedule requests are currently created without timezone information:

```dart
// Mobile sends only datetime, no timezone
final request = {
  'datetime': '2025-01-05T05:30:00Z',
  'groupId': 'group-1'
};

// Backend cannot convert back to local time
// Can only validate against UTC
```

**Status**: Timezone field must be added to all schedule requests.

### Finding 4: Week Calculations Have Inconsistencies

Mobile app week calculations mix UTC and local time:

```dart
// Line 90: Correct (uses UTC)
DateTime getMondayOfISOWeek(int year, int weekNumber) {
  final jan4 = DateTime.utc(year, 1, 4);  // ✓ UTC
  // ...
}

// Line 27: Wrong (uses local)
int getISOWeekNumber(DateTime date) {
  final jan4 = DateTime(thursday.year, 1, 4);  // ✗ LOCAL
  // ...
}
```

**Status**: Should be consistent (recommend all UTC for calculations).

---

## Answers to Your Questions

### Q1: Should week numbers be calculated in UTC or local time?

**ANSWER**: **UTC for calculations**

- Week is a calendar concept (absolute)
- Avoids boundary issues
- Recommendation: Change line 27 to use `DateTime.utc()`

### Q2: Should weekday extraction use UTC or local time?

**ANSWER**: **Depends on context**

| Context | Should Use | Current | Correct? |
|---------|-----------|---------|----------|
| UI Display | Local | Yes | ✓ |
| Backend Validation | Local | UTC | ✗ |
| Week Calculation | UTC | Mixed | Partial |

**Action**: Backend validation must convert UTC→Local first.

### Q3: Do we need to adjust datetime construction logic?

**ANSWER**: **NO - already correct**

Mobile app correctly:
1. Treats input as local time
2. Creates local datetime
3. Converts to UTC
4. Tests verify round-trip

No changes needed.

### Q4: Are there edge cases where timezone causes day mismatches?

**ANSWER**: **YES - Three critical edge cases**

1. **Day Boundary Crossing**: Monday 08:00 JST = Sunday 23:00 UTC
   - Mobile sends Sunday UTC
   - Backend checks Sunday instead of Monday
   - Validation fails

2. **Year Boundaries**: Dec 31 → Jan 1 in local timezone
   - Week changes across year boundary
   - Already correctly handled by ISO 8601

3. **Week Boundaries**: Monday 00:00 UTC could be Sunday in local time
   - User sees one day, backend validates another
   - Affects non-UTC timezones

---

## What Must Change

### Phase 1: Mobile App (Non-Breaking)
- [ ] Fix `getISOWeekNumber()` to use UTC (line 27)
- [ ] Add timezone to schedule requests
- [ ] Add timezone-specific tests

### Phase 2: Backend (Breaking Change)
- [ ] Accept timezone parameter
- [ ] Implement UTC→Local conversion
- [ ] Validate against local time (not UTC)
- [ ] Update tests for multiple timezones

### Phase 3: Optional
- [ ] Fix frontend week calculations
- [ ] Test all components together

---

## Timeline Implications

**Current State**: Works for UTC timezones only

**When Floating Time Model Implemented**:
- Works in UTC: ✓
- Works in Europe/Paris (UTC+2): ✗ 
- Works in Tokyo (UTC+9): ✗
- Works in UTC-10: ✗

**Critical**: Do NOT implement Floating Time Model until backend timezone handling is fixed.

---

## Risk Assessment

**Risk Level**: HIGH

- Code appears to work (tests use UTC)
- Fails silently in non-UTC environments
- Backend will reject valid schedules
- Users in non-UTC timezones cannot create schedules
- Day boundary cases are common (early morning/late night)

**Testing Gap**: No existing tests for non-UTC timezones

---

## Implementation Priority

1. **HIGH**: Backend must receive and use timezone (blocking)
2. **HIGH**: Backend validation must use local time (blocking)
3. **MEDIUM**: Fix week calculation consistency (improves reliability)
4. **LOW**: Frontend week calculation improvements (non-critical)

**Blocking Issue**: Backend timezone handling must be fixed before Floating Time Model can be released.

---

## File Organization

All analysis files are in `/workspace/`:

- `TIMEZONE_ANALYSIS_SUMMARY.md` - This summary with all questions answered
- `TIMEZONE_ANALYSIS_DETAILED.md` - Complete technical analysis
- `FILE_REFERENCES.md` - All files with line numbers
- `README_TIMEZONE_ANALYSIS.md` - This file

No changes to codebase made by this analysis (read-only).

---

## How to Use This Analysis

### For Understanding the Problem
1. Read `TIMEZONE_ANALYSIS_SUMMARY.md` sections 1-3
2. Look at code examples provided
3. Understand why UTC validation breaks for non-UTC users

### For Implementing Fixes
1. See `TIMEZONE_ANALYSIS_DETAILED.md` section 7 for implementation approach
2. Use `FILE_REFERENCES.md` to find exact code locations
3. Reference code examples in both documents

### For Testing
1. See `TIMEZONE_ANALYSIS_DETAILED.md` section 10 for test example
2. Test cases needed:
   - UTC+2 timezone (Europe/Paris)
   - UTC+9 timezone (Tokyo)
   - UTC-10 timezone (American Samoa)
   - DST edge cases
   - Year boundaries

### For Decision Making
1. All 4 specific questions are answered
2. Recommendations provided for each
3. Impact of not implementing provided
4. Priority order defined

---

## Success Criteria

Once implemented, the system will:

- Accept "Monday 08:00" in any timezone
- Validate correctly for UTC±12
- Handle day boundary crossings
- Handle year boundary edge cases
- Have consistent week calculations
- Show users local times

---

## Questions?

All analysis questions answered in:
- `/workspace/TIMEZONE_ANALYSIS_SUMMARY.md` - Quick answers
- `/workspace/TIMEZONE_ANALYSIS_DETAILED.md` - Detailed explanations

---

**Analysis Date**: October 19, 2025
**Thoroughness Level**: Very Thorough
**Status**: Complete and Ready for Implementation
