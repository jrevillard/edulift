# Rich DELETE Responses - Design Document

**Date:** 2025-02-10
**Status:** Design Approved
**Priority:** 🔴 High - Critical for mobile cache synchronization

## Overview

Convert all DELETE endpoints to return rich responses (complete updated objects) instead of simple success messages. This prevents cache desynchronization and allows clients to see backend side-effects.

## Problem Statement

**Current behavior:**
```json
DELETE /api/v1/schedule-slots/{id}/children/{childId}
→ 200 OK { success: true, message: "Child removed successfully" }
```

**Issues:**
- Client cache doesn't know the updated state
- Must make additional GET request to fetch updated data
- Risk of cache inconsistency if backend has business logic side-effects
- Mobile teams report cache corruption issues

**Requested behavior:**
```json
DELETE /api/v1/schedule-slots/{id}/children/{childId}
→ 200 OK { success: true, data: { <ScheduleSlot complet> } }
```

## Design Decisions

### 1. Deployment Strategy

**Option B chosen:** One controller at a time (3 deployments)
1. ScheduleSlotController (1 endpoint)
2. FamilyController (3 endpoints)
3. GroupController (6 endpoints)

**Reason:** Safer, easier to test and review each step.

### 2. Implementation Order

**Option 1 chosen:** Simplest to most complex
1. **ScheduleSlotController** - DELETE /children/{childId} (1 endpoint)
2. **FamilyController** - DELETE /members, /children, /vehicles (3 endpoints)
3. **GroupController** - DELETE /leave, /groups/{id}, /families/{id}, POST /invite (6 endpoints)

**Reason:** Validate pattern quickly on simple case first.

### 3. Repository Pattern

**Option A chosen:** Modify repository to return complete object

**For removeChildFromSlot:**
```typescript
async removeChildFromSlot(scheduleSlotId: string, childId: string): Promise<ScheduleSlot>
```

**Key points:**
- Return type is `Promise<ScheduleSlot>` (non-nullable)
- Slot is NEVER deleted by this operation (unlike removeVehicleFromSlot)
- Uses Prisma transaction: delete + findUnique with includes
- Reuses same includes as removeVehicleFromSlot for consistency

### 4. Error Handling

**Option A chosen:** Let Prisma throw P2025 error

Controller already catches P2025 and returns 404:
```typescript
if (error.code === 'P2025') {
  return c.json({ success: false, error: 'Child assignment not found' }, 404);
}
```

No additional validation needed in service.

### 5. Response Format

**Keep existing wrapper:** `{ success: true, data: <object> }`

This is consistent with existing API patterns and allows for metadata if needed later.

## Implementation Plan

### Phase 1: ScheduleSlotController

**Endpoint:** DELETE /api/v1/schedule-slots/{scheduleSlotId}/children/{childId}

**Changes:**

1. **Repository** (`src/repositories/ScheduleSlotRepository.ts`)
   - Change signature: `Promise<ScheduleSlot>` (currently `Promise<unknown>`)
   - Add Prisma transaction with delete + findUnique
   - Use same includes as removeVehicleFromSlot

2. **Service** (`src/services/ScheduleSlotService.ts`)
   - No code changes needed
   - Now receives ScheduleSlot instead of unknown

3. **Controller** (`src/controllers/v1/ScheduleSlotController.ts`)
   - Change response from `{ message: "..." }` to `scheduleSlot` object
   - Keep existing WebSocket emissions

4. **OpenAPI Schema** (`src/schemas/scheduleSlots.ts`)
   - Update response schema to use ScheduleSlotSchema
   - Regenerate swagger.json

5. **Tests**
   - Update mocks to return ScheduleSlot instead of unknown
   - Verify response structure matches new schema

**Breaking Change:** None - HTTP status stays 200, just enriching response body.

### Phase 2: FamilyController

**Endpoints:**
- DELETE /api/v1/families/{familyId}/members/{memberId}
- DELETE /api/v1/families/{familyId}/children/{childId}
- DELETE /api/v1/families/{familyId}/vehicles/{vehicleId}

**Pattern:** Same as Phase 1 - return complete Family object.

### Phase 3: GroupController

**Endpoints:**
- DELETE /api/v1/groups/{groupId}/leave
- DELETE /api/v1/groups/{groupId}
- DELETE /api/v1/groups/{groupId}/families/{familyId}
- POST /api/v1/groups/{groupId}/families/{familyId}/invite

