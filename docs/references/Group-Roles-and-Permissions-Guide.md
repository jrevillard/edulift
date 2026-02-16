# Group Roles and Permissions - Complete Guide

## Overview

This guide provides comprehensive documentation of group roles, permissions, and critical constraints in the EduLift system. Groups support three family-level roles: OWNER, ADMIN, and MEMBER, each with distinct permissions and important limitations.

## Table of Contents

1. [Role Definitions](#role-definitions)
2. [Permission Matrix](#permission-matrix)
3. [OWNER Role Constraints](#owner-role-constraints)
4. [Two-Level Permission System](#two-level-permission-system)
5. [Real-World Examples](#real-world-examples)
6. [API Endpoints](#api-endpoints)
7. [Error Handling](#error-handling)
8. [Implementation Details](#implementation-details)
9. [Migration Notes](#migration-notes)

---

## Role Definitions

### OWNER Role

**Definition**: The family that created the group. This is a **permanent role** with exclusive permissions.

**How Assigned**: Automatically assigned to the family that creates the group

**Key Characteristics**:
- ✅ Can delete the entire group (if user is also family admin)
- ✅ Full administrative permissions (invite, manage schedules, promote admins)
- ⚠️ **Cannot leave the group**
- ⚠️ **Cannot be removed by other admins**
- ⚠️ **Cannot have role changed to ADMIN or MEMBER**
- ⚠️ **No ownership transfer feature exists**

### ADMIN Role

**Definition**: Families promoted by OWNER or ADMIN families to help manage the group.

**How Assigned**: Promoted by OWNER or ADMIN families using role change functionality

**Key Characteristics**:
- ✅ Can invite new families to the group
- ✅ Can manage group schedules and assignments
- ✅ Can promote other families to ADMIN role
- ✅ Can remove ADMIN and MEMBER families from group
- ✅ Can leave the group (unlike OWNER)
- ❌ **Cannot delete the group** (OWNER-only permission)
- ❌ **Cannot be promoted to OWNER** (no transfer ownership feature)

### MEMBER Role

**Definition**: Regular participating families with default permissions upon joining.

**How Assigned**: Default role when families join a group

**Key Characteristics**:
- ✅ Can view group information and schedules
- ✅ Can assign their own family's children to trips
- ✅ Can assign their own family's vehicles to trips
- ✅ Can leave the group
- ❌ **Cannot invite other families**
- ❌ **Cannot manage schedules**
- ❌ **Cannot assign other families' resources**

---

## Permission Matrix

### Group Management Permissions

| Action | OWNER | ADMIN | MEMBER | Notes |
|--------|-------|-------|---------|-------|
| View group information | ✅ | ✅ | ✅ | All members can view |
| Edit group name/settings | ✅ | ✅ | ❌ | Requires family admin + group OWNER/ADMIN |
| Delete group | ✅ | ❌ | ❌ | Requires family admin + group OWNER (both conditions) |
| Generate invite codes | ✅ | ✅ | ❌ | Requires family admin + group OWNER/ADMIN |
| Leave group | ❌ | ✅ | ✅ | **OWNER cannot leave** |

### Family Management Permissions

| Action | OWNER | ADMIN | MEMBER | Notes |
|--------|-------|-------|---------|-------|
| View participating families | ✅ | ✅ | ✅ | All members can view |
| Invite new families | ✅ | ✅ | ❌ | Requires family admin + group OWNER/ADMIN |
| Promote to ADMIN | ✅ | ✅ | ❌ | Can promote MEMBER → ADMIN (not OWNER) |
| Demote to MEMBER | ✅ | ✅ | ❌ | Can demote ADMIN → MEMBER (not OWNER) |
| Remove families | ✅ | ✅ | ❌ | Cannot remove OWNER family |

### Schedule Management Permissions

| Action | OWNER | ADMIN | MEMBER | Notes |
|--------|-------|-------|---------|-------|
| View schedules | ✅ | ✅ | ✅ | All members can view |
| Create schedule slots | ✅ | ✅ | ❌ | Requires family admin + group OWNER/ADMIN |
| Edit schedule slots | ✅ | ✅ | ❌ | Requires family admin + group OWNER/ADMIN |
| Delete schedule slots | ✅ | ✅ | ❌ | Requires family admin + group OWNER/ADMIN |

### Resource Assignment Permissions

| Action | OWNER | ADMIN | MEMBER | Notes |
|--------|-------|-------|---------|-------|
| View child/vehicle assignments | ✅ | ✅ | ✅ | All members can view |
| Assign own family children | ✅ | ✅ | ✅ | Any family member (requires family admin) |
| Assign own family vehicles | ✅ | ✅ | ✅ | Any family member (requires family admin) |
| Assign other families' children | ✅ | ✅ | ❌ | Requires family admin + group OWNER/ADMIN |
| Assign other families' vehicles | ✅ | ✅ | ❌ | Requires family admin + group OWNER/ADMIN |
| Remove own family assignments | ✅ | ✅ | ✅ | Any family member can remove |
| Remove other families' assignments | ✅ | ✅ | ❌ | Requires family admin + group OWNER/ADMIN |

---

## OWNER Role Constraints

### Permanent Role Characteristics

The OWNER role is **permanent and cannot be transferred**:

1. **Cannot Leave Group**
   - OWNER family members cannot use "leave group" functionality
   - Attempting to leave results in error: "Cannot remove group owner family"
   - Only option is to delete the entire group

2. **Cannot Be Removed**
   - Other admins (even ADMINs) cannot remove OWNER family from group
   - Service layer blocks this operation explicitly
   - Error: "Cannot remove group owner family"

3. **Cannot Change Role**
   - OWNER role cannot be demoted to ADMIN or MEMBER
   - No API endpoint supports role changes for OWNER family
   - Error: "Cannot change the role of the owner family"

4. **No Ownership Transfer**
   - **No feature exists** to transfer ownership to another family
   - ADMIN families cannot be promoted to OWNER
   - This is a **permanent designation**

### Deleting a Group

**Requirements (BOTH must be true):**

1. **User must be ADMIN in their family** (family-level permission)
2. **User's family must be OWNER of the group** (group-level permission)

**Permission Flow:**
```typescript
// Both conditions checked in GroupService.deleteGroup()
const ownerFamilyId = group.familyMembers.find(fm => fm.role === 'OWNER')?.familyId;
const isOwnerAdmin = await this.isFamilyAdmin(requesterId, ownerFamilyId);
if (!isOwnerAdmin) {
  throw new AppError('Only administrators of the owner family can delete the group', 403);
}
```

**Examples:**

| User | Family Role in Group | Family Admin Status | Can Delete Group? |
|------|---------------------|---------------------|-------------------|
| John Smith | OWNER | ✅ Yes | ✅ **Yes** |
| Sarah Smith | OWNER | ❌ No | ❌ No |
| Mike Jones | ADMIN | ✅ Yes | ❌ No |
| Lisa Jones | MEMBER | ✅ Yes | ❌ No |

### Multiple OWNERS

**Technical Possibility:**
- The system **does not validate** against multiple OWNER families
- Multiple families with role='OWNER' is **technically possible**
- This could occur via database operations or future features

**Implications:**
- Each OWNER family would have delete permissions
- Each OWNER family admin user could delete the group
- All OWNER families would be protected from removal/role changes

**Recommendation:**
- Maintain **single OWNER** per group
- Future migrations may add validation to enforce this
- Current implementation allows but does not encourage multiple OWNERS

---

## Two-Level Permission System

### Understanding Effective Permissions

A user's effective permissions in a group are determined by **combining two levels**:

1. **User's role in their family** (ADMIN or MEMBER)
2. **Family's role in the group** (OWNER, ADMIN, or MEMBER)

### The Golden Rule

**For administrative actions in a group, BOTH conditions must be true:**

1. ✅ User must be **ADMIN in their family**
2. ✅ User's family must have **OWNER or ADMIN role in the group**

### Permission Matrix

| User's Role in Family | Family's Role in Group | Effective Permissions | Can Invite? | Can Manage Schedules? | Can Delete Group? |
|----------------------|------------------------|------------------------|------------|----------------------|-------------------|
| **ADMIN** | **OWNER** | Group Administrator | ✅ Yes | ✅ Yes | ✅ Yes |
| **ADMIN** | **ADMIN** | Group Administrator | ✅ Yes | ✅ Yes | ❌ No |
| **ADMIN** | **MEMBER** | Group Member | ❌ No | ❌ No | ❌ No |
| **MEMBER** | **OWNER** | Group Member | ❌ No | ❌ No | ❌ No |
| **MEMBER** | **ADMIN** | Group Member | ❌ No | ❌ No | ❌ No |
| **MEMBER** | **MEMBER** | Group Member | ❌ No | ❌ No | ❌ No |

### Key Insights

1. **Family Admin is Prerequisite**
   - Being an ADMIN in your family is required for ANY group admin actions
   - Family MEMBERS never have group admin permissions (even if their family owns the group)

2. **Family's Group Role Determines Scope**
   - OWNER family: Full permissions including delete (if family admin)
   - ADMIN family: Full admin permissions except delete
   - MEMBER family: View-only + assign own resources

3. **Resource Assignment Works Differently**
   - Any family member can assign **their own family's** resources (if family admin)
   - Group admin permissions only needed to assign **other families'** resources

---

## Real-World Examples

### Example 1: Smith Family Creates a Carpool Group

**Setup:**
- Smith family creates "Morning School Run" group
- John Smith: ADMIN in Smith family
- Sarah Smith: MEMBER in Smith family

**Result:**
- Smith family is OWNER of the group
- John can: ✅ Invite families, manage schedules, delete group
- Sarah can: ✅ View schedules, assign Smith children, ❌ Invite families, ❌ Delete group

### Example 2: Jones Family Joins as MEMBER

**Setup:**
- Jones family joins "Morning School Run" group
- Mike Jones: ADMIN in Jones family
- Lisa Jones: MEMBER in Jones family

**Result:**
- Jones family is MEMBER of the group
- Mike can: ✅ View schedules, assign Jones children, ❌ Invite families, ❌ Manage schedules
- Lisa can: ✅ View schedules, ❌ Assign Jones children (not family admin), ❌ Invite families

### Example 3: Jones Family Promoted to ADMIN

**Setup:**
- John Smith (OWNER admin) promotes Jones family to ADMIN role

**Result:**
- Jones family is now ADMIN of the group
- Mike can: ✅ Invite families, ✅ Manage schedules, ✅ Assign other families' children, ❌ Delete group
- Lisa can: ✅ View schedules, ❌ Invite families (not family admin)

### Example 4: Attempting to Remove OWNER Family

**Scenario:**
- Mike Jones (ADMIN) tries to remove Smith family (OWNER) from group

**Result:**
```json
{
  "success": false,
  "error": "Cannot remove group owner family"
}
```

**Explanation:**
- OWNER family is protected from removal
- Only option for OWNER family is to delete the entire group

### Example 5: Deleting a Group

**Successful Deletion:**
- User: John Smith (ADMIN in Smith family)
- Smith family: OWNER of "Morning School Run" group
- Action: Delete group
- Result: ✅ **Success** - Group deleted

**Failed Deletion (Not Family Admin):**
- User: Sarah Smith (MEMBER in Smith family)
- Smith family: OWNER of "Morning School Run" group
- Action: Delete group
- Result: ❌ **Error** - "Only administrators of the owner family can delete the group"

**Failed Deletion (Not OWNER Family):**
- User: Mike Jones (ADMIN in Jones family)
- Jones family: ADMIN of "Morning School Run" group
- Action: Delete group
- Result: ❌ **Error** - "Only administrators of the owner family can delete the group"

---

## API Endpoints

### Group Management

#### Create Group
```http
POST /api/v1/groups
```

**Requirements:**
- User must be ADMIN in their family
- Family becomes OWNER of the new group

**Request:**
```json
{
  "name": "Morning School Run",
  "description": "Carpool for school dropoffs"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "group-123",
    "name": "Morning School Run",
    "ownerFamilyId": "family-456"
  }
}
```

#### Edit Group
```http
PATCH /api/v1/groups/:groupId
```

**Requirements:**
- User must be ADMIN in their family
- User's family must be OWNER or ADMIN in group

#### Delete Group
```http
DELETE /api/v1/groups/:groupId
```

**Requirements:**
- User must be ADMIN in their family
- User's family must be **OWNER** in the group
- **Both conditions required**

**Error Response:**
```json
{
  "success": false,
  "error": "Only administrators of the owner family can delete the group"
}
```

### Family Management

#### Invite Family to Group
```http
POST /api/v1/groups/:groupId/invite
```

**Requirements:**
- User must be ADMIN in their family
- User's family must be OWNER or ADMIN in group

#### Update Family Role
```http
PATCH /api/v1/groups/:groupId/families/:familyId
```

**Requirements:**
- User must be ADMIN in their family
- User's family must be OWNER or ADMIN in group
- **Cannot change OWNER family's role**

**Error Response (Attempting to Change OWNER):**
```json
{
  "success": false,
  "error": "Cannot change the role of the owner family"
}
```

#### Remove Family from Group
```http
DELETE /api/v1/groups/:groupId/families/:familyId
```

**Requirements:**
- User must be ADMIN in their family
- User's family must be OWNER or ADMIN in group
- **Cannot remove OWNER family**

**Error Response (Attempting to Remove OWNER):**
```json
{
  "success": false,
  "error": "Cannot remove group owner family"
}
```

---

## Error Handling

### Common Error Codes

| Error Code | HTTP Status | Message | Cause |
|------------|-------------|---------|-------|
| `INSUFFICIENT_FAMILY_PERMISSIONS` | 403 | "You don't have permission to perform this action in your family" | User is not family admin |
| `INSUFFICIENT_GROUP_PERMISSIONS` | 403 | "You don't have permission to manage this group feature" | Family's group role insufficient |
| `CANNOT_MODIFY_OWNER_FAMILY` | 400 | "Cannot modify or remove the group owner family" | Attempting to modify OWNER family |
| `CANNOT_REMOVE_OWNER_FAMILY` | 400 | "Cannot remove the group owner family from the group" | Attempting to remove OWNER family |
| `CANNOT_CHANGE_OWNER_ROLE` | 400 | "Cannot change the role of the owner family" | Attempting to change OWNER role |
| `NOT_FAMILY_ADMIN` | 403 | "Only family administrators can perform this action" | User is not family admin |
| `FAMILY_NOT_IN_GROUP` | 404 | "Family is not a member of this group" | Target family not in group |

### User-Friendly Error Messages

#### Insufficient Permissions
```json
{
  "success": false,
  "error": "INSUFFICIENT_GROUP_PERMISSIONS",
  "message": "You don't have permission to manage this group feature.",
  "suggestion": "Contact the group owner or administrator for assistance."
}
```

#### Attempting to Remove OWNER
```json
{
  "success": false,
  "error": "CANNOT_REMOVE_OWNER_FAMILY",
  "message": "Cannot remove the group owner family from the group.",
  "suggestion": "The owner family must delete the entire group instead."
}
```

#### Not Family Admin
```json
{
  "success": false,
  "error": "NOT_FAMILY_ADMIN",
  "message": "Only family administrators can perform this action.",
  "suggestion": "Contact your family administrator for assistance."
}
```

---

## Implementation Details

### Database Schema

**Group Members Table (Normalized Ownership):**
```sql
CREATE TABLE group_family_members (
  family_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'MEMBER', -- 'OWNER' | 'ADMIN' | 'MEMBER'
  added_by TEXT NOT NULL,
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (family_id, group_id),
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE,
  FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
);

-- OWNER family is stored in this table with role='OWNER'
-- Previously used groups.family_id (now deprecated)
```

### Service Layer Protections

**Remove Family Protection:**
```typescript
// In GroupService.removeFamilyFromGroup()
async removeFamilyFromGroup(groupId: string, targetFamilyId: string, requesterId: string) {
  // Check permissions
  const hasAdminPermissions = await this.hasGroupAdminPermissions(requesterId, groupId);
  if (!hasAdminPermissions) {
    throw new AppError('Only group administrators can remove families', 403);
  }

  // Get current membership
  const currentMembership = await this.prisma.groupFamilyMember.findUnique({
    where: {
      familyId_groupId: { familyId: targetFamilyId, groupId }
    }
  });

  // PROTECT OWNER FAMILY
  if (currentMembership?.role === 'OWNER') {
    throw new AppError('Cannot remove group owner family', 400);
  }

  // Proceed with removal...
}
```

**Delete Group Protection:**
```typescript
// In GroupService.deleteGroup()
async deleteGroup(groupId: string, requesterId: string) {
  // Find group with OWNER membership
  const group = await this.prisma.group.findUnique({
    where: { id: groupId },
    include: {
      familyMembers: {
        where: { role: 'OWNER' }
      }
    }
  });

  // Extract OWNER family ID
  const ownerFamilyId = group.familyMembers[0].familyId;

  // Verify user is admin in OWNER family
  const isOwnerAdmin = await this.isFamilyAdmin(requesterId, ownerFamilyId);
  if (!isOwnerAdmin) {
    throw new AppError('Only administrators of the owner family can delete the group', 403);
  }

  // Proceed with deletion...
}
```

**Update Family Role Protection:**
```typescript
// In GroupService.updateFamilyRole()
async updateFamilyRole(groupId: string, targetFamilyId: string, newRole: string, requesterId: string) {
  // Get current membership
  const currentMembership = await this.prisma.groupFamilyMember.findUnique({
    where: {
      familyId_groupId: { familyId: targetFamilyId, groupId }
    }
  });

  // PROTECT OWNER ROLE
  if (currentMembership?.role === 'OWNER') {
    throw new AppError('Cannot change the role of the owner family', 400);
  }

  // Proceed with role update...
}
```

---

## Migration Notes

### From Legacy System

**Previous Architecture:**
- Groups had a `family_id` column directly on the `groups` table
- OWNER family was identified via `groups.family_id`
- OWNER family was NOT in `group_family_members` table

**Current Architecture:**
- `groups.family_id` is **deprecated** (kept for backward compatibility)
- OWNER family is now in `group_family_members` with `role='OWNER'`
- All families (including OWNER) are tracked in the same table

**Migration Benefits:**
1. **Normalized data model**: All group memberships in one table
2. **Simplified queries**: No need to check separate `groups.family_id` column
3. **Consistent permissions**: All families use same role system
4. **Future-proof**: Easy to add new roles or permissions

**Migration SQL:**
```sql
-- Step 1: Add OWNER family to group_family_members
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

-- Step 2: Drop groups.family_id (optional - may keep for backward compatibility)
-- ALTER TABLE groups DROP COLUMN family_id;
```

### Code Changes Required

**Before (Legacy):**
```typescript
// Find owner family from groups.family_id
const group = await prisma.group.findUnique({
  where: { id: groupId },
  select: { familyId: true }
});
const ownerFamilyId = group.familyId;
```

**After (Current):**
```typescript
// Find owner family from group_family_members with role='OWNER'
const ownerMembership = await prisma.groupFamilyMember.findFirst({
  where: {
    groupId: groupId,
    role: 'OWNER'
  },
  select: { familyId: true }
});
const ownerFamilyId = ownerMembership.familyId;
```

---

## Best Practices

### For Developers

1. **Always Check Both Permission Levels**
   - Verify user is family admin
   - Verify family has appropriate group role
   - Use `hasGroupAdminPermissions()` helper

2. **Protect OWNER Role**
   - Always check if target family is OWNER before role changes
   - Always check if target family is OWNER before removal
   - Return clear error messages explaining constraint

3. **Test OWNER Constraints**
   - Test attempting to remove OWNER family
   - Test attempting to change OWNER role
   - Test delete group with non-owner admin
   - Test delete group with non-admin owner family member

4. **Clear Error Messages**
   - Explain WHY action failed (not just "access denied")
   - Suggest alternative actions when possible
   - Include context about OWNER role constraints

### For Users

1. **Group Creation**
   - Only family admins can create groups
   - Creating family automatically becomes OWNER
   - OWNER role is permanent - choose carefully

2. **Managing Groups**
   - Promote trusted families to ADMIN role
   - Don't promote to OWNER (not possible anyway)
   - Remember OWNER cannot leave group

3. **Deleting Groups**
   - Only OWNER family admins can delete
   - Make sure you're both: family admin + in OWNER family
   - Consider informing other members before deletion

---

## Related Documentation

- **[Access Control and Permissions](./Access-Control-and-Permissions.md)** - Complete ACL system documentation including family permissions
- **[Architecture - Family vs Groups](./Architecture-Family-vs-Groups.md)** - System architecture and data model
- **[API Documentation](../API-Documentation.md)** - Full API reference for all endpoints

---

## FAQ

**Q: Can I transfer ownership of a group to another family?**
A: No. There is currently no ownership transfer feature. The OWNER role is permanent and cannot be transferred.

**Q: Can the OWNER family leave the group?**
A: No. The OWNER family cannot leave the group. The only option is to delete the entire group.

**Q: Can a family have more than one OWNER?**
A: Technically yes (not validated), but it's not recommended. The system allows multiple families with role='OWNER' but this should be avoided.

**Q: What happens if the only admin in the OWNER family leaves the family?**
A: The group would have no one who can delete it. This is why families should always have at least one admin.

**Q: Can I demote the OWNER family to ADMIN?**
A: No. The OWNER role cannot be changed to ADMIN or MEMBER.

**Q: Who can invite families to a group?**
A: Users who are: 1) ADMIN in their family, AND 2) Their family is OWNER or ADMIN in the group.

**Q: Can a MEMBER family admin manage schedules?**
A: No. Even if you're a family admin, if your family is only a MEMBER of the group, you cannot manage group schedules.

---

## Conclusion

The group role system (OWNER/ADMIN/MEMBER) provides a flexible permission model with important constraints:

- **OWNER**: Full permissions including delete, but permanent and protected
- **ADMIN**: Administrative permissions for day-to-day management
- **MEMBER**: View-only access with ability to assign own family resources

Understanding the two-level permission system (family role + group role) is critical for implementing group features correctly. The OWNER role's permanent nature ensures group stability while allowing for flexible collaboration through ADMIN and MEMBER roles.
