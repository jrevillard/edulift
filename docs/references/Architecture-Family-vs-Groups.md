# Family vs Groups Architecture Documentation

## Overview

The EduLift application implements two distinct but complementary systems:

1. **Family System** - Resource ownership and management
2. **Group System** - Scheduling coordination and collaboration

These systems work together but serve different purposes and have different data models.

## System Purposes

### Family System (Resource Ownership)
- **Purpose**: Manage shared resources (children, vehicles) within a family unit
- **Scope**: Resource ownership, permissions, and family member management
- **Cardinality**: One user belongs to **ONE family** maximum
- **Resources Managed**: Children, Vehicles owned by the family
- **Access Control**: Role-based permissions (ADMIN, MEMBER)

### Group System (Scheduling Coordination)  
- **Purpose**: Coordinate transportation schedules and trip planning
- **Scope**: Schedule management, time slots, trip coordination
- **Cardinality**: One user can participate in **MULTIPLE groups**
- **Resources Managed**: Schedules, time slots, trip assignments
- **Access Control**: Group admin/member roles for scheduling

## Architecture Relationship

```
┌─────────────────┐    ┌─────────────────┐
│   FAMILY        │    │     GROUP       │
│   (Resources)   │    │   (Scheduling)  │
├─────────────────┤    ├─────────────────┤
│ • Children      │◄───┤ • Time Slots    │
│ • Vehicles      │    │ • Schedules     │
│ • Members       │    │ • Trips         │
│ • Permissions   │    │ • Assignments   │
└─────────────────┘    └─────────────────┘
        │                        │
        │                        │
        └──────── USER ──────────┘
          (1 family,            
           N groups)
```

## Data Model Relationships

### User Relationships
```typescript
interface User {
  // Family membership (0 or 1)
  familyMemberships: FamilyMember[]  // Max 1 record
  
  // Group memberships (0 to N)  
  groupMemberships: GroupMember[]    // Multiple records allowed
  
  // Legacy individual ownership (being migrated to families)
  children: Child[]                  // Deprecated - moving to family ownership
  vehicles: Vehicle[]                // Deprecated - moving to family ownership
}
```

### Resource Ownership Evolution
```typescript
// OLD MODEL (Individual Ownership)
interface Child {
  userId: string        // Individual owner
  groupMemberships: []  // Child manually added to each group
}

// NEW MODEL (Family Ownership)
interface Child {
  familyId: string                    // Family owns the child
  userId?: string                     // Legacy field for migration
  groupMemberships: GroupChildMember[] // Child can be in multiple groups
}
```

## Practical Examples

### Example 1: The Smith Family
- **Family**: "Smith Family" (owns 2 children, 1 vehicle)
  - John Smith (ADMIN)
  - Jane Smith (MEMBER)  
  - Children: Emma (8), Lucas (12)
  - Vehicle: Toyota Camry (7 seats)

- **Group Participation**:
  - John participates in "Soccer Team Group" for Emma's games
  - Jane participates in "School Carpool Group" for Lucas
  - Both use the family vehicle and children in their respective groups

### Example 2: Resource Sharing
- Family vehicle "Toyota Camry" can be used in multiple groups:
  - Monday: Soccer practice group (driven by John)
  - Tuesday: School carpool group (driven by Jane)
  - Wednesday: Music lesson group (driven by John)

## Migration Strategy

### Phase 1: Parallel Systems
- Family system introduced alongside existing group system
- Children/vehicles have both `userId` (old) and `familyId` (new) fields
- Users can gradually migrate to family ownership

### Phase 2: Data Migration
- Individual resources migrated to family ownership
- Each user becomes ADMIN of their own family initially
- Families can be merged or members invited

### Phase 3: Full Integration ✅ **COMPLETED**
- ✅ **Groups are owned by families** (`familyId` field in groups table)
- ✅ **Family-based group creation** (only family admins can create groups)
- ✅ **Family-based group membership** (families join groups, not individual users)
- ✅ **Family-based resource sharing** enabled (family resources used in group scheduling)
- ✅ **Family permissions** respected in group contexts
- ⚠️ **Legacy fields**: Some test files may still reference old `adminId` pattern but actual implementation uses `familyId`

## API Structure

