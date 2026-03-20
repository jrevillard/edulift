# E2E Testing Patterns - Best Practices & Reusable Patterns

**Last updated:** 2026-03-20
**Status:** Active
**Scope:** Global patterns for all E2E testing projects

---

## 🎯 Purpose

This document contains **reusable E2E testing patterns** that apply across different projects. Use these patterns when:
- Setting up E2E tests for new projects
- Troubleshooting E2E authentication issues
- Implementing email testing workflows
- Writing deterministic E2E tests

---

## 🔐 Authentication Patterns

### PKCE (Proof Key for Code Exchange) Flow

**When to use:** Magic link authentication with enhanced security

**Pattern:**
```
1. Generate PKCE pair:
   - code_verifier: 43-128 chars (crypto random)
   - code_challenge: SHA256(code_verifier)

2. First request (email only):
   POST /auth/magic-link
   {
     email: "user@example.com",
     code_challenge: "<base64url-encoded-sha256>"
   }

3. Backend responds:
   - 422 if new user → "Name is required"
   - 200 if existing user → "Magic link sent"

4. Second request (with name if new user):
   POST /auth/magic-link
   {
     email: "user@example.com",
     name: "User Name",
     code_challenge: "<same-challenge>"
   }

5. Verify magic link:
   POST /auth/verify
   {
     token: "<from-email>",
     code_verifier: "<original-verifier>"
   }
```

**Critical Requirements:**
- `code_challenge` and `code_verifier` must be generated in pairs
- Store verifier temporarily (sessionStorage/memory) for verification
- Use SHA256 for challenge generation
- Base64URL encode the hash (not regular Base64)

**Common Pitfalls:**
- ❌ Using different challenge/verifier pairs → verification fails
- ❌ Storing verifier in localStorage → security risk
- ❌ Forgetting to include code_challenge in first request → backend rejects
- ❌ Not waiting for 422 response → miss name field requirement

---

### Two-Click Authentication Pattern

**When to use:** Distinguishing new users from existing users

**Pattern:**
```
Step 1: Submit email
  - First click: Submit email only
  - Wait for response (422 for new user, 200 for existing)

Step 2: Handle response
  If 422 (new user):
    - Name field appears dynamically
    - Fill name
    - Second click: Submit with name
  If 200 (existing user):
    - Magic link sent immediately
```

**Implementation Example (Playwright):**
```typescript
// First click
await page.locator('[data-testid="LoginPage-Button-sendMagicLink"]').click();

// Wait for API response
await page.waitForTimeout(2000);

// Check if new user (name field appeared)
const nameField = page.locator('[data-testid="LoginPage-Input-name"]');
const isNewUser = await nameField.isVisible().catch(() => false);

if (isNewUser) {
  await nameField.fill('Test User');
  await page.locator('[data-testid="LoginPage-Button-createAccount"]').click();
}
```

**Deterministic Testing:**
- Always test BOTH flows (new user + existing user)
- Use unique emails with timestamps for new user tests
- Clean up test data or use unique identifiers

---

## 📧 Email Testing Patterns

### MailPit Integration

**What:** Email testing server for E2E tests

**API Endpoints:**
```
GET /api/v1/messages              - List all messages
GET /api/v1/messages/{id}         - Get specific message
GET /api/v1/messages/{id}/html    - Get HTML body
DELETE /api/v1/messages           - Delete all messages
```

**Pattern: Retrieve Magic Link**
```typescript
class E2EEmailHelper {
  private mailpitUrl: string;

  constructor() {
    this.mailpitUrl = process.env.MAILPIT_URL || 'http://localhost:8025';
  }

  async getLatestMagicLinkForEmail(email: string): Promise<string | null> {
    // 1. Get all messages
    const response = await fetch(`${this.mailpitUrl}/api/v1/messages`);
    const data = await response.json();

    // 2. Find message for this email
    const message = data.messages.find((msg: any) =>
      msg.To?.[0]?.Address === email
    );

    if (!message) return null;

    // 3. Get message body
    const detailResponse = await fetch(
      `${this.mailpitUrl}/api/v1/messages/${message.ID}`
    );
    const detail = await detailResponse.json();

    // 4. Extract magic link from HTML
    const html = detail.HTML;
    const match = html.match(/http:\/\/localhost:\d+\/auth\/verify\?token=[a-zA-Z0-9]+/);

    return match ? match[0] : null;
  }
}
```

