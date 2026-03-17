# Generated TypeScript Types

This directory contains auto-generated TypeScript types from the [AsyncAPI specification](../../../docs/asyncapi/asyncapi.yaml).

## ⚠️ DO NOT EDIT

All files in this directory are **auto-generated**. Any manual changes will be overwritten when types are regenerated.

## 🔄 Regeneration

To regenerate the types after modifying the AsyncAPI specification:

```bash
# Quick rebuild (validate + generate types)
npm run asyncapi:build

# Individual steps
npm run asyncapi:validate       # Validate the spec
npm run asyncapi:generate-types # Generate TypeScript types only
npm run asyncapi:generate       # Generate HTML documentation (requires Node.js 24+)
```

**Recommended workflow:** Use `npm run asyncapi:build` after any changes to the AsyncAPI specification. This validates the spec and regenerates all TypeScript types in one command.

## 📦 Available Types

All types are exported from `./types/index.ts`:

```typescript
import {
  GroupEventData,
  FamilyAction,
  ChildInfo,
  VehicleInfo,
  // ... and many more
} from '@/generated/types';
```

## 🏗️ Type Categories

### Enums
- `GroupAction` - Actions performed on groups
- `FamilyAction` - Actions performed on families
- `MemberAction` - Actions performed by members
- `ScheduleAction` - Actions performed on schedule slots
- `ChildAction` - Actions performed on children
- `VehicleAction` - Actions performed on vehicles
- `DisconnectReason` - Reasons for disconnection
- `FamilyRole` - Family roles in groups
- `CapacityStatus` - Capacity status for slots
- `ConflictType` - Types of scheduling conflicts
- `NotificationType` - Types of notifications
- `TypingAction` - Typing indicator actions

### Event Data
- `ConnectedPayload` - Connection established payload
- `GroupEventData` - Group event data
- `GroupFamilyEventData` - Group/family event data
- `MemberEventData` - Member event data
- `ScheduleEventData` - Schedule event data
- `ScheduleSlotEventData` - Schedule slot event data
- `ChildEventData` - Child event data
- `VehicleEventData` - Vehicle event data
- `UserEventData` - User event data
- `TypingEventData` - Typing indicator event data
- `NotificationEventData` - Notification event data
- `ConflictEventData` - Conflict event data
- `ErrorEventData` - Error event data

### Data Structures
- `GroupInfo` - Basic group information
- `SlotInfo` - Schedule slot information
- `ChildInfo` - Child information
- `VehicleInfo` - Vehicle information
- `FamilyInfo` - Basic family information

## 🔗 Source of Truth

The [AsyncAPI specification](../../../docs/asyncapi/asyncapi.yaml) is the single source of truth for WebSocket events. All types are derived from this specification.

## 📖 Documentation

See the [AsyncAPI documentation](../../../docs/asyncapi/README.md) for detailed information about WebSocket events, payloads, and usage examples.