### Family APIs
```
/api/v1/families/
├── POST   /                     # Create family
├── GET    /current              # Get user's family
├── POST   /join                 # Join family via invite code
├── POST   /{id}/invite          # Invite member to family
├── GET    /{id}/members         # List family members
├── PATCH  /{id}/members/{id}    # Update member role
├── DELETE /{id}/members/{id}    # Remove family member
├── GET    /{id}/children        # List family children
├── POST   /{id}/children        # Add child to family
├── GET    /{id}/vehicles        # List family vehicles
└── POST   /{id}/vehicles        # Add vehicle to family
```

### Group APIs (Family-Based)
```
/api/v1/groups/
├── POST   /                     # Create scheduling group (family-owned)
├── GET    /my-groups            # Get user's family groups  
├── POST   /join                 # Join group via invite code (family joins)
├── GET    /{groupId}            # Get group details
├── GET    /{groupId}/members    # Get group family members
├── GET    /{groupId}/schedule   # Get group schedule
├── POST   /{groupId}/schedule-slots  # Create schedule slot
├── POST   /{groupId}/children   # Add child to group (family-owned child)
├── POST   /{groupId}/invite     # Invite family to group
├── PATCH  /{groupId}/families/{familyId}  # Update family role in group
└── DELETE /{groupId}/families/{familyId} # Remove family from group
```

## Frontend Implementation

### State Management
- **FamilyContext**: Manages family membership and resource ownership
- **Existing GroupContext**: Continues to manage scheduling and groups
- **Independent State**: Family and group states are separate

### Component Structure
```typescript
// Family components (new)
<FamilyProvider>
  <FamilyDashboard />
  <FamilyMemberManagement />
  <FamilyResourceManagement />
</FamilyProvider>

// Group components (existing)  
<GroupProvider>
  <GroupScheduling />
  <TripPlanning />
  <ScheduleManagement />
</GroupProvider>

// Integration components
<ResourceSelector>  // Selects from family-owned resources for group scheduling
<CrossGroupView />  // Shows family resources across multiple groups
```

### Navigation Structure
```
Application
├── Family Management
│   ├── Family Overview
│   ├── Member Management  
│   ├── Children Management
│   └── Vehicle Management
│
├── Group Scheduling (existing)
│   ├── My Groups
│   ├── Schedule Planning
│   ├── Trip Management
│   └── Resource Assignment (uses family resources)
│
└── Dashboard
    ├── Family Status
    ├── Upcoming Schedules (across all groups)
    └── Resource Utilization
```

## Business Logic Rules

### Family Rules
1. **One Family Per User**: A user can only be a member of one family at a time
2. **Family Ownership**: Resources (children, vehicles) belong to the family, not individuals
3. **Role Hierarchy**: ADMIN > MEMBER permissions (simplified two-tier system)
4. **Resource Access**: Family members can access family resources based on their role
5. **Family Admin**: Every family must have at least one ADMIN

### Group Rules (Existing)
1. **Multiple Groups**: A user can participate in multiple scheduling groups
2. **Group Resources**: Groups can reference family-owned resources for scheduling
3. **Schedule Coordination**: Groups manage time slots, trips, and transportation logistics
4. **Cross-Family Collaboration**: Different families can coordinate in the same group

### Integration Rules
1. **Resource Sharing**: Family resources can be used across multiple groups
2. **Permission Inheritance**: Family permissions apply when using resources in groups
3. **Conflict Resolution**: Family admins can override group assignments for their resources
4. **Privacy**: Family information remains private to family members

## Group Invitation Rules & Business Logic

### Core Invitation Principles
1. **Family-Centric Invitations**: All group invitations are sent to families, not individual users
2. **Admin-Only Acceptance**: Only family ADMINs can accept group invitations on behalf of their family
3. **Complete Family Join**: When a family joins a group, ALL family members participate with inherited roles
4. **Single Decision Point**: First family admin to accept invitation completes the process for entire family

### Invitation Authority Matrix

#### Who Can Accept Group Invitations
- ✅ **Family ADMIN**: Can accept group invitations for their family
- ❌ **Family MEMBER**: Cannot accept group invitations (must request family admin)
- ❌ **No Family**: Must create/join family first (becomes admin of new family)

#### Group Role Inheritance from Family
- **Family ADMIN** → **Group ADMIN** (maintains administrative privileges)
- **Family MEMBER** → **Group MEMBER** (participates without admin rights)

### Detailed Invitation Workflows

#### Authenticated User Scenarios