**Important:**
- Wait 2-3 seconds after sending email before retrieving
- MailPit API requires `/api/v1/` prefix (common mistake: using `/messages`)
- Delete messages between tests to avoid cross-contamination

**Docker Compose Configuration:**
```yaml
mailpit-e2e:
  image: axllent/mailpit:v1.20
  ports:
    - "8025:8025"  # Web UI
    - "1025:1025"  # SMTP
  healthcheck:
    test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost:8025"]
```

---

## 🎭 Onboarding vs Existing User Pattern

**Deterministic Testing:**

For **NEW users** (always go to onboarding):
- Use unique email with timestamp: `test-${Date.now()}@example.com`
- Expect redirect to `/onboarding` after auth
- Must complete family creation before accessing protected routes

For **EXISTING users** (skip onboarding):
- Use fixed test email created in setup
- Expect redirect to `/dashboard` or target page
- Can access protected routes immediately

**Pattern: Conditional Onboarding**
```typescript
async setupUser(userKey: string, targetPath: string) {
  // Authenticate user
  await authenticateUser(userKey);

  // Check if redirected to onboarding
  const currentUrl = page.url();
  if (currentUrl.includes('/onboarding')) {
    // New user - complete onboarding
    await completeOnboarding(`Test Family ${Date.now()}`);
  }

  // Navigate to target
  await page.goto(targetPath);
}
```

**Best Practice:**
- Create test fixtures in `beforeAll()` for existing users
- Use timestamp-based emails for new users in each test
- Document which users exist vs are created dynamically

---

## 🚫 Common Anti-Patterns

### ❌ Database Manipulation in E2E Tests

**Anti-pattern:**
```typescript
// DON'T DO THIS
await createUserInDatabase({
  email: 'test@example.com',
  password: 'hashed'
});
```

**Why it's wrong:**
- Tests should validate REAL user flows
- Database bypasses frontend/backend validation
- Creates false confidence (test passes but real flow broken)

**Correct approach:**
```typescript
// DO THIS
await page.goto('/login');
await page.locator('[data-testid="LoginPage-Input-email"]').fill('test@example.com');
await page.locator('[data-testid="LoginPage-Button-sendMagicLink"]').click();
// ... complete real authentication flow
```

---

### ❌ API Mocking in E2E Tests

**Anti-pattern:**
```typescript
// DON'T DO THIS
await page.route('**/api/auth/magic-link', route => {
  route.fulfill({
    status: 200,
    body: JSON.stringify({ success: true })
  });
});
```

**Why it's wrong:**
- E2E = end-to-end, not unit tests
- Mocking hides integration bugs
- Tests don't validate real backend behavior

**Correct approach:**
- Use real backend API (localhost:8002 or docker service)
- Test actual integration between frontend and backend
- If backend is slow, fix backend - don't mock it

---

### ❌ Brittle Selectors

**Anti-pattern:**
```typescript
// BRITTLE
await page.click('button');  // Which button?
await page.click('text=Submit');  // What if text changes?
await page.locator('.css-class').click();  // CSS can change
```

**Correct approach:**
```typescript
// STABLE
await page.locator('[data-testid="LoginPage-Button-submit"]').click();
```

**Best Practices:**
- Always use `data-testid` attributes for E2E tests
- Prefix with component name: `ComponentName-elementType-purpose`
- Example: `LoginPage-Button-submit`, `FamilyPage-List-members`

---

## ⚡ Test Isolation vs Determinism Trade-off

### Design Choice: ISOLATION > DETERMINISM

