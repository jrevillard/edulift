# Migration Guide: Normalized Group Ownership

## Overview

This document describes the migration from the legacy group ownership model (using `groups.family_id`) to the normalized ownership model (using `group_family_members` with `role='OWNER'`).

**Migration Date**: February 15, 2025
**Status**: ✅ COMPLETED and in production

---

## Table of Contents

1. [Motivation](#motivation)
2. [Architecture Changes](#architecture-changes)
3. [Database Migration](#database-migration)
4. [Code Changes](#code-changes)
5. [Testing Strategy](#testing-strategy)
6. [Rollback Plan](#rollback-plan)
7. [Post-Migration Cleanup](#post-migration-cleanup)

---

## Motivation

### Problems with Legacy Model

**Previous Architecture:**
```sql
groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  family_id TEXT NOT NULL,  -- Owner family stored directly on group
  FOREIGN KEY (family_id) REFERENCES families(id)
);

group_family_members (
  family_id TEXT,
  group_id TEXT,
  role TEXT DEFAULT 'MEMBER', -- Only ADMIN | MEMBER (OWNER not in this table)
  PRIMARY KEY (family_id, group_id)
);
```

**Issues:**
1. **Inconsistent membership tracking**: OWNER family not in `group_family_members` table
2. **Complex permission checks**: Need to check both `groups.family_id` AND `group_family_members`
3. **Difficult queries**: Separate handling for OWNER vs other families
4. **Normalization violation**: Redundant ownership data in `groups` table

### Benefits of Normalized Model

**New Architecture:**
```sql
groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  family_id TEXT,  -- DEPRECATED (kept for backward compatibility)
  -- No direct ownership reference
);

group_family_members (
  family_id TEXT,
  group_id TEXT,
  role TEXT DEFAULT 'MEMBER', -- Now includes 'OWNER' | 'ADMIN' | 'MEMBER'
  PRIMARY KEY (family_id, group_id)
);
```

**Benefits:**
1. **Single source of truth**: All group memberships in one table
2. **Simplified queries**: No special handling for OWNER family
3. **Consistent role system**: All families use same role-based permissions
4. **Easier to extend**: Simple to add new roles or permissions

---

## Architecture Changes

### Data Model Changes

#### Before (Legacy)
```
Group Ownership:
├── groups.family_id → OWNER family
└── group_family_members → ADMIN and MEMBER families only

Permission Check:
1. Check if user's family matches groups.family_id (OWNER)
2. OR check group_family_members for ADMIN role
```

#### After (Current)
```
Group Ownership:
└── group_family_members.role = 'OWNER' → OWNER family
   (all families including OWNER in same table)

Permission Check:
1. Check group_family_members for OWNER, ADMIN, or MEMBER role
2. Single query, consistent logic
```

### Service Layer Changes

#### Finding Owner Family

**Before:**
```typescript
const group = await prisma.group.findUnique({
  where: { id: groupId },
  select: { familyId: true }
});
const ownerFamilyId = group.familyId;
```

**After:**
```typescript
const ownerMembership = await prisma.groupFamilyMember.findFirst({
  where: {
    groupId: groupId,
    role: 'OWNER'
  },
  select: { familyId: true }
});
const ownerFamilyId = ownerMembership.familyId;
```

#### Checking Group Admin Permissions

**Before:**
```typescript
async hasGroupAdminPermissions(userId: string, groupId: string): Promise<boolean> {
  const userFamily = await getUserFamily(userId);

  // Check if owner family
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { familyId: true }
  });

  if (group.familyId === userFamily.id) {
    // User is in owner family
    return await this.isFamilyAdmin(userId, userFamily.id);
  }

  // Check group_family_members for ADMIN role
  const membership = await prisma.groupFamilyMember.findUnique({
    where: {
      familyId_groupId: {
        familyId: userFamily.id,
        groupId: groupId
      }
    }
  });

  return membership?.role === 'ADMIN' && await this.isFamilyAdmin(userId, userFamily.id);
}
```

**After:**
```typescript
async hasGroupAdminPermissions(userId: string, groupId: string): Promise<boolean> {
  const userFamily = await getUserFamily(userId);
  const userIsFamilyAdmin = await this.isFamilyAdmin(userId, userFamily.id);

  // Single query for all roles
  const familyMembership = await prisma.groupFamilyMember.findUnique({
    where: {
      familyId_groupId: {
        familyId: userFamily.id,
        groupId: groupId
      }
    },
    select: { role: true }
  });

  // Check both: user's family role in group + user's role in family
  return userIsFamilyAdmin &&
         ['OWNER', 'ADMIN'].includes(familyMembership?.role || '');
}
```

---

## Database Migration

### Migration SQL

```sql
-- ============================================================
-- Migration: Normalized Group Ownership
-- Date: 2025-02-15
-- Description: Move OWNER family from groups.family_id to
--              group_family_members with role='OWNER'
-- ============================================================

-- Step 1: Add OWNER families to group_family_members
INSERT INTO group_family_members (family_id, group_id, role, added_by, joined_at)
SELECT
  g.family_id,
  g.id as group_id,
  'OWNER' as role,
  'SYSTEM' as added_by,
  g.created_at as joined_at
FROM groups g
WHERE g.family_id IS NOT NULL
ON CONFLICT (family_id, group_id) DO NOTHING;

-- Step 2: Verify data integrity
-- Check that all groups have an OWNER family
SELECT g.id, g.name
FROM groups g
LEFT JOIN group_family_members gfm ON g.id = gfm.group_id AND gfm.role = 'OWNER'
WHERE g.family_id IS NOT NULL AND gfm.family_id IS NULL;

-- Expected: 0 rows (all groups should have OWNER in group_family_members)

-- Step 3: Create backup of groups.family_id (optional)
ALTER TABLE groups RENAME COLUMN family_id TO family_id_deprecated;

-- Note: We keep the column (not dropped) for backward compatibility
-- during the transition period. Can be dropped in future migration.

-- Step 4: Update application code to use group_family_members
-- (See "Code Changes" section below)

-- Step 5: Verification queries
-- Check total groups
SELECT COUNT(*) as total_groups FROM groups;

-- Check groups with OWNER in group_family_members
SELECT COUNT(*) as groups_with_owner
FROM groups g
INNER JOIN group_family_members gfm ON g.id = gfm.group_id AND gfm.role = 'OWNER';

-- Both counts should match
```

### Rollback SQL

```sql
-- ============================================================
-- Rollback: Revert to legacy group ownership
-- Date: 2025-02-15
-- Description: Move OWNER family back to groups.family_id
-- ============================================================

-- Step 1: Restore groups.family_id from group_family_members
UPDATE groups
SET family_id = (
  SELECT gfm.family_id
  FROM group_family_members gfm
  WHERE gfm.group_id = groups.id
    AND gfm.role = 'OWNER'
  LIMIT 1
)
WHERE family_id IS NULL;

-- Step 2: Remove OWNER families from group_family_members
DELETE FROM group_family_members
WHERE role = 'OWNER';

-- Step 3: Verify rollback
-- Check that all groups have family_id
SELECT COUNT(*) as groups_without_owner
FROM groups
WHERE family_id IS NULL;

-- Expected: 0 rows
```

---

## Code Changes

### Files Modified

1. **`src/services/GroupService.ts`**
   - Updated `deleteGroup()` to find owner via `group_family_members`
   - Updated `hasGroupAdminPermissions()` to query single table
   - Added OWNER role checks in `removeFamilyFromGroup()`
   - Added OWNER role checks in `updateFamilyRole()`

2. **`src/repositories/ActivityLogRepository.ts`**
   - Updated group membership queries to include OWNER role

3. **`src/services/UnifiedInvitationService.ts`**
   - Updated to use normalized ownership model

4. **`src/schemas/groups.ts`**
   - Updated response schemas to include OWNER in `familyMembers` array

5. **`src/controllers/v1/GroupController.ts`**
   - Updated responses to include OWNER family in `familyMembers`

### Code Examples

#### Example 1: Getting Group with Owner

**Before:**
```typescript
const group = await prisma.group.findUnique({
  where: { id: groupId },
  include: {
    familyMembers: {
      where: { role: { in: ['ADMIN', 'MEMBER'] } }
    }
  }
});
// Owner family accessed via group.familyId
const ownerFamilyId = group.familyId;
```

**After:**
```typescript
const group = await prisma.group.findUnique({
  where: { id: groupId },
  include: {
    familyMembers: {
      // Now includes OWNER, ADMIN, MEMBER
      where: { role: { in: ['OWNER', 'ADMIN', 'MEMBER'] } }
    }
  }
});
// Owner family found in familyMembers array
const ownerMembership = group.familyMembers.find(fm => fm.role === 'OWNER');
const ownerFamilyId = ownerMembership.familyId;
```

#### Example 2: Checking Delete Permissions

**Before:**
```typescript
async deleteGroup(groupId: string, requesterId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: { familyId: true }
  });

  const ownerFamilyId = group.familyId;
  const isOwnerAdmin = await this.isFamilyAdmin(requesterId, ownerFamilyId);

  if (!isOwnerAdmin) {
    throw new AppError('Only owner family admin can delete group', 403);
  }
  // ... delete logic
}
```

**After:**
```typescript
async deleteGroup(groupId: string, requesterId: string) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: {
      familyMembers: {
        where: { role: 'OWNER' }
      }
    }
  });

  if (!group || group.familyMembers.length === 0) {
    throw new AppError('Group not found', 404);
  }

  const ownerFamilyId = group.familyMembers[0].familyId;
  const isOwnerAdmin = await this.isFamilyAdmin(requesterId, ownerFamilyId);

  if (!isOwnerAdmin) {
    throw new AppError('Only administrators of the owner family can delete the group', 403);
  }
  // ... delete logic
}
```

#### Example 3: Protecting OWNER Family

**New code added:**
```typescript
async removeFamilyFromGroup(groupId: string, targetFamilyId: string, requesterId: string) {
  // ... permission checks

  const currentMembership = await prisma.groupFamilyMember.findUnique({
    where: {
      familyId_groupId: {
        familyId: targetFamilyId,
        groupId
      }
    }
  });

  // NEW: Protect OWNER family from removal
  if (currentMembership?.role === 'OWNER') {
    throw new AppError('Cannot remove group owner family', 400);
  }

  // ... removal logic
}
```

---

## Testing Strategy

### Unit Tests

**Test Coverage Required:**
1. ✅ `hasGroupAdminPermissions()` with OWNER family
2. ✅ `hasGroupAdminPermissions()` with ADMIN family
3. ✅ `hasGroupAdminPermissions()` with MEMBER family
4. ✅ `deleteGroup()` by OWNER family admin
5. ✅ `deleteGroup()` by non-owner admin (should fail)
6. ✅ `deleteGroup()` by OWNER family member (should fail)
7. ✅ `removeFamilyFromGroup()` attempting to remove OWNER (should fail)
8. ✅ `updateFamilyRole()` attempting to change OWNER role (should fail)

**Example Test:**
```typescript
describe('GroupService - Normalized Ownership', () => {
  it('should allow OWNER family admin to delete group', async () => {
    const group = await createTestGroup();
    const ownerAdmin = await createOwnerFamilyAdmin(group.id);

    await expect(groupService.deleteGroup(group.id, ownerAdmin.id))
      .resolves.toBeDefined();
  });

  it('should prevent non-OWNER from deleting group', async () => {
    const group = await createTestGroup();
    const adminUser = await createAdminUserInGroup(group.id);

    await expect(groupService.deleteGroup(group.id, adminUser.id))
      .rejects.toThrow('Only administrators of the owner family can delete the group');
  });

  it('should prevent removal of OWNER family', async () => {
    const group = await createTestGroup();
    const ownerFamilyId = await getOwnerFamilyId(group.id);
    const adminUser = await createAdminUserInGroup(group.id);

    await expect(groupService.removeFamilyFromGroup(group.id, ownerFamilyId, adminUser.id))
      .rejects.toThrow('Cannot remove group owner family');
  });
});
```

### Integration Tests

**End-to-End Scenarios:**
1. ✅ Create group → OWNER family appears in `group_family_members` with role='OWNER'
2. ✅ Delete group by OWNER admin → Success
3. ✅ Delete group by ADMIN admin → Forbidden
4. ✅ Remove OWNER family → Bad request with clear error
5. ✅ Update OWNER family role → Bad request with clear error

### Manual Testing

**Test Checklist:**
- [ ] Create new group and verify OWNER in `group_family_members`
- [ ] Attempt to delete group as OWNER admin (should succeed)
- [ ] Attempt to delete group as OWNER member (should fail)
- [ ] Attempt to delete group as ADMIN of another family (should fail)
- [ ] Attempt to remove OWNER family (should fail with clear error)
- [ ] Attempt to change OWNER family role (should fail with clear error)
- [ ] Verify all existing groups have OWNER in `group_family_members`

---

## Rollback Plan

### Triggers for Rollback

1. **Data Integrity Issues**: Groups without OWNER family in `group_family_members`
2. **Performance Degradation**: Significant slowdown in group queries
3. **Application Errors**: Frequent errors in group operations
4. **User Reports**: Multiple users unable to access/manage groups

### Rollback Procedure

1. **Stop Application Deployment**
   ```bash
   # Stop backend services
   systemctl stop edulift-backend
   ```

2. **Execute Rollback SQL**
   - Run rollback SQL script (see above)
   - Verify `groups.family_id` is restored
   - Verify OWNER removed from `group_family_members`

3. **Revert Code Changes**
   ```bash
   git checkout <pre-migration-commit>
   npm install
   npm run build
   ```

4. **Restart Services**
   ```bash
   systemctl start edulift-backend
   ```

5. **Verify Rollback**
   - Check application logs for errors
   - Test group creation/deletion
   - Test group membership operations
   - Monitor performance metrics

---

## Post-Migration Cleanup

### Phase 1: Verification (Week 1-2)

- [ ] Monitor application logs for group-related errors
- [ ] Verify all groups have OWNER in `group_family_members`
- [ ] Check query performance metrics
- [ ] Review user feedback

### Phase 2: Deprecation (Week 3-4)

- [ ] Update code comments to reference new model
- [ ] Add deprecation notices for `groups.family_id` column
- [ ] Update API documentation
- [ ] Communicate changes to development team

### Phase 3: Cleanup (Week 5-6)

- [ ] Drop `groups.family_id_deprecated` column
   ```sql
   ALTER TABLE groups DROP COLUMN IF EXISTS family_id_deprecated;
   ```

- [ ] Remove legacy code paths
- [ ] Update all references to use `group_family_members`
- [ ] Clean up test fixtures

---

## Migration Checklist

### Pre-Migration

- [ ] Review all code using `groups.family_id`
- [ ] Create comprehensive test suite
- [ ] Prepare rollback plan
- [ ] Schedule maintenance window
- [ ] Communicate with stakeholders

### Migration Execution

- [ ] Backup database
- [ ] Execute migration SQL
- [ ] Verify data integrity
- [ ] Deploy updated code
- [ ] Run smoke tests
- [ ] Monitor application logs

### Post-Migration

- [ ] Verify all group operations working
- [ ] Monitor performance metrics
- [ ] Review error logs
- [ ] Gather user feedback
- [ ] Document any issues

### Cleanup (After 2 weeks)

- [ ] Drop deprecated `groups.family_id` column
- [ ] Remove legacy code paths
- [ ] Update all documentation
- [ ] Archive migration scripts

---

## Lessons Learned

### What Went Well

1. **Comprehensive Testing**: Test suite caught edge cases early
2. **Incremental Approach**: Keeping `groups.family_id` initially allowed easy rollback
3. **Clear Documentation**: Team understood changes quickly

### Challenges Faced

1. **Code Updates**: Many files referenced `groups.family_id`
2. **Test Data**: Had to update test fixtures across multiple suites
3. **Documentation**: Multiple docs referenced old model

### Recommendations

1. **Normalize Early**: Avoid denormalized ownership in future designs
2. **Comprehensive Tests**: Invest in test coverage before refactoring
3. **Incremental Migrations**: Keep old fields during transition period
4. **Clear Communication**: Document changes thoroughly for team

---

## Related Documentation

- **[Group Roles and Permissions Guide](./Group-Roles-and-Permissions-Guide.md)** - Complete guide to group roles and OWNER constraints
- **[Access Control and Permissions](./Access-Control-and-Permissions.md)** - Full ACL system documentation
- **[Architecture - Family vs Groups](./Architecture-Family-vs-Groups.md)** - System architecture details

---

## Conclusion

The migration to normalized group ownership has been completed successfully. The new model provides:

- ✅ **Single source of truth** for group memberships
- ✅ **Simplified permission checks** using consistent role-based system
- ✅ **Better data integrity** with normalized schema
- ✅ **Easier maintenance** with unified membership tracking

The legacy `groups.family_id` field is kept temporarily for backward compatibility but will be removed in a future cleanup phase after verification period.