**Scenario A: Family Admin Receives Invitation**
```
User State: Authenticated + Family Admin + Valid Code
1. Validate invitation code → Success
2. Display: "Ready to join [GroupName] as family admin"
3. Show group details and family members who will join
4. Button: "Join Group" → Complete family enrollment
5. Result: Entire family joins with inherited roles
```

**Scenario B: Family Member Receives Invitation**
```
User State: Authenticated + Family Member + Valid Code
1. Validate invitation code → Success
2. Display: "Only your family admin can accept this invitation"
3. Show admin contact: "Contact [AdminName] to join this group"
4. Options: "Share Link with Admin" or "Request Admin Role"
5. No join button available → Must involve family admin
```

**Scenario C: User Without Family**
```
User State: Authenticated + No Family + Valid Code
1. Validate invitation code → Success
2. Auto-redirect to family onboarding
3. URL: `/families/onboarding?returnTo=/groups/join?code=XXX`
4. After family creation → User becomes admin → Return to invitation
5. Proceed with Scenario A (now has admin privileges)
```

#### Multi-Admin Family Coordination

**First Admin Acceptance**
```
Admin 1: Clicks invitation link → Accepts for family
Result: Family joins group, invitation marked as accepted
```

**Subsequent Admin Attempts**
```
Admin 2: Clicks same/similar invitation link
Display: "[Admin1Name] already accepted this invitation for your family"
Button: "Go to Group" → Redirect to joined group
No duplicate enrollment possible
```

#### Invitation State Management

**Invitation Expiry**
- Default: 7 days (`INVITATION_EXPIRY_DAYS`)
- Configurable via environment variable
- Automatic cleanup via `InvitationCleanupService`
- Email notification before expiry (optional)

**Invitation Status Progression**
```
PENDING → ACCEPTED (family joins)
PENDING → EXPIRED (automatic cleanup)
PENDING → CANCELLED (admin action)
```

### Permission Validation Rules

#### Pre-Join Validation
1. **User Authentication**: Must be logged in
2. **Family Membership**: Must belong to a family
3. **Family Admin Role**: Must have admin privileges in family
4. **Invitation Validity**: Code must be valid, not expired, not already used
5. **No Existing Membership**: Family not already in target group

#### Post-Join Validation
1. **Role Inheritance**: Family roles mapped to group roles correctly
2. **Resource Access**: Family resources available in new group context
3. **Permission Propagation**: All family members receive appropriate group access

### Error Handling & User Guidance

#### Permission Denied Scenarios
```typescript
// Family member tries to accept invitation
{
  error: "INSUFFICIENT_FAMILY_PERMISSIONS",
  message: "Only family administrators can accept group invitations",
  familyAdmin: "ContactAdminName",
  actions: ["shareWithAdmin", "requestAdminRole"]
}
```

#### Missing Prerequisites
```typescript
// User without family
{
  error: "NO_FAMILY_MEMBERSHIP",
  message: "You must be part of a family to join groups",
  redirectTo: "/families/onboarding",
  returnUrl: "/groups/join?code=XXX"
}
```

### Security Considerations

#### Invitation Code Security
- Cryptographically secure random generation
- Single-use per family (prevents duplicate joins)
- Time-limited validity
- No personal information in code

#### Permission Verification
- Family admin role verified server-side
- Group capacity limits enforced
- Audit logging for all invitation actions
- Rate limiting on invitation attempts

## Security Considerations

### Family Security
- Role-based access control within families
- Family invite codes for secure member addition
- Resource access based on family membership
- Admin privileges for sensitive family operations

### Cross-System Security  
- Family permissions respected in group contexts
- Resource ownership verified before group assignments
- Audit logs for cross-system resource usage
- Privacy protection for family information in groups

## Database Schema Summary

### Family Tables
```sql
-- Family ownership and membership
families (id, name, invite_code)
family_members (family_id, user_id, role, joined_at)

-- Family-owned resources  
children (id, name, age, family_id, user_id) -- user_id for migration
vehicles (id, name, capacity, family_id, user_id) -- user_id for migration
```