**Chosen approach:** Each test generates unique data using timestamps/UUIDs

**Why this trade-off:**
- ✅ **Test isolation**: Each test has its own namespace
- ✅ **Parallel execution**: No conflicts between tests
- ✅ **No cleanup needed**: Data doesn't overlap
- ❌ **Non-reproducible**: Different data on each run
- ❌ **Harder debugging**: Can't reproduce exact failure scenario

**Alternative (deterministic approach):**
- Use fixed test data: `test-user-001@example.com`
- Requires database cleanup between tests
- Tests must run sequentially (or complex transaction management)
- Better for regression testing, worse for parallel execution

### Test Data Generation Pattern

**Use TestDataGenerator helper** (TypeScript) or equivalent:

```typescript
import { TestDataGenerator } from './fixtures/test-data-generator';

// Generate unique data for each test
const email = TestDataGenerator.generateUniqueEmail();
const familyName = TestDataGenerator.generateUniqueFamilyName();
const childData = TestDataGenerator.generateChildData({ userPrefix: 'O' });
const vehicleData = TestDataGenerator.generateVehicleData({ userPrefix: 'O' });
```

**Key principles:**
- Each test creates its own data (no sharing)
- Timestamp-based with increment guarantee (prevents collisions)
- UUID suffix for additional uniqueness
- Prefix-based categorization (auth_, family_, group_, etc.)

### Test Isolation Requirements

**Each test MUST:**
- Generate its own unique data (no shared state)
- Use TestDataGenerator for all dynamic data
- Not depend on execution order
- Be runnable independently
- Not require cleanup (data isolated by uniqueness)

**Pattern for unique identifiers:**
```typescript
// Email with test category prefix
const email = TestDataGenerator.generateEmailWithPrefix('auth');

// Family name with timestamp
const familyName = TestDataGenerator.generateUniqueFamilyName();

// Child with user role prefix
const childData = TestDataGenerator.generateChildData({ userPrefix: 'O' });
```

---

### Parallel Execution

**Design tests for parallel execution:**
- No shared state between tests
- Unique test data per test
- Independent database transactions (if database used)

**Playwright Configuration:**
```typescript
// playwright.config.ts
export default defineConfig({
  fullyParallel: true,  // Run tests in parallel
  workers: process.env.CI ? 2 : 4,  // Adjust based on machine
});
```

---

## 🐛 Debugging Patterns

### When Tests Fail

**Step 1: Check logs**
```bash
# Run with verbose output
npx playwright test --reporter=list

# Check test results
cat test-results/<test-name>/error-context.md
```

**Step 2: Run in headed mode**
```bash
# Watch what happens
npx playwright test <test-name> --headed
```

**Step 3: Add debugging**
```typescript
// Add breakpoints
await page.pause();

// Take screenshots
await page.screenshot({ path: 'debug.png' });

// Console logs
console.log('Current URL:', page.url());
console.log('LocalStorage:', await page.evaluate(() => localStorage));
```

---

### Common Failure Modes

**Timeout waiting for element:**
- Element doesn't exist → check selector
- Element not visible → check CSS/display property
- Element covered by modal → close modal first
- Network request pending → wait for load state

**Authentication failures:**
- Magic link expired → retrieve fresh link
- Wrong email format → validate email input
- PKCE mismatch → regenerate challenge/verifier pair
- CORS blocked → check backend CORS configuration

**Flaky tests (sometimes pass, sometimes fail):**
- Race conditions → add explicit waits
- Timing dependent → wait for specific conditions, not timeouts
- Shared state → use unique test data
- Network issues → retry with exponential backoff

---

## 📚 Related Documentation

For project-specific implementation, see:
- `/workspace/e2e/CLAUDE.md` - EduLift E2E test structure
- `/workspace/e2e/METHODOLOGY.md` - Testing methodology
- `/workspace/e2e/tests/fixtures/` - Reusable test helpers

---

## 🔄 Version History

- **2026-03-20**: Initial version with PKCE, MailPit, and anti-patterns
