# Access Control Lists (ACL) and Permissions

## Overview

The EduLift application implements a comprehensive role-based access control (RBAC) system with two distinct but integrated permission models:

1. **Family-Based Permissions** - Control access to family resources (children, vehicles)
2. **Group-Based Permissions** - Control access to scheduling and coordination features

## Family-Based Access Control

### Family Roles

The family system implements a simplified two-tier role hierarchy:

| Role | Description | Permissions |
|------|-------------|-------------|
| **ADMIN** | Family administrator with full control | All family management capabilities |
| **MEMBER** | Regular family member | Limited access to family resources |

> **Note**: The PARENT role has been deprecated and consolidated into ADMIN for simplified permission management.

### Family Permissions Matrix

| Permission | ADMIN | MEMBER | Description |
|------------|-------|---------|-------------|
| **Family Management** ||||
| `family.view` | ✅ | ✅ | View family information and members |
| `family.edit` | ✅ | ❌ | Edit family name and settings |
| `family.delete` | ✅ | ❌ | Delete the entire family |
| `family.generateInviteCode` | ✅ | ❌ | Generate new family invite codes |
| **Member Management** ||||
| `members.view` | ✅ | ✅ | View all family members |
| `members.invite` | ✅ | ❌ | Invite new members to family |
| `members.editRole` | ✅ | ❌ | Change member roles |
| `members.remove` | ✅ | ❌ | Remove members from family |
| **Resource Management** ||||
| `children.view` | ✅ | ✅ | View all family children |
| `children.create` | ✅ | ❌ | Add new children to family |
| `children.edit` | ✅ | ❌ | Edit child information |
| `children.delete` | ✅ | ❌ | Remove children from family |
| `children.assignToGroups` | ✅ | ❌ | Assign children to groups |
| `vehicles.view` | ✅ | ✅ | View all family vehicles |
| `vehicles.create` | ✅ | ❌ | Add new vehicles to family |
| `vehicles.edit` | ✅ | ❌ | Edit vehicle information |
| `vehicles.delete` | ✅ | ❌ | Remove vehicles from family |
| `vehicles.useInGroups` | ✅ | ❌ | Use vehicles in group scheduling |

## Group-Based Access Control

### Group Roles

Groups use a family-based membership system where families (not individual users) participate in groups:

| Role | Description | How Assigned |
|------|-------------|--------------|
| **OWNER** | Family that created the group | Automatic when family creates group |
| **ADMIN** | Family with administrative privileges | Promoted by OWNER |
| **MEMBER** | Regular participating family | Default when family joins group |

### Group Permissions Matrix

| Permission | OWNER | ADMIN | MEMBER | Description |
|------------|-------|-------|---------|-------------|
| **Group Management** |||||
| `group.view` | ✅ | ✅ | ✅ | View group information |
| `group.edit` | ✅ | ✅ | ❌ | Edit group name and settings |
| `group.delete` | ✅ | ❌ | ❌ | Delete the entire group (OWNER only) |
| `group.generateInviteCode` | ✅ | ✅ | ❌ | Generate new group invite codes |
| **Family Management** |||||
| `families.view` | ✅ | ✅ | ✅ | View participating families |
| `families.invite` | ✅ | ✅ | ❌ | Invite new families to group |
| `families.editRole` | ✅ | ✅ | ❌ | Change family roles in group |
| `families.remove` | ✅ | ✅ | ❌ | Remove families from group |
| **Schedule Management** |||||
| `schedule.view` | ✅ | ✅ | ✅ | View group schedules |
| `schedule.create` | ✅ | ✅ | ❌ | Create new schedule slots |
| `schedule.edit` | ✅ | ✅ | ❌ | Edit existing schedule slots |
| `schedule.delete` | ✅ | ✅ | ❌ | Delete schedule slots |
| **Child Assignment** |||||
| `children.viewAssignments` | ✅ | ✅ | ✅ | View child assignments |
| `children.assignOwn` | ✅ | ✅ | ✅ | Assign own family children |
| `children.assignOthers` | ✅ | ✅ | ❌ | Assign other families' children |
| `children.removeOwn` | ✅ | ✅ | ✅ | Remove own family children |
| `children.removeOthers` | ✅ | ✅ | ❌ | Remove other families' children |
| **Vehicle Management** |||||
| `vehicles.viewAssignments` | ✅ | ✅ | ✅ | View vehicle assignments |
| `vehicles.assignOwn` | ✅ | ✅ | ✅ | Assign own family vehicles |
| `vehicles.assignOthers` | ✅ | ✅ | ❌ | Assign other families' vehicles |
| `vehicles.setDriver` | ✅ | ✅ | ✅ | Set driver for vehicles |