### Group Tables (Family-Based)
```sql
-- Group scheduling and coordination (family-owned)
groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  family_id TEXT NOT NULL,  -- ✅ IMPLEMENTED: Group owner family
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (family_id) REFERENCES families(id) ON DELETE CASCADE
);

-- Family participation in groups (many-to-many)
group_family_members (
  family_id TEXT,
  group_id TEXT,
  role TEXT DEFAULT 'MEMBER', -- ADMIN | MEMBER
  added_by TEXT NOT NULL,      -- User who added the family
  joined_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (family_id, group_id)
);

-- Schedule time slots
schedule_slots (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  datetime TIMESTAMP NOT NULL,  -- ISO 8601 UTC datetime
  UNIQUE (group_id, datetime)
);

-- Group-child relationships (references family children)
group_child_members (
  child_id TEXT,
  group_id TEXT,
  added_by TEXT NOT NULL,
  added_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (child_id, group_id)
);

-- Group invitations (family-based invitations)
group_invitations (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  family_id TEXT NOT NULL,     -- ✅ IMPLEMENTED: Target family
  role TEXT DEFAULT 'MEMBER',
  status TEXT DEFAULT 'PENDING',
  invite_code TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Schedule assignments (uses family resources)
schedule_slot_vehicles (
  id TEXT PRIMARY KEY,
  schedule_slot_id TEXT NOT NULL,
  vehicle_id TEXT NOT NULL,    -- ✅ References family-owned vehicle
  driver_id TEXT,              -- ✅ Must be family member
  created_at TIMESTAMP DEFAULT NOW()
);

schedule_slot_children (
  schedule_slot_id TEXT,
  child_id TEXT,               -- ✅ References family-owned child
  vehicle_assignment_id TEXT NOT NULL,
  assigned_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (schedule_slot_id, child_id)
);
```

## Implementation Status

### ✅ Completed (Backend)
- [x] Family system database schema
- [x] Family service layer (create, join, member management)
- [x] Family authentication and permissions  
- [x] Family API endpoints
- [x] **Group-to-family migration completed**
- [x] **Family-based group architecture implemented**
- [x] **Simplified ADMIN/MEMBER role system**
- [x] **Database migrations for production deployment**

### ✅ Completed (Frontend)
- [x] Family type definitions and interfaces
- [x] Family API service layer  
- [x] Family context and state management
- [x] **Family UI components (ManageFamilyPage, FamilyOnboarding)**
- [x] **Group components updated for family-based architecture**
- [x] **Resource selection for group scheduling**
- [x] **All tests updated and passing**

### 📋 Future Enhancements
- [ ] Advanced family analytics and insights
- [ ] Cross-group resource utilization reports
- [ ] Family activity history and audit logs
- [ ] Enhanced permission granularity
- [ ] Multi-family coordination workflows

## Testing Strategy

### Family System Tests
- Family creation and member management
- Role-based permission enforcement
- Resource ownership and access control
- Integration with group scheduling

### Integration Tests
- Cross-system resource sharing
- Permission inheritance between systems
- Data consistency across family and group operations
- Migration scenarios from individual to family ownership

## Related Documentation

- **[Access Control and Permissions](./Access-Control-and-Permissions.md)** - Comprehensive ACL documentation for family and group permissions
- **[API Documentation](./API-Documentation.md)** - Complete API reference for family and group endpoints
- **[Testing Strategy](./Testing-Strategy.md)** - Test coverage for family-group integration scenarios

## Conclusion

The Family and Group systems work together to provide a comprehensive solution:

- **Families** handle the "who owns what" (resource ownership and permissions)
- **Groups** handle the "when and where" (scheduling coordination)

This separation of concerns allows for:
- Flexible resource sharing across multiple scheduling contexts
- Clear ownership and permission models with simplified ADMIN/MEMBER roles
- Scalable family-based architecture that supports collaborative scheduling
- Secure access control with family permissions taking precedence over group permissions
- Production-ready implementation with complete database migrations

The systems are designed to be complementary, not competitive, enabling rich collaboration scenarios while maintaining clear data ownership and privacy boundaries. 

## 🎯 **Current Implementation Verification**

✅ **Confirmed**: Groups are **fully owned by families** in the current implementation:
- Database schema: `groups.family_id` field (NOT `admin_id`) 
- Business logic: Only family admins can create groups for their family
- Group membership: Families join groups as units (not individual users)
- Resource access: Family-owned children and vehicles are used in group scheduling
- Permissions: Family admin privileges are respected in group contexts

The migration to family-based group ownership is **complete and production-ready**, providing a more intuitive and secure foundation for collaborative transportation management.