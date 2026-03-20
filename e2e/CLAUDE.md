# EduLift E2E Tests - Project-Specific Guide

**Last updated:** 2026-03-20
**Project:** EduLift - Collaborative School Transportation Management

---

## 🎯 Purpose

This document contains **EduLift-specific E2E testing information**: test structure, helpers, configuration, and known issues.

For **reusable E2E patterns** (PKCE flow, MailPit integration, etc.), see:
→ `.claude/rules/e2e-testing-patterns.md`

---

## 📂 Test Structure

```
e2e/
├── tests/
│   ├── auth/                    # Authentication tests
│   │   ├── 01-user-authentication.spec.ts
│   │   ├── 02-invitation-context.spec.ts
│   │   └── 03-session-management.spec.ts
│   ├── family/                  # Family management tests
│   │   ├── 01-family-creation.spec.ts
│   │   ├── 02-family-invitations.spec.ts
│   │   ├── 03-family-member-management.spec.ts
│   │   └── family-advanced-scenarios.spec.ts
│   ├── group/                   # Group coordination tests
│   │   ├── 01-group-creation.spec.ts
│   │   ├── 02-group-invitations.spec.ts
│   │   ├── 03-group-scheduling.spec.ts
│   │   ├── 04-group-coordination.spec.ts
│   │   └── 05-group-lifecycle.spec.ts
│   ├── schedule/                # Schedule management tests
│   │   ├── 01-schedule-creation-and-assignments.spec.ts
│   │   └── 02-schedule-modifications.spec.ts
│   ├── access-control/          # Permissions tests
│   ├── connectivity/            # Network resilience tests
│   ├── integration/             # Cross-feature flows
│   │   ├── unified-invitation-system.spec.ts
│   │   ├── cross-feature-flows.spec.ts
│   │   └── multiple-pending-invitations.spec.ts
│   └── fixtures/                # Test helpers & utilities
│       ├── base.ts              # Playwright fixtures
│       ├── universal-auth-helper.ts  # Authentication helper
│       ├── e2e-email-helper.ts  # MailPit integration
│       └── FileSpecificTestData.ts  # Test data management
├── docker-compose.yml           # E2E environment
├── playwright.config.ts         # Playwright configuration
└── playwright.Dockerfile        # Test container image
```

---

## 🔧 Running Tests

### Quick Start
```bash
# From /workspace/e2e directory

# Run all tests
npx playwright test

# Run specific test file
npx playwright test 01-user-authentication

# Run with headed browser (for debugging)
npx playwright test 01-user-authentication --headed

# Run specific folder
npx playwright test tests/auth/
```

### Docker Environment
```bash
# Start E2E environment
cd /workspace/e2e
docker compose up -d

# Rebuild after changes
docker compose up -d --build frontend-e2e backend-e2e

# View logs
docker compose logs -f frontend-e2e
docker compose logs -f backend-e2e
```

---

## 🧪 Test Helpers

### UniversalAuthHelper

**Location:** `tests/fixtures/universal-auth-helper.ts`

**Purpose:** Complete authentication flow with PKCE and MailPit integration

**Key Methods:**

```typescript
// Define test user
authHelper.defineUser('userKey', 'email-prefix', 'Display Name');

// Real authentication with magic link
await helper.realUserSetup('userKey', '/dashboard');

// Complete onboarding (for new users)
await helper.completeOnboarding('Family Name');

// Direct setup (deprecated - avoid)
await helper.directUserSetup('userKey', '/dashboard');
```

**Usage Example:**
```typescript
import { UniversalAuthHelper } from './fixtures/universal-auth-helper';

test('should access dashboard', async ({ page }) => {
  const helper = UniversalAuthHelper.forCurrentFile(page);
  helper.defineUser('testUser', 'test-user', 'Test User');

  // Authenticate with real magic link flow
  await helper.realUserSetup('testUser', '/dashboard');

  // Test continues...
});
```

---

### E2EEmailHelper

**Location:** `tests/fixtures/e2e-email-helper.ts`

**Purpose:** Retrieve magic links from MailPit

**Key Methods:**
```typescript
// Get latest magic link for email
const magicLink = await emailHelper.getLatestMagicLinkForEmail('user@example.com');

// Get message with retry
const message = await emailHelper.getMessageWithRetry(
  'user@example.com',
  { maxAttempts: 5, interval: 2000 }
);

// Delete all messages
await emailHelper.deleteAllMessages();
```

**Important:** MailPit API endpoint is `/api/v1/messages` (NOT `/messages`)

---

## 🐳 Docker Configuration

### Services

**Frontend** (`frontend-e2e`):
- Port: `8001:3000`
- Environment: `VITE_API_URL=http://localhost:8002`
- Build: `frontend/Dockerfile.dev`

**Backend** (`backend-e2e`):
- Port: `8002:3001`
- Environment: `NODE_ENV=test`, `DATABASE_URL=postgresql://...`
- Runs Prisma migrations on startup

**MailPit** (`mailpit-e2e`):
- Port: `8025:8025` (Web UI)
- Port: `1025:1025` (SMTP)
- API: `http://localhost:8025/api/v1/*`

**PostgreSQL** (`postgres-e2e`):
- Database: `edulift_e2e`
- User: `edulift_user`
- Password: `edulift_password`

**Redis** (`redis-e2e`):
- Port: `6379`
- Used for sessions and caching

---

## 🔑 Test Data Generation

### TestDataGenerator Helper

**Location:** `tests/fixtures/test-data-generator.ts`

**Purpose:** Generate unique test data for complete test isolation

