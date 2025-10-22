# Testing Standards and Anti-Patterns

*Applies to Unit Tests, Integration Tests, and E2E Tests*

## 🚨 Critical Anti-Patterns to Avoid (All Test Types)

### ❌ **Silent Failure Pattern #1: Conditional Testing (All Test Types)**
```typescript
// WRONG - E2E: Test passes even if button doesn't exist
if (await button.isVisible()) {
  await button.click();
}

// WRONG - Unit: Test passes even if method exists
if (typeof obj.criticalMethod === 'function') {
  expect(obj.criticalMethod()).toBe(expected);
}

// WRONG - Integration: Test passes even if API endpoint missing
if (response.data) {
  expect(response.data.length).toBeGreaterThan(0);
}

// RIGHT - E2E: Test fails if button doesn't exist
await expect(button).toBeVisible({ timeout: 10000 });
await button.click();

// RIGHT - Unit: Test fails if method missing
expect(obj.criticalMethod).toBeDefined();
expect(obj.criticalMethod()).toBe(expected);

// RIGHT - Integration: Test fails if API response malformed
expect(response.data).toBeDefined();
expect(response.data.length).toBeGreaterThan(0);
```

### ❌ **Silent Failure Pattern #2: Optional Feature Testing (All Test Types)**
```typescript
// WRONG - E2E: Core functionality can be silently skipped
if (await modalFound) {
  // Test modal functionality
} else {
  console.log('Modal not found, skipping test');
  return; // DANGEROUS!
}

// WRONG - Unit: Core behavior can be silently skipped
if (service.isFeatureEnabled()) {
  expect(service.processData()).toBe(expected);
} else {
  console.log('Feature disabled, skipping test');
  return; // DANGEROUS!
}

// WRONG - Integration: Core endpoint can be silently skipped
if (apiClient.supportsFeature('advanced')) {
  const result = await apiClient.getAdvancedData();
  expect(result).toBeDefined();
} else {
  return; // DANGEROUS!
}

// RIGHT - E2E: Core functionality must exist
const modals = page.locator('[role="dialog"]');
await expect(modals).toHaveCount({ min: 1 });
// Continue with modal testing

// RIGHT - Unit: Core behavior must be testable
expect(service.processData).toBeDefined();
const result = service.processData();
expected(result).toBe(expected);

// RIGHT - Integration: Core endpoint must exist
const result = await apiClient.getAdvancedData();
expect(result).toBeDefined();
```

### ❌ **Silent Failure Pattern #3: Fallback Success Paths (All Test Types)**
```typescript
// WRONG - E2E: Test passes by testing different functionality
if (primaryFeatureWorking) {
  // Test primary feature
} else {
  // Test basic functionality instead
  expect(basicElement).toBeVisible(); // DANGEROUS FALLBACK!
}

// WRONG - Unit: Test passes by testing fallback behavior
if (service.primaryMethod) {
  expect(service.primaryMethod()).toBe(expected);
} else {
  expect(service.fallbackMethod()).toBe(fallbackExpected); // DANGEROUS!
}

// WRONG - Integration: Test passes by testing different endpoint
if (await canCallPrimaryAPI()) {
  const result = await api.primaryEndpoint();
  expect(result.status).toBe(200);
} else {
  const result = await api.fallbackEndpoint();
  expect(result.status).toBe(200); // DANGEROUS FALLBACK!
}

// RIGHT - E2E: Primary feature must work
await expect(primaryFeature).toBeVisible();
// Test primary feature only

// RIGHT - Unit: Primary method must work
expect(service.primaryMethod).toBeDefined();
expect(service.primaryMethod()).toBe(expected);

// RIGHT - Integration: Primary endpoint must work
const result = await api.primaryEndpoint();
expect(result.status).toBe(200);
```

### ❌ **Silent Failure Pattern #4: Swallowed Setup Failures**
```typescript
// WRONG - Setup failures are hidden
try {
  await setupCriticalData();
} catch (error) {
  console.log('Setup failed, using defaults');
  // Test continues with broken state
}

// RIGHT - Setup failures cause test failure
await setupCriticalData(); // Let it throw
// Or explicitly handle with clear failure
```

