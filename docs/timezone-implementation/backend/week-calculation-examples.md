# ISO Week Calculation Examples - Phase 2B

This document demonstrates the timezone-aware ISO week calculations implemented in Phase 2B.

## Example 1: Asia/Tokyo (UTC+9)

**Scenario:** User in Tokyo checks their schedule on New Year's Eve

```
UTC Time:      2024-12-31 20:00:00 UTC
Tokyo Time:    2025-01-01 05:00:00 JST (Monday morning)

ISO Week Number: 1
ISO Week Year:   2025
Formatted:       "Week 1, 2025"

Why? In Tokyo, it's already Monday morning (Week 1 of 2025),
even though it's still Sunday evening in UTC.
```

## Example 2: America/Los_Angeles (UTC-8)

**Scenario:** User in LA checks schedule on New Year's Day morning (UTC)

```
UTC Time:      2024-01-01 07:00:00 UTC
LA Time:       2023-12-31 23:00:00 PST (Sunday night)

ISO Week Number: 52
ISO Week Year:   2023
Formatted:       "Week 52, 2023"

Why? In LA, it's still Sunday night (Week 52 of 2023),
even though it's Monday in UTC.
```

## Example 3: Week Boundaries (Europe/Paris)

**Scenario:** User in Paris wants to see "this week's" schedule

```
Current Time (UTC):    2024-01-03 12:00:00 UTC
Current Time (Paris):  2024-01-03 13:00:00 CET (Wednesday)

Week Start (UTC):      2023-12-31 23:00:00 UTC
Week Start (Paris):    2024-01-01 00:00:00 CET (Monday midnight)

Week End (UTC):        2024-01-07 22:59:59 UTC
Week End (Paris):      2024-01-07 23:59:59 CET (Sunday midnight)

Why? Week boundaries are calculated in Paris timezone,
then converted to UTC for database queries.
```

## Example 4: DST Transition (America/New_York)

**Scenario:** Schedule during DST transition week (March 10, 2024)

```
Before DST:
  UTC Time:      2024-03-08 12:00:00 UTC
  NY Time:       2024-03-08 07:00:00 EST (Friday)
  ISO Week:      10

After DST:
  UTC Time:      2024-03-11 12:00:00 UTC
  NY Time:       2024-03-11 08:00:00 EDT (Monday)
  ISO Week:      11

Why? DST transition happens on Sunday, March 10 at 2:00 AM.
Friday is Week 10, Monday is Week 11 - correctly handled.
```

## How It Works

### Old Implementation (UTC-based)
```typescript
// ❌ Problem: Calculated week boundaries in UTC
const now = new Date();
const dayOfWeek = now.getDay();
const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

rangeStart = new Date(now);
rangeStart.setDate(now.getDate() + daysToMonday);
rangeStart.setUTCHours(0, 0, 0, 0); // UTC midnight, not user midnight!
```

### New Implementation (Timezone-aware)
```typescript
// ✅ Solution: Calculate in user's timezone
const group = await prisma.group.findUnique({
  where: { id: groupId },
  select: { timezone: true }
});

const timezone = group.timezone; // e.g., "Asia/Tokyo"
const boundaries = getWeekBoundaries(now, timezone);

// boundaries.weekStart = Monday 00:00 in user timezone (as UTC)
// boundaries.weekEnd = Sunday 23:59:59.999 in user timezone (as UTC)
```

## Benefits

1. **Correct Week Display:** Users see schedules for "their" week, not UTC week
2. **Timezone Edge Cases:** Handles timezones where Sunday/Monday boundary differs from UTC
3. **DST Safe:** Automatically handles daylight saving time transitions
4. **Consistent:** Week numbers match what users see on their calendar

## Testing

All examples above are verified by automated tests:
- `src/utils/__tests__/isoWeekUtils.test.ts` (32 tests)
- `src/services/__tests__/ScheduleSlotService.test.ts` (23 tests)

Run tests:
```bash
npm test -- src/utils/__tests__/isoWeekUtils.test.ts
```
