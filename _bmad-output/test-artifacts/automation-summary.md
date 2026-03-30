---
stepsCompleted: ['step-01-preflight-and-context', 'step-02-identify-targets', 'step-03-generate-migrate-tests']
lastStep: 'step-03-generate-migrate-tests'
lastSaved: '2026-03-29'
---

# Test Automation Summary - EduLift Group E2E Tests

## Context

- **Objective**: Migrate existing group E2E tests to follow auth/family patterns (real auth via magic link, no DB manipulation)
- **Stack**: Frontend E2E (Playwright, React/TypeScript)
- **Framework**: Playwright with `@playwright/test`
- **Mode**: Standalone (no BMad artifacts, source code only)
- **Config**: tea_use_playwright_utils=true, tea_browser_automation=auto

## Execution Mode

**Standalone** - Existing test files in `e2e/tests/group/` need migration to use correct authentication patterns.

## Coverage Plan

### Existing Test Files (6 files)

| File | Original Lines | Migrated Lines | Status | Action |
|------|---------------|----------------|--------|--------|
| 01-group-creation.spec.ts | 447 | ~230 | Migrated | Auth migrated, expectations fixed |
| 02-group-invitations.spec.ts | 457 | ~170 | Migrated | Auth migrated, re-enabled, speculative removed |
| 03-group-scheduling.spec.ts | 575 | ~200 | Migrated | Auth migrated, speculative removed |
| 04-group-coordination.spec.ts | 720 | ~210 | Migrated | Auth migrated, speculative removed |
| 05-group-lifecycle.spec.ts | 860 | ~220 | Migrated | Auth migrated, speculative removed |
| 05-group-schedule-configuration.spec.ts | 532 | ~280 | Migrated | Auth migrated (best structured) |

### Anti-Patterns to Fix (all files)

1. Replace `createUsersInDatabase()` + `createFamilyInDatabase()` + `directUserSetup()` with real magic link auth
2. Add `E2EEmailHelper`, `TestCleanupHelper`, `SharedTestPatterns`, `OnboardingFlowHelper`
3. Add `test.beforeEach` for email cleanup
4. Replace text-based selectors with `data-testid`
5. Remove logical OR in expectations

### Existing Frontend Features (confirmed via source analysis)

**Pages:**
- `/groups` - GroupsPage (listing)
- `/groups/:groupId/manage` - ManageGroupPage
- `/groups/join` - UnifiedGroupInvitationPage

**Components with data-testid:**
- GroupsPage, GroupCard, CreateGroupModal, ManageGroupPage
- GroupScheduleConfigModal, JoinGroupModal, FamilySearchInvitation
- UnifiedGroupInvitationPage

**API Endpoints:**
- GET /api/v1/groups/my-groups
- POST /api/v1/groups
- PATCH /api/v1/groups/{groupId}
- DELETE /api/v1/groups/{groupId}
- POST /api/v1/groups/join
- POST /api/v1/groups/{groupId}/leave
- GET/PATCH /api/v1/groups/{groupId}/families
- GET/PATCH /api/v1/groups/{groupId}/schedule-config
- POST /api/v1/groups/{groupId}/search-families
- POST /api/v1/groups/{groupId}/invite

### Features to Test (prioritized)

**P0 - Critical:**
- Group creation via CreateGroupModal
- Group listing on GroupsPage
- Group management page access

**P1 - High:**
- Edit group name/description (admin only)
- Invite families via FamilySearchInvitation
- Schedule configuration via GroupScheduleConfigModal
- Join group via invite code
- Role-based permissions (admin vs member)
- Leave group

**P2 - Medium:**
- Delete group (admin only)
- Form validation

### Features NOT in App (remove from tests)

- Analytics/Statistics/Reports
- Cost sharing/Expense tracking
- Calendar export/integration
- Emergency coordination
- Announcements/Notifications
- Private messaging
- Real-time updates
- Activity log
- Archive group
- Admin transfer
- Data export
- Optimization suggestions

### Migration Order

1. 01-group-creation.spec.ts
2. 05-group-schedule-configuration.spec.ts
3. 02-group-invitations.spec.ts (re-enable)
4. 05-group-lifecycle.spec.ts (clean up)
5. 03-group-scheduling.spec.ts (clean up)
6. 04-group-coordination.spec.ts (clean up)