**Usage:**
```typescript
import { TestDataGenerator } from './fixtures/test-data-generator';

// Unique email (timestamp + UUID)
const email = TestDataGenerator.generateUniqueEmail();

// Email with category prefix
const authEmail = TestDataGenerator.generateEmailWithPrefix('auth');
const familyEmail = TestDataGenerator.generateEmailWithPrefix('family');

// Unique family name
const familyName = TestDataGenerator.generateUniqueFamilyName();

// Child data (with user prefix)
const childData = TestDataGenerator.generateChildData({ userPrefix: 'O' });
// Returns: { name: 'O-Emma abcdefgh', age: 10 }

// Vehicle data (with user prefix)
const vehicleData = TestDataGenerator.generateVehicleData({ userPrefix: 'O' });
// Returns: { name: 'O-Honda Civic 1234567890 abc12345', capacity: 6 }

// Batch generation
const children = TestDataGenerator.generateMultipleChildren(3, 'O');
const vehicles = TestDataGenerator.generateMultipleVehicles(2, 'O');
```

**Design principle:** ISOLATION > DETERMINISM
- Each test generates unique data
- No conflicts between parallel tests
- No cleanup required
- Trade-off: Not reproducible (different data each run)

**For existing users:** Create in test setup (`beforeAll`) with fixed emails for stable tests

---

## ⚠️ Known Issues & Solutions

### Issue 1: TypeError "X.map is not a function"

**Location:** Children/Vehicles management pages

**Cause:** Undefined data instead of array

**Solution:** Use optional chaining in components
```typescript
// Instead of: family.members.map(...)
// Use: family.members?.map(...) || []
```

**Status:** ✅ Fixed in current codebase

---

### Issue 2: PKCE Verification Fails

**Symptoms:** Magic link verification returns 401/403

**Causes:**
- Code verifier doesn't match challenge
- Verifier not stored during magic link request
- Using wrong verifier (from different request)

**Solution:**
```typescript
// Store verifier immediately after generation
const { code_verifier, code_challenge } = await generatePKCEPair();
await sessionStorage.setItem('pkce_verifier', code_verifier);

// Use SAME verifier during verification
const storedVerifier = await sessionStorage.getItem('pkce_verifier');
```

---

### Issue 3: MailPit API 404

**Symptoms:** `GET /messages` returns 404

**Cause:** Missing `/api/v1/` prefix

**Solution:**
```typescript
// WRONG
fetch('http://localhost:8025/messages')

// CORRECT
fetch('http://localhost:8025/api/v1/messages')
```

---

### Issue 4: New Users Redirected to Onboarding

**Symptoms:** Test navigates to `/children` but ends up on `/onboarding`

**Cause:** New users must create family before accessing protected routes

**Solution:**
```typescript
// After authentication, check for onboarding
if (page.url().includes('/onboarding')) {
  await completeOnboarding('Test Family');
}

// Then navigate to target
await page.goto('/children');
```

---

## 🎯 Test Data Isolation

### Important: No Database Manipulation

**Anti-pattern:**
```typescript
// DON'T DO THIS
await createUsersInDatabase();
await createFamilyInDatabase();
```

**Correct approach:**
- Use UI for all data creation
- Use unique timestamps for test data
- Clean up via UI or let data be isolated

**Rationale:**
- E2E tests should validate REAL user flows
- Database bypass creates false confidence
- Tests must work like real users

---

## 📊 Test Execution Strategy

### Run Order

1. **Auth tests** → Foundation, all tests depend on auth
2. **Family tests** → Core entity
3. **Group tests** → Depends on families
4. **Schedule tests** → Depends on groups
5. **Integration tests** → Cross-feature flows

### Parallel Execution

**Current:** Tests run sequentially (one worker)

**To enable parallel:**
```bash
# Increase workers in playwright.config.ts
workers: 4

# Ensure test data isolation
# Each test uses unique timestamps
```

---

## 🐛 Debugging Tips

### Check Current URL
```typescript
console.log('Current URL:', page.url());
```

### Take Screenshot
```typescript
await page.screenshot({ path: `debug-${Date.now()}.png` });
```

### View LocalStorage
```typescript
const storage = await page.evaluate(() => localStorage);
console.log('LocalStorage:', storage);
```

### Pause Execution
```typescript
await page.pause();  // Opens Playwright Inspector
```

### Run Single Test
```bash
npx playwright test --grep "test name"
```

---

## 📚 Related Documentation

- **[E2E Testing Patterns](.claude/rules/e2e-testing-patterns.md)** - Reusable patterns (PKCE, MailPit, etc.)
- **[METHODOLOGY.md](METHODOLOGY.md)** - Testing methodology
- **[Test Status Report](../docs/E2E-Testing-Status-Report.md)** - Current test coverage

---

## 🔄 Recent Changes

- **2026-03-20**: Fixed PKCE verification path (/api/v1/auth/verify)
- **2026-03-20**: Improved error handling for nested error structures
- **2026-03-20**: Updated MailPit API endpoints to use /api/v1/ prefix
- **2026-03-20**: Implemented two-click authentication flow
- **2026-03-20**: Added deterministic onboarding handling

---

## ✅ Success Criteria

**All E2E tests should:**
- ✅ Use real authentication flow (no JWT bypass)
- ✅ Use real MailPit for email retrieval
- ✅ Create test data via UI (not database)
- ✅ Use unique identifiers (timestamps, UUIDs)
- ✅ Be deterministic (same result every run)
- ✅ Be runnable independently (no execution order dependency)
- ✅ Use stable selectors (data-testid attributes)