## Permission Inheritance and Cross-System Rules

### Family-to-Group Inheritance

When family members participate in groups, certain family permissions influence group capabilities:

1. **Resource Control**: Only family ADMIN members can assign their family's children and vehicles to group activities
2. **Override Authority**: Family ADMINs can override group assignments for their own family resources
3. **Privacy Protection**: Family member information is only visible to group participants, not detailed family structure

### Individual User Permissions in Groups

While groups operate at the family level, individual users' permissions within groups are determined by **combining their role in their own family with their family's role in the group**.

#### The Two-Level Permission Model

**For a user to perform administrative actions in a group, BOTH conditions must be true:**

1. **User must be ADMIN in their own family**
2. **User's family must have ADMIN or OWNER role in the group**

#### Permission Inheritance Matrix

| User's Role in Family | Family's Role in Group | Effective User Permissions | Can Invite Families? | Can Manage Schedules? | Can Remove Families? |
|----------------------|------------------------|---------------------------|---------------------|----------------------|---------------------|
| **ADMIN** | **OWNER** | Group Admin | ✅ Yes | ✅ Yes | ✅ Yes |
| **ADMIN** | **ADMIN** | Group Admin | ✅ Yes | ✅ Yes | ✅ Yes |
| **ADMIN** | **MEMBER** | Group Member | ❌ No | ❌ No | ❌ No |
| **MEMBER** | **OWNER** | Group Member | ❌ No | ❌ No | ❌ No |
| **MEMBER** | **ADMIN** | Group Member | ❌ No | ❌ No | ❌ No |
| **MEMBER** | **MEMBER** | Group Member | ❌ No | ❌ No | ❌ No |

#### Important Rules

1. **Family Admin Status is Required**
   - Being an admin in your family is a **prerequisite** for any group administrative permissions
   - Family members (non-admins) never have group admin permissions, even if their family owns or administers the group
   - This prevents junior family members from accidentally managing group operations

2. **Family's Group Role Determines Scope**
   - If your family is only a MEMBER of the group, you cannot perform admin actions even if you are a family admin
   - If your family is an ADMIN or OWNER of the group, you can perform admin actions only if you are also a family admin
   - This ensures families maintain control over who represents them in group management

3. **Owner vs Admin Roles**
   - The family that created a group is the OWNER
   - Both OWNER and ADMIN have nearly identical permissions
   - **Key Difference**: Only the OWNER family can delete the group
   - Both OWNER and ADMIN can promote/demote families to/from ADMIN role
   - Owner families cannot leave their own group (must delete it instead)

#### Real-World Examples

**Example 1: Smith Family Creates a Carpool Group**
- Smith family creates "Morning School Run" group → Smith family is OWNER
- John (Smith family ADMIN) → Can invite families, manage schedules ✅
- Sarah (Smith family MEMBER) → Can only view schedules and assign Smith children ❌

**Example 2: Jones Family Joins as Member**
- Jones family joins "Morning School Run" → Jones family is MEMBER
- Mike (Jones family ADMIN) → Can assign Jones children but cannot invite families ❌
- Lisa (Jones family MEMBER) → Can assign Jones children ❌

**Example 3: Jones Family Gets Promoted**
- Smith family promotes Jones family to ADMIN role in the group
- Mike (Jones family ADMIN) → Can now invite families and manage schedules ✅
- Lisa (Jones family MEMBER) → Still can only assign Jones children ❌

#### Actions Available to All Members

All users (regardless of their family or group role) can:
- ✅ View group information and schedules
- ✅ View participating families and their members
- ✅ Assign their own family's children to trips
- ✅ Assign their own family's vehicles to trips
- ✅ Leave the group (except if their family is the owner)

### Resource Management Across Systems

When families participate in groups, their family-level permissions interact with group-level permissions:

| Scenario | Permission Rule | Example |
|----------|----------------|---------|
| **Own Family Resources** | Any family member can assign own family resources | Any Jones family member can assign Jones children and vehicles to group trips, regardless of their role in family or group |
| **Other Family Resources** | Group ADMIN/OWNER role required | Only users with group admin permissions can assign other families' children to trips |
| **Resource Conflicts** | Family members can always remove their own family assignments | If a group admin assigns Smith children, any Smith family member can remove the assignment |
| **Privacy Protection** | Resources are only visible within family and participating groups | Smith vehicles are visible to all families in groups where Smith participates, but not to other families |