## ✅ Recommended Patterns

### 1. **Explicit Element Expectations**
```typescript
// Always use explicit expectations with timeouts
await expect(element).toBeVisible({ timeout: 10000 });
await expect(element).toHaveText('Expected Text');
await expect(element).toBeEnabled();
```

### 2. **Fail-Fast Error Handling**
```typescript
// Throw descriptive errors when critical elements are missing
if (!(await criticalElement.isVisible())) {
  throw new Error(`Critical element missing: ${selector}. This indicates a broken user flow.`);
}
```

### 3. **Mandatory Feature Validation**
```typescript
// For core features, make them required not optional
const coreFeatures = [
  page.locator('[data-testid="primary-action"]'),
  page.locator('[data-testid="navigation-menu"]'),
  page.locator('[data-testid="user-profile"]')
];

for (const feature of coreFeatures) {
  await expect(feature).toBeVisible();
}
```

### 4. **Clear Test Intentions**
```typescript
// Test names should clearly state what's being validated
test('should successfully complete vehicle assignment workflow', async ({ page }) => {
  // Test must actually complete the workflow, not just navigate to the page
});

test('should prevent unauthorized access to admin features', async ({ page }) => {
  // Test must verify access is actually prevented, not just check if login form exists
});
```

## 🎯 Data-TestId Standards

### Required Attributes
- All interactive elements MUST have `data-testid` attributes
- Use descriptive, unique identifiers across the entire application
- Follow naming convention: `{component}-{action}-{element}`

### Examples:
```typescript
// Good examples
[data-testid="schedule-add-vehicle-btn"]
[data-testid="family-invite-regenerate-btn"] 
[data-testid="auth-logout-confirm-btn"]
[data-testid="modal-close-btn"]

// Bad examples (avoid)
[data-testid="button"] // Too generic
[data-testid="btn1"] // Not descriptive
text="Save" // Text selectors break with localization
```

## 🔍 Test Structure Standards

### 1. **Use Test Steps for Complex Flows**
```typescript
test('complex user workflow', async ({ page }) => {
  await test.step('Setup user authentication', async () => {
    // Authentication logic
  });

  await test.step('Navigate to feature page', async () => {
    // Navigation logic
  });

  await test.step('Perform primary action', async () => {
    // Core feature testing
  });

  await test.step('Verify results', async () => {
    // Validation logic
  });
});
```

### 2. **Error Context in Failures**
```typescript
// Provide helpful context when tests fail
try {
  await expect(element).toBeVisible();
} catch (error) {
  const pageContent = await page.content();
  throw new Error(`Element not found. Current page: ${page.url()}, Error: ${error.message}`);
}
```

### 3. **Timeout Best Practices**
```typescript
// Use appropriate timeouts for different scenarios
await expect(fastElement).toBeVisible({ timeout: 5000 });     // Fast interactions
await expect(apiDependent).toBeVisible({ timeout: 15000 });   // API-dependent elements
await expect(slowLoad).toBeVisible({ timeout: 30000 });       // Heavy page loads
```

## 🚫 Forbidden Patterns

### 1. **Never Use Silent Returns**
```typescript
// FORBIDDEN
if (!condition) {
  return; // Silently skips test
}

// REQUIRED
if (!condition) {
  throw new Error('Condition not met, test cannot continue');
}
```

### 2. **Never Ignore Expected Functionality**
```typescript
// FORBIDDEN
if (await optionalButton.isVisible()) {
  // Only test if button exists
}

// REQUIRED - If functionality is expected, enforce it
await expect(requiredButton).toBeVisible();
```

### 3. **Never Use Generic Error Handling**
```typescript
// FORBIDDEN
try {
  await criticalAction();
} catch {
  // Generic handling hides real issues
}

// REQUIRED
await criticalAction(); // Let specific errors surface
```

## 📊 Quality Gates

