---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-identify-targets', 'step-03-generate-migrate-tests', 'step-04-validate-and-summarize']
lastStep: 'step-04-validate-and-summarize'
lastSaved: '2026-03-30'
---

# Legacy E2E Test Migration - EduLift

## Context

- **Objective**: Clean up legacy E2E test files and modernize test suite
- **Stack**: Frontend E2E (Playwright, React/TypeScript)
- **Framework**: Playwright with `@playwright/test`
- **Mode**: Standalone (no BMad artifacts, source code only)

## Action Taken

### Files Deleted (12 total)

**Duplicate/obsolete (7):**
- `tests/schedule/01-schedule-creation-and-assignments.spec.ts` — duplicate of modern file
- `tests/schedule/02-schedule-modifications.spec.ts` — duplicate of modern file
- `tests/family-management.spec.ts` — covered by modern family/ tests
- `tests/debug-login.spec.ts` — debug-only file
- `tests/connectivity/basic-connectivity.spec.ts` — covered by modern auth tests
- `tests/connectivity/network-resilience.spec.ts` — legacy auth patterns
- `tests/access-control/simple-access-test.spec.ts` — duplicate of family-permissions

**Redundant after analysis (5):**
- `tests/access-control/family-permissions.spec.ts` — covered by children/vehicles P1 tests
- `tests/integration/unified-invitation-system.spec.ts` — covered by auth tests
- `tests/integration/cross-feature-flows.spec.ts` — legacy patterns (scenario noted in backlog)
- `tests/integration/magic-link-invitation-context-complete.spec.ts` — covered by auth tests
- `tests/integration/multiple-pending-invitations.spec.ts` — covered by auth tests

### Empty Directories Removed
- `tests/access-control/`
- `tests/connectivity/`
- `tests/integration/`

## Final Test Suite

### Active E2E Test Files (14)

| Directory | Files | Status |
|-----------|-------|--------|
| auth/ | 3 | Modern |
| family/ | 6 | Modern |
| group/ | 6 | Modern |
| schedule/ | 2 | Modern (fresh files from group migration) |
| dashboard/ | 1 | Modern (new) |
| profile/ | 1 | Modern (new) |

### Test Count

| Priority | Count |
|----------|-------|
| P0 | 6 |
| P1 | 11 |
| P2 | 3 |
| **Total** | **20** |

## Backlog

### Cross-Feature Integration Test (Priority: P1)

**Scenario**: Family Creation → Group Setup → Schedule Management (end-to-end)

**Coverage gap**: No test validates the complete user journey from family creation
through group creation to schedule assignment. Individual features are tested
in isolation but the cross-feature data flow is not validated.

**Proposed approach**:
- Write from scratch using modern patterns (setupAdminUser, real magic link, UI navigation)
- Single test with test.step() phases
- Use real data creation via UI (no database manipulation)
- Validate data propagation across features (child created in family appears in schedule)

**Estimated effort**: Medium (~300-400 lines)

**Trigger**: When schedule E2E tests are stabilized and running reliably