**Pattern:** Same as previous phases - return complete Group or Invitation objects.

## Implementation Details

### ScheduleSlotRepository.removeChildFromSlot

```typescript
async removeChildFromSlot(scheduleSlotId: string, childId: string): Promise<ScheduleSlot> {
  return await this.prisma.$transaction(async (tx) => {
    // 1. Delete child assignment
    await tx.scheduleSlotChild.delete({
      where: {
        scheduleSlotId_childId: { scheduleSlotId, childId }
      },
    });

    // 2. Fetch updated ScheduleSlot
    const updatedSlot = await tx.scheduleSlot.findUnique({
      where: { id: scheduleSlotId },
      include: {
        vehicleAssignments: {
          include: {
            vehicle: {
              select: {
                id: true,
                name: true,
                capacity: true,
                familyId: true,
                createdAt: true,
                updatedAt: true,
              },
            },
            driver: {
              select: { id: true, name: true, email: true },
            },
            childAssignments: {
              include: {
                child: {
                  select: {
                    id: true,
                    name: true,
                    age: true,
                    familyId: true,
                    createdAt: true,
                    updatedAt: true,
                  },
                },
              },
            },
          },
        },
        childAssignments: true,
      },
    });

    if (!updatedSlot) {
      throw new Error('Schedule slot not found');
    }

    return updatedSlot;
  });
}
```

### ScheduleSlotController handler

```typescript
app.openapi(removeChildRoute, async (c) => {
  const { scheduleSlotId, childId } = c.req.valid('param');

  try {
    // Get slot for WebSocket emissions
    const scheduleSlot = await scheduleSlotServiceInstance.getScheduleSlotDetails(scheduleSlotId);
    if (!scheduleSlot) {
      return c.json({
        success: false,
        error: 'Schedule slot not found',
      }, 404);
    }

    // Remove child - now returns complete ScheduleSlot
    const updatedSlot = await scheduleSlotServiceInstance.removeChildFromSlot(scheduleSlotId, childId);

    // Emit WebSocket events
    SocketEmitter.broadcastScheduleSlotUpdate(scheduleSlot.groupId, scheduleSlotId, updatedSlot);
    SocketEmitter.broadcastScheduleUpdate(scheduleSlot.groupId);

    return c.json({
      success: true,
      data: updatedSlot,  // ✅ Complete ScheduleSlot instead of message
    }, 200);

  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2025') {
      return c.json({
        success: false,
        error: 'Child assignment not found',
        code: 'CHILD_NOT_FOUND',
      }, 404);
    }
    // ... other error handling
  }
});
```

## Testing

### Unit Tests

Update existing test mocks:
```typescript
// Before
mockScheduleSlotRepository.removeChildFromSlot.mockResolvedValue({} as any);

// After
mockScheduleSlotRepository.removeChildFromSlot.mockResolvedValue(mockScheduleSlot);
```

Add assertion for response structure:
```typescript
const response = await request(app).delete(`/api/v1/schedule-slots/${slotId}/children/${childId}`);
expect(response.body).toMatchObject({
  success: true,
  data: {
    id: slotId,
    groupId: expect.any(String),
    vehicleAssignments: expect.any(Array),
    // ... other ScheduleSlot fields
  }
});
```

### Integration Tests

Verify:
1. Response includes complete ScheduleSlot
2. Child is removed from childAssignments
3. WebSocket event is emitted
4. 404 response when child not found
5. All vehicle fields are present (6 fields, not 3)

## Success Criteria

- [ ] All 1393 tests passing
- [ ] DELETE /children/{childId} returns ScheduleSlot in data
- [ ] OpenAPI schema matches response
- [ ] No breaking changes to HTTP status codes
- [ ] swagger.json regenerated
- [ ] Mobile team validates response format

## Open Questions

1. **Should we add API versioning?** Currently using /api/v1, consider /api/v2 if these are breaking changes for existing clients.
   - **Decision:** Not breaking - same HTTP status, just enriching response body.

2. **Should we add deprecation warnings for old response format?**
   - **Decision:** No, old format was never documented correctly in OpenAPI.

## References

- Mobile team requirements (2025-02-10)
- ScheduleSlotRepository.removeVehicleFromSlot (reference implementation)
- Existing OpenAPI specs in backend/docs/openapi/swagger.json
