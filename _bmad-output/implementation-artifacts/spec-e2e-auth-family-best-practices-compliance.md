---
title: 'E2E Auth & Family Best Practices Compliance'
type: 'refactor'
created: '2026-03-28'
status: 'draft'
context:
  - e2e/CLAUDE.md
  - .claude/rules/e2e-testing-patterns.md
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** 25 best-practice violations across 5 E2E test files — `page.goto()` for in-app navigation (15), `waitForTimeout` instead of explicit waits (9), and 1 API mock anti-pattern.

**Approach:** Mechanical replacement of each violation using existing navigation UI elements (BottomNav, DesktopNav) and explicit Playwright waits (`expect().toBeVisible()`, `waitForEmailForRecipient()`). No logic changes.

## Boundaries & Constraints

**Always:** Preserve all existing test assertions and test logic. Only change HOW navigation/waiting happens, not WHAT is tested.

**Ask First:** API mock in `04-family-lifecycle.spec.ts:406-423` (tests error resilience via `page.route()`). Remove or keep?

**Never:** Add new tests. Modify test assertions. Change test data generation. Touch files already compliant (`auth/03`, `family/01`).

## Code Map

- `e2e/tests/auth/01-user-authentication.spec.ts` -- 3 page.goto + 4 waitForTimeout
- `e2e/tests/auth/02-invitation-context.spec.ts` -- 3 page.goto + 1 waitForTimeout
- `e2e/tests/family/02-family-invitations.spec.ts` -- 5 waitForTimeout
- `e2e/tests/family/03-family-member-management.spec.ts` -- 6 page.goto
- `e2e/tests/family/04-family-lifecycle.spec.ts` -- 3 page.goto + 1 API mock
- `frontend/src/components/layout/DesktopNav.tsx` -- Nav links for /dashboard, /family/manage, /groups, /schedule (no data-testid on nav links, use `getByRole('link', { name })`)
- `frontend/src/components/layout/BottomNav.tsx` -- data-testid: `BottomNav-Button-home`, `BottomNav-Button-family`, `BottomNav-Button-schedule`

## Tasks & Acceptance

**Execution:**
- [ ] `e2e/tests/auth/01-user-authentication.spec.ts` -- Remove 4 `waitForTimeout(3000)` before `waitForEmailForRecipient()` (method already has retry logic); replace 3 `page.goto()` for `/family/manage` and `/dashboard` with BottomNav clicks (`BottomNav-Button-family`, `BottomNav-Button-home`) + `waitForURL()`
- [ ] `e2e/tests/auth/02-invitation-context.spec.ts` -- Replace 3 `page.goto()` for in-app routes with UI navigation; replace 1 `waitForTimeout(2000)` with `waitForEmailForRecipient()`
- [ ] `e2e/tests/family/02-family-invitations.spec.ts` -- Replace 2 `waitForTimeout(2000)` before email extraction with `waitForEmailForRecipient()`; replace 3 `waitForTimeout(2000-3000)` after React Query stable with explicit element assertions (`expect(element).toBeVisible()`)
- [ ] `e2e/tests/family/03-family-member-management.spec.ts` -- Replace 6 `page.goto()` for `/family/manage`, `/children`, `/vehicles` with BottomNav clicks + `waitForURL()`
- [ ] `e2e/tests/family/04-family-lifecycle.spec.ts` -- Replace 3 `page.goto()` for `/family/manage` with BottomNav click + `waitForURL()`; handle API mock per user decision

**Acceptance Criteria:**
- Given all 5 files modified, when running `npx playwright test tests/auth/ tests/family/`, then 42 passed, 0 failed, 20 skipped
- Given modified files, when searching for `page.goto(` in-app navigation patterns, then zero matches (only initial loads, external URLs, context isolation, and reload remain)
- Given modified files, when searching for `waitForTimeout`, then zero matches in spec files

## Design Notes

**Navigation replacement pattern:**
```typescript
// Before
await page.goto('/family/manage');

// After — use BottomNav (always visible)
await page.locator('[data-testid="BottomNav-Button-family"]').click();
await page.waitForURL('/family/manage', { timeout: 10000 });
await page.waitForLoadState('networkidle');
```

**waitForTimeout removal pattern (auth files):**
```typescript
// Before
await page.waitForTimeout(3000);
const email = await emailHelper.waitForEmailForRecipient(userEmail);

// After — waitForEmailForRecipient already has retry logic
const email = await emailHelper.waitForEmailForRecipient(userEmail);
```

**waitForTimeout replacement pattern (family invitations):**
```typescript
// Before
await page.waitForTimeout(2000);
const magicLink = await emailHelper.extractMagicLinkForRecipient(email);

// After — wait for email explicitly first
await emailHelper.waitForEmailForRecipient(email);
const magicLink = await emailHelper.extractMagicLinkForRecipient(email);
```

## Verification

**Commands:**
- `cd /workspace/e2e && npx playwright test tests/auth/ tests/family/ --reporter=line` -- expected: 42 passed, 20 skipped, 0 failed
- `grep -n 'waitForTimeout' e2e/tests/auth/*.spec.ts e2e/tests/family/*.spec.ts` -- expected: 0 matches
- `grep -n 'page.goto' e2e/tests/auth/*.spec.ts e2e/tests/family/*.spec.ts` -- expected: only context-isolation, initial-load, external-URL, and reload patterns

