# Timezone Implementation - Quick Reference

**TL;DR**: Treat `scheduleHours` as "floating times" (local clock times). Send user's timezone with every API call for proper validation.

---

## The Problem (Before)

```
User in Berlin (UTC+2) clicks "7:30 AM"
  ↓
App converts to UTC: "5:30 AM"
  ↓
Backend checks scheduleHours: ["07:30", "08:00"]
  ↓
❌ VALIDATION FAILS: "5:30" not in ["07:30", "08:00"]
```

---

## The Solution (After)

```
User in Berlin (UTC+2) clicks "7:30 AM"
  ↓
App converts to UTC: "5:30 AM UTC"
App also sends: timezone="Europe/Berlin"
  ↓
Backend receives: datetime="2025-10-20T05:30:00Z", timezone="Europe/Berlin"
Backend converts back: "5:30 UTC" → "7:30 Berlin"
Backend checks scheduleHours: ["07:30", "08:00"]
  ↓
✅ VALIDATION SUCCEEDS: "7:30" found in schedule
```

---

## Key Concepts

### Floating Time
- **Definition**: A time-of-day value (e.g., "07:30") that represents the SAME clock time regardless of timezone
- **Example**: "7:30 AM daily standup" happens at 7:30 local time everywhere
- **Storage**: Plain strings like "07:30" with NO timezone information

### Absolute Time
- **Definition**: A specific moment in time (timestamp)
- **Example**: "October 20, 2025 at 11:30 UTC" is ONE specific moment
- **Storage**: PostgreSQL `timestamptz`, ISO 8601 strings with 'Z' suffix