## Implementation Details

### Backend Enforcement

#### Family Permission Checking
```typescript
// Example: Check if user can edit family children
async function canEditFamilyChildren(userId: string, familyId: string): Promise<boolean> {
  const familyMember = await getFamilyMember(userId, familyId);
  return familyMember?.role === 'ADMIN';
}

// Example: Check if user can invite family members  
async function canInviteFamilyMembers(userId: string, familyId: string): Promise<boolean> {
  const familyMember = await getFamilyMember(userId, familyId);
  return familyMember?.role === 'ADMIN';
}
```

#### Group Permission Checking
```typescript
// Example: Check if family can manage group schedules
async function canManageGroupSchedule(familyId: string, groupId: string): Promise<boolean> {
  const groupMembership = await getGroupFamilyMembership(familyId, groupId);
  return ['OWNER', 'ADMIN'].includes(groupMembership?.role || '');
}

// Example: Check if family can assign another family's children
async function canAssignFamilyChildren(
  requesterFamilyId: string, 
  targetFamilyId: string, 
  groupId: string
): Promise<boolean> {
  // Can always assign own family children if family admin
  if (requesterFamilyId === targetFamilyId) {
    return await isFamilyAdmin(requesterFamilyId);
  }
  
  // Can assign other families' children only if group owner/admin
  const groupMembership = await getGroupFamilyMembership(requesterFamilyId, groupId);
  return ['OWNER', 'ADMIN'].includes(groupMembership?.role || '');
}
```

#### Middleware Implementation
```typescript
// Family permission middleware
export const requireFamilyPermission = (permission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { familyId } = req.params;
    const userId = req.user.id;
    
    const hasPermission = await checkFamilyPermission(userId, familyId, permission);
    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient family permissions' });
    }
    
    next();
  };
};

// Group permission middleware  
export const requireGroupPermission = (permission: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { groupId } = req.params;
    const userId = req.user.id;
    
    const userFamily = await getUserFamily(userId);
    if (!userFamily) {
      return res.status(403).json({ error: 'Must be part of a family to access groups' });
    }
    
    const hasPermission = await checkGroupPermission(userFamily.id, groupId, permission);
    if (!hasPermission) {
      return res.status(403).json({ error: 'Insufficient group permissions' });
    }
    
    next();
  };
};
```

### Frontend Permission Handling

#### Permission Context
```typescript
// Family permissions context
interface FamilyPermissions {
  canManageMembers: boolean;
  canModifyChildren: boolean;
  canModifyVehicles: boolean;
  canEditFamily: boolean;
  canInviteMembers: boolean;
}

// Group permissions context
interface GroupPermissions {
  canManageGroup: boolean;
  canManageSchedule: boolean;
  canInviteFamilies: boolean;
  canAssignOwnChildren: boolean;
  canAssignOtherChildren: boolean;
  canManageFamilyRoles: boolean;
}
```

#### UI Permission Guards
```typescript
// Example: Conditional rendering based on permissions
function FamilyMemberCard({ member, permissions }: Props) {
  return (
    <Card>
      <CardContent>
        <h3>{member.user.name}</h3>
        <Badge>{member.role}</Badge>
        
        {permissions.canManageMembers && (
          <DropdownMenu>
            <DropdownMenuTrigger data-testid="member-actions">
              <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => changeRole(member.id)}>
                Change Role
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => removeMember(member.id)}>
                Remove Member
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </CardContent>
    </Card>
  );
}
```

## API Security Implementation

### Family API Endpoints
```
GET    /api/v1/families/current             # View own family (requires family membership)
PATCH  /api/v1/families/:id                 # Edit family (requires family.edit)
DELETE /api/v1/families/:id                 # Delete family (requires family.delete)
POST   /api/v1/families/:id/invite          # Invite member (requires members.invite)
PATCH  /api/v1/families/:id/members/:id     # Edit member role (requires members.editRole)
DELETE /api/v1/families/:id/members/:id     # Remove member (requires members.remove)
POST   /api/v1/families/:id/children        # Add child (requires children.create)
PATCH  /api/v1/families/:id/children/:id    # Edit child (requires children.edit)
DELETE /api/v1/families/:id/children/:id    # Remove child (requires children.delete)
```

