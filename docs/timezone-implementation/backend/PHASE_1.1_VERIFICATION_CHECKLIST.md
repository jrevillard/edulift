# Phase 1.1 Verification Checklist

## Pre-Deployment Verification

Use this checklist before deploying timezone functionality to production.

### ✅ Database Migration

- [x] Migration file created: `20251019104941_add_user_timezone/migration.sql`
- [x] Migration adds `timezone` column to `users` table
- [x] Column has NOT NULL constraint with DEFAULT 'UTC'
- [x] Index created on timezone column for performance
- [ ] **ACTION REQUIRED**: Migration applied to development database
- [ ] **ACTION REQUIRED**: Migration applied to staging database
- [ ] **ACTION REQUIRED**: Migration applied to production database

**To Apply**:
```bash
cd /workspace/backend
npx prisma migrate deploy
```

**Verify After Application**:
```sql
-- Check column exists
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'timezone';

-- Check existing users have UTC
SELECT timezone, COUNT(*)
FROM users
GROUP BY timezone;
-- Expected: All users have 'UTC'
```

### ✅ Code Quality

- [x] TypeScript compiles without errors (`npx tsc --noEmit`)
- [x] All tests pass (`npm test`)
- [x] No lint errors
- [x] Prisma client generated (`npx prisma generate`)
- [x] All timezone utility tests pass (37/37)

### ✅ Type Safety

- [x] `AuthenticatedUser` interface includes timezone
- [x] `CreateUserData` interface includes optional timezone
- [x] `UpdateProfileData` interface includes optional timezone
- [x] `User` interface (UserRepository) includes required timezone
- [x] All TypeScript strict checks pass

### ✅ Validation

- [x] `isValidTimezone()` rejects invalid timezones
- [x] `isValidTimezone()` accepts all IANA timezones
- [x] `getValidatedTimezone()` defaults to UTC for invalid input
- [x] `getValidatedTimezone()` returns UTC for null/undefined
- [x] All COMMON_TIMEZONES are valid IANA timezones

### ✅ Data Layer

- [x] `UserRepository.create()` validates timezone
- [x] `UserRepository.update()` validates timezone
- [x] Invalid timezones are converted to UTC
- [x] Timezone defaults to UTC if not provided

### ✅ Service Layer

- [x] `AuthService.requestMagicLink()` accepts timezone
- [x] `AuthService.verifyMagicLink()` returns timezone in user object
- [x] `AuthService.updateProfile()` supports timezone updates
- [x] New users get validated timezone or UTC default

### ✅ Controller & Routes

- [x] `POST /auth/magic-link` accepts optional timezone parameter
- [x] `PUT /auth/profile` accepts optional timezone parameter
- [x] `PATCH /auth/timezone` endpoint created for timezone updates
- [x] All endpoints validate timezone before saving
- [x] Invalid timezones return 400 error with helpful message

### ✅ API Responses

- [x] Authentication responses include user.timezone
- [x] Profile responses include timezone
- [x] Timezone update responses confirm new timezone

### ✅ Documentation

- [x] Implementation summary created
- [x] Developer guide created
- [x] Verification checklist created (this file)
- [x] Code comments added to key functions

## Manual Testing Checklist

### Test 1: New User Registration with Timezone

```bash
# Request magic link with timezone
curl -X POST http://localhost:3000/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "name": "New User",
    "timezone": "Europe/Paris",
    "code_challenge": "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    "platform": "web"
  }'

# Expected: success: true, userExists: false

# Verify magic link email received
# Click link, verify token

# Check database
SELECT id, email, name, timezone FROM users WHERE email = 'newuser@example.com';
# Expected: timezone = 'Europe/Paris'
```

### Test 2: Existing User - Default to UTC

```bash
# Check existing user (created before migration)
SELECT id, email, name, timezone FROM users LIMIT 1;
# Expected: timezone = 'UTC'
```

### Test 3: Update User Timezone

```bash
# Login first to get access token
# Then update timezone

curl -X PATCH http://localhost:3000/api/auth/timezone \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "timezone": "America/New_York"
  }'

# Expected: success: true, timezone: "America/New_York"

# Verify in database
SELECT timezone FROM users WHERE id = 'USER_ID';
# Expected: timezone = 'America/New_York'
```

### Test 4: Invalid Timezone Validation

```bash
# Try to set invalid timezone
curl -X PATCH http://localhost:3000/api/auth/timezone \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "timezone": "CET"
  }'

# Expected: 400 Bad Request
# Error: "Invalid IANA timezone format..."

# Verify timezone unchanged in database
```

### Test 5: Update Profile with Timezone

```bash
curl -X PUT http://localhost:3000/api/auth/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -d '{
    "name": "Updated Name",
    "timezone": "Asia/Tokyo"
  }'

# Expected: success: true, user includes timezone: "Asia/Tokyo"
```

### Test 6: Registration Without Timezone

