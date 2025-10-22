# E2E Test Fixtures

## FileSpecificTestData

The `FileSpecificTestData` class eliminates code duplication and ensures test isolation across different test files.

### Why This Fixture?

**Before**: Each test file had 50-100 lines of duplicated code for creating users and families.

**After**: 5 lines to set up isolated test data with automatic concurrency protection.

### Usage Example

```typescript
import { FileSpecificTestData } from '../fixtures/file-specific-test-data';

test.describe('My Feature E2E', () => {
  // Initialize with unique file prefix
  const testData = new FileSpecificTestData('myfeature');
  
  // Define users (doesn't create in DB yet)
  testData.defineUser('admin', 'admin', 'Admin User');
  testData.defineUser('member', 'member', 'Member User');
  
  // Define families with relationships
  testData.defineFamily('mainFamily', 'Main Test Family', 'admin', [
    { userKey: 'member', role: 'MEMBER' }
  ]);

  test.beforeAll(async () => {
    // Create all users in database
    await testData.createUsersInDatabase();
    // Create all families in database
    await testData.createFamilyInDatabase('mainFamily');
  });

  test('should do something', async ({ page }) => {
    const authHelper = new UniversalAuthHelper(page);
    // Use the defined users
    await authHelper.directUserSetup(testData.getUser('admin'), '/dashboard');
    
    // Test continues...
  });
});
```

### Benefits

✅ **Eliminates 90% of test setup duplication**
✅ **Automatic concurrency protection** (unique timestamps per test run)
✅ **Type-safe user access** (throws clear errors for undefined users)
✅ **Centralized user/family creation logic**
✅ **Easy debugging** with `testData.getDebugInfo()`

### File Naming Pattern

The generated emails and IDs follow this pattern:
- Email: `{base}.{filePrefix}.{timestamp}@edulift.com`
- ID: `{base}-{filePrefix}-{timestamp}`

Example for file prefix "invitations":
- Email: `admin.invitations.1672531200123@edulift.com`
- ID: `admin-invitations-1672531200123`

This ensures complete isolation between different test files and test runs.

### Comparison: Before vs After

**Before (50+ lines of duplication per file):**
```typescript
const FILE_PREFIX = 'invitations';
const RUN_TIMESTAMP = Date.now() + Math.floor(Math.random() * 1000);
const getFileSpecificEmail = (base: string) => `${base}.${FILE_PREFIX}.${RUN_TIMESTAMP}@edulift.com`;
const getFileSpecificId = (base: string) => `${base}-${FILE_PREFIX}-${RUN_TIMESTAMP}`;

const testUsers = {
  admin: {
    id: getFileSpecificId('admin'),
    email: getFileSpecificEmail('admin'),
    name: 'Admin User'
  }
};

async function createFileSpecificUsers() {
  const { execSync } = require('child_process');
  // 40 more lines of user creation logic...
}
```

**After (5 lines):**
```typescript
const testData = new FileSpecificTestData('invitations');
testData.defineUser('admin', 'admin', 'Admin User');

test.beforeAll(async () => {
  await testData.createUsersInDatabase();
});
```

**Result**: 90% less code, same functionality, better maintainability!