### Group API Endpoints
```
POST   /api/v1/groups                       # Create group (requires family membership)
PATCH  /api/v1/groups/:id                   # Edit group (requires group.edit)
DELETE /api/v1/groups/:id                   # Delete group (requires group.delete)
POST   /api/v1/groups/:id/invite            # Invite family (requires families.invite)
PATCH  /api/v1/groups/:id/families/:id      # Edit family role (requires families.editRole)
DELETE /api/v1/groups/:id/families/:id      # Remove family (requires families.remove)
POST   /api/v1/groups/:id/schedule          # Create schedule (requires schedule.create)
POST   /api/v1/groups/:id/children          # Assign child (requires children.assignOwn/Others)
```

## Error Handling and User Experience

### Permission Error Types
```typescript
enum PermissionErrorCode {
  INSUFFICIENT_FAMILY_PERMISSIONS = 'INSUFFICIENT_FAMILY_PERMISSIONS',
  INSUFFICIENT_GROUP_PERMISSIONS = 'INSUFFICIENT_GROUP_PERMISSIONS',
  RESOURCE_NOT_OWNED = 'RESOURCE_NOT_OWNED',
  FAMILY_MEMBERSHIP_REQUIRED = 'FAMILY_MEMBERSHIP_REQUIRED',
  LAST_FAMILY_ADMIN = 'LAST_FAMILY_ADMIN',
  CANNOT_REMOVE_SELF = 'CANNOT_REMOVE_SELF'
}
```

### User-Friendly Error Messages
| Error Code | User Message | Suggested Action |
|------------|--------------|------------------|
| `INSUFFICIENT_FAMILY_PERMISSIONS` | "You don't have permission to perform this action in your family." | "Contact your family administrator for assistance." |
| `INSUFFICIENT_GROUP_PERMISSIONS` | "You don't have permission to manage this group feature." | "Contact the group owner or administrator." |
| `RESOURCE_NOT_OWNED` | "You can only manage your own family's resources." | "Ask the resource owner to make this change." |
| `FAMILY_MEMBERSHIP_REQUIRED` | "You must be part of a family to access this feature." | "Create or join a family first." |
| `LAST_FAMILY_ADMIN` | "Cannot remove the last administrator from the family." | "Promote another member to administrator first." |

## Testing Strategy

### Unit Tests
- Permission checking functions for each role combination
- Cross-system permission inheritance scenarios  
- Edge cases (last admin, self-removal, etc.)

### Integration Tests
- End-to-end permission workflows
- API endpoint security validation
- Frontend permission guard functionality

### Test Cases Coverage
- ✅ Family ADMIN can manage all family resources
- ✅ Family MEMBER has read-only access to family resources
- ✅ Group OWNER can manage group and assign any family resources
- ✅ Group ADMIN can manage schedules but not assign other families' resources
- ✅ Group MEMBER can only assign own family resources
- ✅ Family permissions override group permissions for own resources
- ✅ Permission errors provide helpful user guidance

## Migration Notes

### From Legacy System
The previous system supported three family roles (ADMIN, PARENT, MEMBER). During migration:

1. **PARENT → ADMIN**: All PARENT roles are converted to ADMIN
2. **Permission Consolidation**: PARENT-specific permissions are merged into ADMIN
3. **Group Architecture**: Groups now work with families instead of individual users
4. **Resource Ownership**: Individual resource ownership migrated to family ownership

### Database Migration Impact
```sql
-- Convert PARENT roles to ADMIN
UPDATE family_members SET role = 'ADMIN' WHERE role = 'PARENT';

-- Migrate individual resources to family ownership
UPDATE children SET family_id = (
  SELECT family_id FROM family_members WHERE user_id = children.user_id LIMIT 1
) WHERE family_id IS NULL;
```

## Security Best Practices

### Principle of Least Privilege
- Users receive only the minimum permissions necessary for their role
- Regular members cannot access administrative functions
- Cross-family resource access is strictly controlled

### Defense in Depth
- API-level permission checking
- Database-level constraints
- Frontend permission guards
- Audit logging for sensitive operations

### Privacy Protection
- Family information is private to family members
- Group participation doesn't expose detailed family structure
- Resource assignments are logged for accountability

## Conclusion

This ACL system provides:

1. **Clear Role Hierarchy** - Simplified ADMIN/MEMBER family roles with well-defined permissions
2. **Resource Protection** - Family resources are protected by family-level permissions
3. **Flexible Group Participation** - Families can participate in multiple groups with appropriate permissions
4. **Security by Design** - Multiple layers of permission checking and user-friendly error handling
5. **Migration Path** - Smooth transition from legacy individual-based to family-based permissions

The system balances security with usability, ensuring that families maintain control over their resources while enabling collaborative group scheduling and coordination.