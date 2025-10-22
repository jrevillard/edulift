# Timezone Implementation Guide for Developers

## Quick Reference

### Getting User's Timezone

```typescript
import { UserRepository } from './repositories/UserRepository';

// From authenticated user
const user = await userRepository.findById(userId);
const timezone = user.timezone; // e.g., "Europe/Paris"
```

### Validating Timezone Input

```typescript
import { isValidTimezone, getValidatedTimezone } from './utils/timezoneUtils';

// Check if valid
if (isValidTimezone(userInput)) {
  // Use userInput
}

// Auto-validate with fallback to UTC
const safeTimezone = getValidatedTimezone(userInput); // Returns 'UTC' if invalid
```

### Converting UTC to User Timezone

```typescript
import { convertUtcToTimezone, getWeekdayInTimezone, getTimeInTimezone } from './utils/timezoneUtils';

const utcDatetime = new Date('2024-06-24T12:00:00.000Z');
const userTimezone = 'Europe/Paris';

// Get DateTime object in user timezone
const localDateTime = convertUtcToTimezone(utcDatetime, userTimezone);

// Get just the weekday (e.g., "MONDAY")
const weekday = getWeekdayInTimezone(utcDatetime, userTimezone);

// Get just the time (e.g., "14:00")
const time = getTimeInTimezone(utcDatetime, userTimezone);
```

### Creating New Users with Timezone

```typescript
// In registration/auth flow
const userData: CreateUserData = {
  email: 'user@example.com',
  name: 'John Doe',
  timezone: 'America/New_York' // Optional, defaults to UTC
};

const user = await userRepository.create(userData);
// Timezone is automatically validated
```

### Updating User Timezone

```typescript
// Via profile update
await authService.updateProfile(userId, {
  timezone: 'Asia/Tokyo'
});

// Or via dedicated endpoint (client-side)
// PATCH /auth/timezone
// { "timezone": "Asia/Tokyo" }
```

## Common Patterns

### Pattern 1: Schedule Slot Creation with User Timezone

```typescript
// Client sends local datetime + timezone
const scheduleData = {
  groupId: 'group123',
  datetime: '2024-06-24T07:30:00.000Z', // Already converted to UTC by client
  timezone: user.timezone // User's timezone from DB
};

// Backend validates in user's timezone
const weekday = getWeekdayInTimezone(scheduleData.datetime, scheduleData.timezone);
const time = getTimeInTimezone(scheduleData.datetime, scheduleData.timezone);

// Check against group's schedule config (which is in local time)
if (groupConfig.scheduleHours[weekday]?.includes(time)) {
  // Valid!
}
```

### Pattern 2: Displaying Schedule to User

```typescript
// Get schedule slots from DB (stored in UTC)
const slots = await getScheduleSlots(groupId);

// Convert each slot to user's timezone for display
const displaySlots = slots.map(slot => ({
  id: slot.id,
  localDateTime: convertUtcToTimezone(slot.datetime, user.timezone),
  displayTime: formatDateTimeForUser(slot.datetime, user.timezone)
  // e.g., "Monday 07:30"
}));
```

### Pattern 3: Timezone Auto-Detection on Registration

```typescript
// Client-side (frontend/mobile)
const detectedTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
// e.g., "Europe/Paris"

// Send to backend during registration
fetch('/auth/magic-link', {
  method: 'POST',
  body: JSON.stringify({
    email: 'user@example.com',
    name: 'John Doe',
    timezone: detectedTimezone, // Auto-detected
    code_challenge: '...',
    platform: 'web'
  })
});
```

## Best Practices

### ✅ DO

1. **Always store UTC in database**
   ```typescript
   // Database stores UTC
   datetime: Date // 2024-06-24T12:00:00.000Z
   ```

2. **Always store user timezone**
   ```typescript
   // User table has timezone
   timezone: string // "Europe/Paris"
   ```

3. **Convert for validation and display**
   ```typescript
   // Convert UTC to user's timezone for validation
   const localTime = getTimeInTimezone(utcDatetime, user.timezone);
   ```

4. **Use IANA timezone format**
   ```typescript
   // Good
   timezone: "Europe/Paris"
   timezone: "America/New_York"
   timezone: "Asia/Tokyo"

   // Bad
   timezone: "CET"  // Abbreviation
   timezone: "GMT+1"  // Offset
   timezone: "PST"  // Abbreviation
   ```

### ❌ DON'T

1. **Don't store local time in database**
   ```typescript
   // BAD - loses timezone information
   datetime: "2024-06-24 07:30"
   ```

2. **Don't use timezone abbreviations**
   ```typescript
   // BAD - ambiguous and doesn't handle DST
   timezone: "CET"
   timezone: "PST"
   ```