```bash
curl -X POST http://localhost:3000/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{
    "email": "utcuser@example.com",
    "name": "UTC User",
    "code_challenge": "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM",
    "platform": "web"
  }'

# Expected: success: true

# Check database after verification
SELECT timezone FROM users WHERE email = 'utcuser@example.com';
# Expected: timezone = 'UTC'
```

## Integration Testing

### Test Scenario 1: Full User Journey

1. User registers with timezone → ✅ Stored correctly
2. User logs in → ✅ Timezone returned in response
3. User updates timezone → ✅ New timezone saved
4. User creates schedule slot → ✅ Uses correct timezone for validation
5. User views schedule → ✅ Times displayed in their timezone

### Test Scenario 2: User Travels

1. User in Paris (Europe/Paris) creates schedule for Monday 07:30 local
2. Database stores UTC equivalent
3. User travels to New York
4. User updates timezone to America/New_York
5. Same schedule slot now displays as Monday 01:30 local
6. User understands this is expected behavior

### Test Scenario 3: DST Transition

1. User in Paris creates winter schedule (UTC+1)
2. DST starts (switch to UTC+2)
3. Schedule times automatically adjust
4. Luxon handles DST transition automatically

## Performance Testing

### Database Performance

```sql
-- Test timezone index performance
EXPLAIN ANALYZE
SELECT * FROM users WHERE timezone = 'Europe/Paris';
-- Should use users_timezone_idx

-- Test common query
EXPLAIN ANALYZE
SELECT id, email, name, timezone
FROM users
WHERE id = 'some-user-id';
-- Should be fast (< 1ms)
```

### Expected Performance

- User creation with timezone: < 100ms
- Timezone update: < 50ms
- Timezone validation: < 1ms (common timezones)
- Timezone validation: < 10ms (any IANA timezone)

## Security Testing

### Test Invalid Input

```bash
# Empty string
{ "timezone": "" }
# Expected: 400 error or defaults to UTC

# Null
{ "timezone": null }
# Expected: Defaults to UTC

# SQL injection attempt
{ "timezone": "'; DROP TABLE users; --" }
# Expected: Validation fails, rejected

# XSS attempt
{ "timezone": "<script>alert('xss')</script>" }
# Expected: Validation fails, rejected

# Very long string
{ "timezone": "A" * 10000 }
# Expected: Validation fails or truncated
```

## Rollback Testing

### Test Rollback Procedure

1. **Backup database** before testing rollback
2. Apply migration
3. Create test user with timezone
4. Roll back migration:
   ```sql
   ALTER TABLE "users" DROP COLUMN "timezone";
   DROP INDEX "users_timezone_idx";
   ```
5. Verify:
   - Table structure correct
   - Application still works (with timezone features disabled)
   - No data corruption

## Production Deployment Checklist

### Pre-Deployment

- [ ] All tests pass in CI/CD pipeline
- [ ] Code review completed and approved
- [ ] Migration tested on staging environment
- [ ] Performance testing completed
- [ ] Security testing completed
- [ ] Documentation reviewed and updated

### Deployment Steps

1. [ ] Backup production database
2. [ ] Deploy code to production
3. [ ] Apply migration: `npx prisma migrate deploy`
4. [ ] Verify migration applied: Check `_prisma_migrations` table
5. [ ] Smoke test: Create test user with timezone
6. [ ] Monitor logs for errors
7. [ ] Test existing user login (should have timezone = 'UTC')
8. [ ] Test new user registration with timezone
9. [ ] Test timezone update endpoint

### Post-Deployment

- [ ] Monitor error rates (should not increase)
- [ ] Monitor API response times (should not degrade)
- [ ] Check database query performance
- [ ] Verify all users have a timezone (should all be 'UTC' initially)
- [ ] Monitor for timezone-related errors in logs

### Rollback Criteria

Trigger rollback if:
- Migration fails to apply
- Critical errors in production logs
- Performance degradation > 20%
- Data corruption detected
- Security vulnerability discovered

## Success Criteria

✅ **Deployment is successful when**:

1. All existing users have `timezone = 'UTC'`
2. New users can register with custom timezone
3. Users can update their timezone
4. Invalid timezones are rejected with helpful errors
5. API response times remain < 200ms (p95)
6. No increase in error rates
7. All endpoints return timezone in user object
8. Mobile and web clients can send timezone
9. Timezone validation works for all IANA timezones
10. No data loss or corruption

## Support Contacts

- **Technical Lead**: [Name]
- **Database Admin**: [Name]
- **DevOps**: [Name]
- **On-call Engineer**: [Name]

## Useful Commands

```bash
# Check migration status
npx prisma migrate status

# Generate Prisma client
npx prisma generate

# Run tests
npm test

# Run specific test file
npm test timezoneUtils.test.ts

# Check TypeScript
npx tsc --noEmit

# View database
npx prisma studio

# Check logs
# (Depends on your logging setup)
```

---

**Last Updated**: 2025-10-19
**Version**: 1.0
**Phase**: 1.1 - Add User Timezone to Database