### Before Merging Tests Must:
**Unit Tests:**
1. ✅ Use explicit assertions for all critical functionality
2. ✅ Have zero silent return statements in test logic
3. ✅ Mock dependencies appropriately without hiding errors
4. ✅ Include descriptive error messages for all custom throws
5. ✅ Test actual business logic, not just existence
6. ✅ Use `data-testid` selectors instead of text or CSS selectors
7. ✅ Use proper test ID naming: `[ComponentName]-[ElementType]-[descriptiveName]
8. ✅ Using multiple selectors as fallbacks is not a good practice -> Use `data-testid` selectors

**Integration Tests:**
1. ✅ Use explicit assertions for API responses and data flow
2. ✅ Have zero silent failure handling in critical paths
3. ✅ Validate complete integration scenarios, not just connectivity
4. ✅ Include proper error context for debugging
5. ✅ Test realistic data scenarios and edge cases
6. ✅ Use `data-testid` selectors instead of text or CSS selectors
7. ✅ Use proper test ID naming: `[ComponentName]-[ElementType]-[descriptiveName]
8. ✅ Using multiple selectors as fallbacks is not a good practice -> Use `data-testid` selectors

**E2E Tests:**
1. ✅ Use explicit `await expect()` assertions for all critical elements
2. ✅ Have zero silent return statements in core test flows
3. ✅ Use `data-testid` selectors instead of text or CSS selectors
4. ✅ Use proper test ID naming: `[ComponentName]-[ElementType]-[descriptiveName]
5. ✅ Include descriptive error messages for all custom error throws
5. ✅ Validate the actual feature functionality, not just UI presence
6. ✅ Include proper test step organization for complex flows
7. ✅ Real user flows only (no mocks, API calls, or fake data)
8. ✅ Using multiple selectors as fallbacks is not a good practice -> Use `data-testid` selectors

### Code Review Checklist:
- [ ] No `if (element.isVisible()) { return; }` patterns
- [ ] No tests that pass when expected functionality is missing
- [ ] All interactive elements have proper `data-testid` attributes
- [ ] Error messages provide actionable debugging information
- [ ] Test names accurately describe what's being validated
- [ ] Timeouts are appropriate for the type of interaction

## 🔧 Linting and Automation

### Generic ESLint Rules

The project includes custom ESLint rules to automatically detect dangerous testing patterns:

```javascript
// In your project's ESLint config, import the rules:
import testingRules from './eslint-testing-rules.js';

export default [
  {
    files: ['**/*.test.ts', '**/*.test.js', '**/*.spec.ts', '**/*.spec.js'],
    plugins: {
      'testing-standards': testingRules
    },
    rules: {
      'testing-standards/no-silent-returns': 'error',
      'testing-standards/require-explicit-assertions': 'error',
      'testing-standards/prefer-reliable-patterns': 'warn',
      'testing-standards/require-descriptive-errors': 'warn'
    }
  }
];
```

### Pre-commit Hooks

Automated checks prevent dangerous patterns from being committed:

```yaml
# .pre-commit-config.yaml
- id: testing-standards-check
  name: Testing Standards Check (All Test Types)
  entry: bash -c 'grep -r "if.*return;" --include="*.test.ts" --include="*.spec.ts" . && exit 1 || echo "✅ No dangerous patterns found"'
  language: system
  files: \.(test|spec)\.(ts|js)$
```

## 🛠️ Tools and Utilities

### Recommended Helper Functions:
```typescript
// Helper for enforcing element visibility
async function mustBeVisible(locator: Locator, description: string, timeout = 10000) {
  try {
    await expect(locator).toBeVisible({ timeout });
  } catch (error) {
    throw new Error(`Required element not visible: ${description}. This indicates broken functionality.`);
  }
}

// Helper for critical user actions
async function performCriticalAction(locator: Locator, action: string) {
  await mustBeVisible(locator, action);
  await locator.click();
  console.log(`✅ Successfully performed: ${action}`);
}
```

## 📚 References

- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Testing Library Guiding Principles](https://testing-library.com/docs/guiding-principles/)
- [Test Automation Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)

---

*This document is living and should be updated as patterns evolve. Any additions or modifications should be reviewed by the team and validated through practical implementation.*