### IANA Timezone Names
- **Format**: "Continent/City" (e.g., "America/New_York", "Europe/Berlin")
- **NOT**: Abbreviations like "EST" or "PST" (ambiguous, don't handle DST)
- **Source**: Internet Assigned Numbers Authority timezone database

---

## Implementation Checklist

### Mobile App (Flutter)

- [ ] Add dependencies: `timezone`, `flutter_native_timezone`
- [ ] Create `/workspace/mobile_app/lib/core/utils/timezone/timezone_service.dart`
- [ ] Initialize in `main.dart`: `await TimezoneService.initialize()`
- [ ] Update `ScheduleDateTimeService.calculateDateTimeFromSlot()` to use `TimezoneService`
- [ ] Update API DTOs to include `userTimezone` field
- [ ] Update repository layer to send timezone with API calls
- [ ] Write unit tests for timezone conversions

### Backend (Node.js)

- [ ] Add dependency: `luxon`
- [ ] Create `/workspace/backend/src/utils/timezoneUtils.ts`
- [ ] Update `ScheduleSlotValidationService.validateScheduleTime()` to accept `userTimezone`
- [ ] Update API route handlers to accept and validate `userTimezone`
- [ ] Add request validation schema with timezone validation
- [ ] Write unit tests for timezone utilities
- [ ] Write integration tests for schedule validation

---

## Code Snippets

### Flutter: Convert Local Time to UTC

```dart
import 'package:edulift/core/utils/timezone/timezone_service.dart';

// User clicks "7:30 AM" on Monday of week "2025-W42" in Berlin
final utcDateTime = TimezoneService.convertLocalTimeToUtc(
  '07:30',                          // Time user sees
  DateTime(2025, 10, 20),           // Monday of that week
  'Europe/Berlin',                  // User's timezone
);
// → DateTime: 2025-10-20T05:30:00.000Z (UTC)

// Send to API:
await apiClient.createSlot(
  datetime: utcDateTime.toIso8601String(),
  userTimezone: 'Europe/Berlin',
);
```

### Backend: Validate with User Timezone

```typescript
import { convertUtcToLocalTime } from '../utils/timezoneUtils';

async validateScheduleTime(
  groupId: string,
  datetime: Date,
  userTimezone: string
): Promise<void> {
  // Load schedule config (floating times)
  const config = await prisma.groupScheduleConfig.findUnique({
    where: { groupId }
  });

  // Convert UTC to user's local time
  const { timeString, weekday } = convertUtcToLocalTime(datetime, userTimezone);
  // Example: "05:30 UTC" + "Europe/Berlin" → "07:30", "MONDAY"

  // Validate against floating times
  const scheduleHours = config.scheduleHours as Record<string, string[]>;
  if (!scheduleHours[weekday]?.includes(timeString)) {
    throw new Error(
      `Time ${timeString} is not configured for ${weekday} in your timezone.`
    );
  }
}
```

---

## Edge Cases & How They're Handled

| Edge Case | Example | How It's Handled |
|-----------|---------|------------------|
| **Day boundary crossing (West)** | User in LA books "23:30" | TZDateTime handles date math automatically |
| **Day boundary crossing (East)** | User in Auckland books "01:30" | Converts to previous UTC day correctly |
| **DST spring forward** | NY user books during 2:00-3:00 AM gap | Timezone package rounds to valid time |
| **DST fall back** | NY user books during repeated 1:00-2:00 AM | Picks one occurrence (usually later) |
| **User traveling** | Set schedule in NYC, book from Tokyo | Uses device's current timezone for conversions |
| **Invalid timezone** | API receives "Invalid/TZ" | Validation rejects with clear error |

---

## Testing Commands

### Flutter
```bash
# Run timezone service tests
flutter test test/core/utils/timezone/timezone_service_test.dart

# Run all tests
flutter test
```

### Backend
```bash
# Run timezone utility tests
npm test src/utils/__tests__/timezoneUtils.test.ts

# Run integration tests
npm test src/services/__tests__/ScheduleSlotValidationService.integration.test.ts

# Run all tests
npm test
```

---

## Common Mistakes to Avoid

❌ **DON'T**: Use `DateTime.parse()` without explicit timezone
```dart
final dt = DateTime.parse('2025-10-20T07:30:00'); // Ambiguous!
```

✅ **DO**: Use TimezoneService for time conversions
```dart
final utc = TimezoneService.convertLocalTimeToUtc('07:30', date, timezone);
```

---

❌ **DON'T**: Use `TZDateTime.from()` for date-specific conversions
```dart
final tz = tz.TZDateTime.from(dt, location); // May use wrong DST offset
```

✅ **DO**: Use `TZDateTime()` constructor with explicit date parts
```dart
final tz = tz.TZDateTime(location, 2025, 10, 20, 7, 30); // Correct DST
```

---

❌ **DON'T**: Store or use timezone abbreviations
```dart
final timezone = 'EST'; // Ambiguous, doesn't handle DST
```

✅ **DO**: Use IANA timezone names
```dart
final timezone = 'America/New_York'; // Unambiguous, handles DST
```

---

❌ **DON'T**: Forget to validate timezone names
```typescript
const tz = req.body.userTimezone;
const dt = DateTime.fromISO(utc).setZone(tz); // May fail silently
```

✅ **DO**: Validate before using
```typescript
if (!isValidTimezone(userTimezone)) {
  throw new Error('Invalid timezone');
}
const dt = DateTime.fromISO(utc).setZone(userTimezone);
```

---

## API Contract

### Before (Broken)

```json
POST /api/schedule-slots
{
  "groupId": "uuid",
  "datetime": "2025-10-20T05:30:00.000Z"
}
```

Backend interprets as UTC time, validates against UTC scheduleHours.
User in UTC+2 gets validation error.

### After (Fixed)

```json
POST /api/schedule-slots
{
  "groupId": "uuid",
  "datetime": "2025-10-20T05:30:00.000Z",
  "userTimezone": "Europe/Berlin"
}
```

Backend converts UTC to user's local time (07:30), validates against floating scheduleHours.
User in UTC+2 gets successful validation.

---

## Troubleshooting

### "Invalid timezone" error
- **Cause**: Client sent invalid IANA timezone name
- **Fix**: Ensure `flutter_native_timezone` is properly configured and returns valid IANA names
- **Check**: Log the timezone value before sending to API

### Validation fails for correct times
- **Cause**: Timezone conversion not happening or using wrong timezone
- **Fix**: Verify both client and server are using the same timezone name format (IANA)
- **Debug**: Log the local time extracted on the backend

### Times off by one hour
- **Cause**: DST handling issue or using `TZDateTime.from()` instead of constructor
- **Fix**: Use `TZDateTime(location, year, month, day, hour, minute)` constructor
- **Verify**: Check if issue occurs only on DST transition days

### App crashes on timezone initialization
- **Cause**: Timezone database not properly initialized
- **Fix**: Ensure `await TimezoneService.initialize()` is called in `main()` before `runApp()`
- **Check**: Look for "Timezone database initialized" in logs

---

## Performance Notes

- **Timezone initialization**: ~200-500ms at app startup (one-time cost)
- **Timezone conversion**: <10ms per conversion (negligible)
- **Caching**: Device timezone is cached to avoid repeated async calls
- **Database size**: `timezone` package adds ~1-2 MB to app size

---

## Resources

- **Full Implementation Plan**: `/workspace/TIMEZONE_IMPLEMENTATION_PLAN.md`
- **Dart timezone package**: https://pub.dev/packages/timezone
- **Luxon documentation**: https://moment.github.io/luxon/
- **IANA timezone database**: https://www.iana.org/time-zones
- **PostgreSQL timestamptz**: https://www.postgresql.org/docs/current/datatype-datetime.html

---

## Questions?

Common questions and answers:

**Q: Why not just store times in user's local timezone?**
A: Backend needs UTC for consistency and database queries. Multiple users in different timezones need a common reference.

**Q: What if a user changes their device timezone?**
A: App will use the new timezone for all conversions. Existing bookings remain in UTC (correct).

**Q: Do we need to update existing data in the database?**
A: No! Existing slots are already stored as UTC timestamps. We're only changing how we validate new bookings.

**Q: What about users without internet (offline mode)?**
A: Timezone database is bundled with the app (works offline). Timezone detection also works offline.

**Q: Can users manually override their timezone?**
A: Not in current implementation, but could be added as a feature (user settings).

---

**Last Updated**: 2025-10-18