3. **Don't guess user timezone on backend**
   ```typescript
   // BAD - unreliable
   const timezone = req.headers['x-timezone-guess'];
   ```

4. **Don't skip validation**
   ```typescript
   // BAD - may cause runtime errors
   const timezone = req.body.timezone;
   user.timezone = timezone; // Not validated!

   // GOOD
   const timezone = getValidatedTimezone(req.body.timezone);
   user.timezone = timezone; // Safe, defaults to UTC if invalid
   ```

## Common Timezones

Quick reference for testing:

```typescript
// Americas
'America/New_York'      // US Eastern
'America/Chicago'       // US Central
'America/Denver'        // US Mountain
'America/Los_Angeles'   // US Pacific
'America/Toronto'       // Canada
'America/Mexico_City'   // Mexico
'America/Sao_Paulo'     // Brazil

// Europe
'Europe/London'         // UK (GMT/BST)
'Europe/Paris'          // France (CET/CEST)
'Europe/Berlin'         // Germany
'Europe/Madrid'         // Spain
'Europe/Rome'           // Italy
'Europe/Moscow'         // Russia

// Asia
'Asia/Dubai'            // UAE
'Asia/Kolkata'          // India
'Asia/Shanghai'         // China
'Asia/Tokyo'            // Japan
'Asia/Seoul'            // South Korea
'Asia/Singapore'        // Singapore

// Australia
'Australia/Sydney'      // NSW
'Australia/Melbourne'   // Victoria
'Australia/Brisbane'    // Queensland
'Australia/Perth'       // Western Australia

// Special
'UTC'                   // Universal Time
```

## Testing

### Unit Tests

```typescript
import { isValidTimezone, getValidatedTimezone } from '../utils/timezoneUtils';

describe('Timezone handling', () => {
  test('should validate IANA timezone', () => {
    expect(isValidTimezone('Europe/Paris')).toBe(true);
    expect(isValidTimezone('CET')).toBe(false);
  });

  test('should default invalid timezone to UTC', () => {
    expect(getValidatedTimezone('Invalid')).toBe('UTC');
    expect(getValidatedTimezone(undefined)).toBe('UTC');
  });
});
```

### Integration Tests

```typescript
describe('User creation with timezone', () => {
  test('should create user with specified timezone', async () => {
    const user = await userRepository.create({
      email: 'test@example.com',
      name: 'Test User',
      timezone: 'Europe/Paris'
    });

    expect(user.timezone).toBe('Europe/Paris');
  });

  test('should default to UTC if no timezone provided', async () => {
    const user = await userRepository.create({
      email: 'test2@example.com',
      name: 'Test User'
    });

    expect(user.timezone).toBe('UTC');
  });
});
```

## Troubleshooting

### "Invalid timezone" errors

**Problem**: Client sends invalid timezone like "CET" or "GMT+1"

**Solution**:
```typescript
// Always use getValidatedTimezone
const safeTimezone = getValidatedTimezone(clientTimezone);
// Falls back to UTC if invalid
```

### DST (Daylight Saving Time) issues

**Problem**: Times shift during DST transitions

**Solution**: IANA timezones automatically handle DST!
```typescript
// Luxon handles DST automatically
const winter = getTimeInTimezone('2024-01-15T12:00:00Z', 'Europe/Paris');
// Returns "13:00" (UTC+1)

const summer = getTimeInTimezone('2024-06-15T12:00:00Z', 'Europe/Paris');
// Returns "14:00" (UTC+2, DST active)
```

### User travels to different timezone

**Problem**: User is traveling, schedule times look wrong

**Solution**: User can update their timezone:
```typescript
// User updates timezone to current location
PATCH /auth/timezone
{ "timezone": "Asia/Tokyo" }

// System uses new timezone for all future operations
// Existing UTC datetimes in DB remain unchanged
// Display updates automatically
```

## Migration Notes

### Applying the Migration

```bash
# Development
cd /workspace/backend
npx prisma migrate dev

# Production
npx prisma migrate deploy
```

### Existing Users

All existing users will automatically get `timezone = 'UTC'` as default. This is safe because:
1. UTC is a valid timezone
2. Users can update it later
3. System behavior doesn't change for existing users

### Rollback Plan

If needed, the migration can be reverted:

```sql
-- Remove timezone column
ALTER TABLE "users" DROP COLUMN "timezone";
DROP INDEX "users_timezone_idx";
```

## Resources

- [IANA Timezone Database](https://www.iana.org/time-zones)
- [Luxon Documentation](https://moment.github.io/luxon/)
- [MDN: Intl.DateTimeFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat)

## Support

For questions or issues with timezone handling:
1. Check this guide first
2. Review test cases in `/src/utils/__tests__/timezoneUtils.test.ts`
3. Consult `PHASE_1.1_IMPLEMENTATION_SUMMARY.md` for implementation details
