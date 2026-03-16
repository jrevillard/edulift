# EduLift WebSocket API - AsyncAPI Documentation

## Overview

This documentation describes the EduLift WebSocket API via AsyncAPI.
The API uses Socket.IO for real-time communication between server and clients.

## Table of Contents

- [Connection](#connection)
- [Authentication](#authentication)
- [WebSocket Events](#websocket-events)
- [Room Management](#room-management)
- [Code Examples](#code-examples)
- [TypeScript Types](#typescript-types)

## Connection

### Connection URLs

- **Production:** `wss://api.edulift.com/socket.io/`
- **Development:** `ws://localhost:3000/socket.io/`
- **Protocol:** Socket.IO v4.x
- **Transports:** WebSocket (with polling fallback)

### Client Configuration

```typescript
import { io } from 'socket.io-client';

const socket = io('https://api.edulift.com', {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});
```

## Authentication

### JWT Handshake

Authentication is done via a JWT token sent during the connection handshake:

```typescript
const socket = io('https://api.edulift.com', {
  auth: {
    token: 'eyJhbGc...' // JWT token obtained via REST API
  }
});
```

### Connection Event

Once connected and authenticated, the server emits the `connected` event:

```typescript
socket.on('connected', (data) => {
  console.log('Connected as user:', data.userId);
  console.log('Member of groups:', data.groups);
});
```

**`connected` event payload:**

```typescript
interface ConnectedPayload {
  userId: string;
  groups: string[];
  timestamp: number;
}
```

## WebSocket Events

The WebSocket API defines **40+ events** organized into 8 categories:

| Category | Events | Description |
|-----------|------------|-------------|
| **Connection** | 2 | Connection, disconnection |
| **Groups** | 9 | Creation, deletion, member management |
| **Schedules** | 7 | Schedule slot updates |
| **Children** | 3 | Child management |
| **Vehicles** | 3 | Vehicle management |
| **Families** | 3 | Family management |
| **Presence** | 4 | User status |
| **System** | 3 | Notifications, errors, heartbeat |

### 1. Connection Events

#### `connected`
Emitted when connection is established with successful authentication.

**Direction:** Server → Client

**Payload:**
```typescript
{
  userId: string;
  groups: string[];
  timestamp: number;
}
```

**Example:**
```typescript
socket.on('connected', (data) => {
  console.log(`User ${data.userId} connected to groups:`, data.groups);
});
```

#### `disconnected`
Emitted when client disconnects.

**Direction:** Server → Client

**Payload:**
```typescript
{
  reason: 'client_disconnect' | 'server_disconnect' | 'timeout' | 'auth_failed';
  timestamp: number;
}
```

### 2. Group Management Events

#### `group:created`
Emitted when a new group is created.

**Direction:** Server → Client
**Room:** Creator and invited families

**Payload:**
```typescript
{
  groupId: string;
  action: 'created';
  createdBy: string;
  group?: {
    id: string;
    name: string;
    description: string;
    inviteCode: string;
  };
}
```

**Example:**
```typescript
socket.on('group:created', (data) => {
  console.log('New group created:', data.groupId);
  // Show notification or update UI
});
```

#### `group:deleted`
Emitted when a group is deleted.

**Direction:** Server → Client
**Room:** All group members

**Payload:**
```typescript
{
  groupId: string;
  action: 'deleted';
  deletedBy: string;
}
```

#### `group:updated`
Emitted when a group is modified (name, description, etc.).

**Direction:** Server → Client
**Room:** All group members

**Payload:**
```typescript
{
  groupId: string;
  action: 'updated';
  updatedBy: string;
  group?: GroupData;
}
```

#### `group:family:added`
Emitted when a family joins a group.

**Direction:** Server → Client
**Room:** All group members

**Payload:**
```typescript
{
  groupId: string;
  familyId: string;
  action: 'added';
  familyName?: string;
  joinedBy: string;
}
```

#### `group:family:left`
Emitted when a family voluntarily leaves a group.

**Direction:** Server → Client
**Room:** All group members

**Payload:**
```typescript
{
  groupId: string;
  familyId: string;
  action: 'left';
  familyName?: string;
}
```

#### `group:family:removed`
Emitted when a family is removed from a group by an admin.

**Direction:** Server → Client
**Room:** All group members

**Payload:**
```typescript
{
  groupId: string;
  familyId: string;
  action: 'removed';
  familyName?: string;
  removedBy: string;
}
```

#### `group:family:role:updated`
Emitted when a family's role is changed in a group.

**Direction:** Server → Client
**Room:** All group members

**Payload:**
```typescript
{
  groupId: string;
  familyId: string;
  newRole: 'admin' | 'member';
  previousRole: 'admin' | 'member';
  updatedBy: string;
}
```

#### `group:invitation:sent`
Emitted when an invitation to join a group is sent.

**Direction:** Server → Client
**Room:** Group admins and invited family

**Payload:**
```typescript
{
  groupId: string;
  familyId: string;
  inviteCode: string;
  invitedBy: string;
  expiresAt: number;
}
```

#### `member:joined`
Emitted when a member joins a group.

**Direction:** Server → Client
**Room:** All group members

**Payload:**
```typescript
{
  groupId: string;
  userId: string;
  action: 'joined';
  userName?: string;
}
```

#### `member:left`
Emitted when a member leaves a group.

**Direction:** Server → Client
**Room:** All group members

**Payload:**
```typescript
{
  groupId: string;
  userId: string;
  action: 'left';
  userName?: string;
}
```

### 3. Schedule Management Events

#### `schedule:updated`
Emitted when a schedule is updated (publication, modifications).

**Direction:** Server → Client
**Room:** All group members

**Payload:**
```typescript
{
  groupId: string;
  week: string; // Format: YYYY-W or YYYY-WW
  schedule?: ScheduleData;
}
```

#### `schedule:slot:created`
Emitted when a new schedule slot is created.

**Direction:** Server → Client
**Room:** All group members

**Payload:**
```typescript
{
  groupId: string;
  scheduleSlotId: string;
  action: 'created';
  slot?: ScheduleSlotData;
}
```

#### `schedule:slot:updated`
Emitted when a schedule slot is modified (assignment, capacity).

**Direction:** Server → Client
**Room:** All group members and slot subscribers

**Payload:**
```typescript
{
  groupId: string;
  scheduleSlotId: string;
  action: 'updated';
  slot?: ScheduleSlotData;
}
```

**Example:**
```typescript
socket.on('schedule:slot:updated', (data) => {
  console.log('Schedule slot updated:', data.scheduleSlotId);
  // Update slot display
  if (data.slot) {
    updateSlotDisplay(data.slot);
  }
});
```

#### `schedule:slot:deleted`
Emitted when a schedule slot is deleted.

**Direction:** Server → Client
**Room:** All group members

**Payload:**
```typescript
{
  groupId: string;
  scheduleSlotId: string;
  action: 'deleted';
}
```

#### `scheduleSlot:capacity:full`
Emitted when a slot reaches maximum capacity.

**Direction:** Server → Client
**Room:** All group members

**Payload:**
```typescript
{
  groupId: string;
  scheduleSlotId: string;
  status: 'full';
  currentLoad: number;
  capacity: number;
  message?: string;
}
```

#### `scheduleSlot:capacity:warning`
Emitted when a slot approaches maximum capacity (alert).

**Direction:** Server → Client
**Room:** All group members

**Payload:**
```typescript
{
  groupId: string;
  scheduleSlotId: string;
  status: 'warning';
  currentLoad: number;
  capacity: number;
  message?: string;
}
```

### 4. Child Management Events

#### `child:added`
Emitted when a child is added to a family.

**Direction:** Server → Client
**Room:** All family members

**Payload:**
```typescript
{
  familyId: string;
  childId: string;
  action: 'added';
  child?: ChildData;
}
```

#### `child:updated`
Emitted when a child is modified (information, permissions).

**Direction:** Server → Client
**Room:** All family members

**Payload:**
```typescript
{
  familyId: string;
  childId: string;
  action: 'updated';
  child?: ChildData;
}
```

#### `child:deleted`
Emitted when a child is deleted from a family.

**Direction:** Server → Client
**Room:** All family members

**Payload:**
```typescript
{
  familyId: string;
  childId: string;
  action: 'deleted';
}
```

### 5. Vehicle Management Events

#### `vehicle:added`
Emitted when a vehicle is added to a family.

**Direction:** Server → Client
**Room:** All family members

**Payload:**
```typescript
{
  familyId: string;
  vehicleId: string;
  action: 'added';
  vehicle?: VehicleData;
}
```

#### `vehicle:updated`
Emitted when a vehicle is modified (characteristics, availability).

**Direction:** Server → Client
**Room:** All family members

**Payload:**
```typescript
{
  familyId: string;
  vehicleId: string;
  action: 'updated';
  vehicle?: VehicleData;
}
```

#### `vehicle:deleted`
Emitted when a vehicle is deleted from a family.

**Direction:** Server → Client
**Room:** All family members

**Payload:**
```typescript
{
  familyId: string;
  vehicleId: string;
  action: 'deleted';
}
```

### 6. Family Management Events

#### `family:member:joined`
Emitted when a member joins a family.

**Direction:** Server → Client
**Room:** All family members

**Payload:**
```typescript
{
  familyId: string;
  userId: string;
  action: 'joined';
  userName?: string;
  role?: string;
}
```

#### `family:member:left`
Emitted when a member leaves a family.

**Direction:** Server → Client
**Room:** All family members

**Payload:**
```typescript
{
  familyId: string;
  userId: string;
  action: 'left';
  userName?: string;
}
```

#### `family:updated`
Emitted when a family is modified (name, settings).

**Direction:** Server → Client
**Room:** All family members

**Payload:**
```typescript
{
  familyId: string;
  action: 'updated';
  family?: FamilyData;
}
```

### 7. User Presence Events

#### `user:joined`
Emitted when a user connects and joins a group.

**Direction:** Server → Client
**Room:** All group members

**Payload:**
```typescript
{
  userId: string;
  groupId: string;
  action: 'joined';
  userName?: string;
}
```

#### `user:left`
Emitted when a user disconnects or leaves a group.

**Direction:** Server → Client
**Room:** All group members

**Payload:**
```typescript
{
  userId: string;
  groupId: string;
  action: 'left';
  userName?: string;
}
```

#### `user:typing`
Emitted when a user starts typing in a schedule slot.

**Direction:** Server → Client
**Room:** Users subscribed to this slot

**Payload:**
```typescript
{
  userId: string;
  scheduleSlotId: string;
  action: 'typing';
}
```

#### `user:stopped_typing`
Emitted when a user stops typing.

**Direction:** Server → Client
**Room:** Users subscribed to this slot

**Payload:**
```typescript
{
  userId: string;
  scheduleSlotId: string;
  action: 'stopped_typing';
}
```

### 8. System Events

#### `notification`
General system notification.

**Direction:** Server → Client
**Room:** Sent to concerned users

**Payload:**
```typescript
{
  type: 'SCHEDULE_PUBLISHED' | 'MEMBER_JOINED' | 'MEMBER_LEFT' | 'INFO' | 'WARNING' | 'SUCCESS';
  message: string;
  data?: Record<string, unknown>;
}
```

#### `conflict:detected`
Emitted when a conflict is detected (double booking, capacity exceeded).

**Direction:** Server → Client
**Room:** Sent to affected users

**Payload:**
```typescript
{
  scheduleSlotId: string;
  conflictType: 'DRIVER_DOUBLE_BOOKING' | 'VEHICLE_DOUBLE_BOOKING' | 'CAPACITY_EXCEEDED';
  affectedUsers: string[];
  message?: string;
}
```

#### `error`
Server error or validation error.

**Direction:** Server → Client
**Room:** Sent to concerned client

**Payload:**
```typescript
{
  type: string;
  message: string;
  details?: Record<string, unknown>;
}
```

#### `heartbeat`
Client sends a ping to maintain connection.

**Direction:** Client → Server

**Payload:**
```typescript
{
  timestamp: number;
}
```

#### `heartbeat-ack`
Server responds to client ping.

**Direction:** Server → Client

**Payload:**
```typescript
{
  timestamp: number;
}
```

## Room Management

### Join a Group Room

To receive events for a specific group, the client must join the room:

```typescript
socket.emit('group:join', { groupId: 'group-123' });
```

### Leave a Group Room

```typescript
socket.emit('group:leave', { groupId: 'group-123' });
```

### Subscribe to Schedule Events

```typescript
socket.emit('schedule:subscribe', {
  groupId: 'group-123',
  week: '2024-12'
});
```

### Unsubscribe from Schedule Events

```typescript
socket.emit('schedule:unsubscribe', {
  groupId: 'group-123',
  week: '2024-12'
});
```

### Join a Schedule Slot

```typescript
socket.emit('scheduleSlot:join', { scheduleSlotId: 'slot-456' });
```

### Leave a Schedule Slot

```typescript
socket.emit('scheduleSlot:leave', { scheduleSlotId: 'slot-456' });
```

## Code Examples

### Complete Initialization

```typescript
import { io } from 'socket.io-client';

class WebSocketManager {
  private socket: Socket;

  constructor(jwtToken: string) {
    this.socket = io('https://api.edulift.com', {
      auth: { token: jwtToken },
      transports: ['websocket', 'polling'],
    });

    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Connection events
    this.socket.on('connect', () => {
      console.log('Connected to WebSocket server');
    });

    this.socket.on('connected', (data) => {
      console.log('Authenticated as:', data.userId);
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  // Join a group
  joinGroup(groupId: string) {
    this.socket.emit('group:join', { groupId });
  }

  // Listen to group events
  onGroupCreated(callback: (data: GroupCreatedEvent) => void) {
    this.socket.on('group:created', callback);
  }

  onGroupFamilyAdded(callback: (data: GroupFamilyAddedEvent) => void) {
    this.socket.on('group:family:added', callback);
  }

  // Subscribe to schedules
  subscribeToSchedule(groupId: string, week: string) {
    this.socket.emit('schedule:subscribe', { groupId, week });
  }

  // Listen to schedule events
  onScheduleSlotUpdated(callback: (data: ScheduleSlotUpdatedEvent) => void) {
    this.socket.on('schedule:slot:updated', callback);
  }

  onScheduleSlotCapacityFull(callback: (data: ScheduleSlotCapacityEvent) => void) {
    this.socket.on('scheduleSlot:capacity:full', callback);
  }
}
```

### Schedule Events Management

```typescript
// Listen to slot creation
socket.on('schedule:slot:created', (data) => {
  const { groupId, scheduleSlotId, slot } = data;
  console.log(`New slot ${scheduleSlotId} created in group ${groupId}`);

  // Add slot to UI
  if (slot) {
    addSlotToUI(slot);
  }
});

// Listen to capacity updates
socket.on('scheduleSlot:capacity:warning', (data) => {
  const { scheduleSlotId, currentLoad, capacity } = data;
  const percentage = (currentLoad / capacity) * 100;

  console.warn(`Slot ${scheduleSlotId} is ${percentage}% full`);

  // Show warning in UI
  showCapacityWarning(scheduleSlotId, percentage);
});

socket.on('scheduleSlot:capacity:full', (data) => {
  const { scheduleSlotId } = data;
  console.log(`Slot ${scheduleSlotId} is now full`);

  // Disable slot in UI
  disableSlot(scheduleSlotId);
});
```

### Typing Indicators Management

```typescript
// Emit typing state
let typingTimeout: NodeJS.Timeout;

function emitTyping(scheduleSlotId: string) {
  socket.emit('user:typing', { scheduleSlotId });

  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('user:stopped_typing', { scheduleSlotId });
  }, 1000);
}

// Listen to other users' typing events
const typingUsers = new Map<string, Set<string>>();

socket.on('user:typing', (data) => {
  const { userId, scheduleSlotId } = data;

  if (!typingUsers.has(scheduleSlotId)) {
    typingUsers.set(scheduleSlotId, new Set());
  }

  typingUsers.get(scheduleSlotId)!.add(userId);
  updateTypingIndicator(scheduleSlotId);
});

socket.on('user:stopped_typing', (data) => {
  const { userId, scheduleSlotId } = data;

  typingUsers.get(scheduleSlotId)?.delete(userId);
  updateTypingIndicator(scheduleSlotId);
});

function updateTypingIndicator(scheduleSlotId: string) {
  const users = typingUsers.get(scheduleSlotId);
  const count = users?.size || 0;

  if (count > 0) {
    showTypingIndicator(scheduleSlotId, count);
  } else {
    hideTypingIndicator(scheduleSlotId);
  }
}
```

## HTML Documentation Generation

### Method 1: Via npm (Recommended)

```bash
# Validate the specification
npm run asyncapi:validate

# Generate HTML documentation
npm run asyncapi:generate

# Open generated documentation
open docs/asyncapi/html/index.html
```

### Method 2: Via AsyncAPI CLI (Alternative)

```bash
# Install AsyncAPI CLI globally
npm install -g @asyncapi/cli

# Generate documentation
asyncapi generate fromTemplate @asyncapi/html-template \
  docs/asyncapi/asyncapi.yaml \
  -o docs/asyncapi/html \
  --force-write
```

### ⚠️ Note on Node.js Version

**HTML generation requires Node.js 24.11+ or higher.**

If you're using Node.js 20.x (current project version), you'll encounter errors during HTML generation. Alternative solutions are:

1. **Read YAML directly:** The `asyncapi.yaml` file is valid and can be used with any YAML reader or AsyncAPI editor
2. **Use AsyncAPI Studio:** Copy `asyncapi.yaml` content to [AsyncAPI Studio](https://studio.asyncapi.com/) for visualization
3. **Upgrade Node.js:** To benefit from automatic generation, upgrade to Node.js 24.11+ (not recommended for production without proper testing)

### Specification Validation

The AsyncAPI specification has been validated successfully:

```bash
$ npm run asyncapi:validate
✓ File docs/asyncapi/asyncapi.yaml is valid
```

**Note:** Validation works fine on Node.js 20.x. Only HTML generation requires Node.js 24+.

## TypeScript Types

The TypeScript types corresponding to this AsyncAPI specification are manually maintained in `src/shared/events.ts`.

**Note:** There is no official AsyncAPI template for generating TypeScript types. TypeScript interfaces are maintained in sync with the AsyncAPI schemas defined in this file.

**Main types:**

```typescript
// Connection events
export interface ConnectedPayload {
  userId: string;
  groups: string[];
  timestamp: number;
}

// Group events
export interface GroupEventData {
  groupId: string;
  action: 'created' | 'deleted' | 'updated';
  createdBy?: string;
  deletedBy?: string;
  updatedBy?: string;
}

export interface GroupFamilyEventData {
  groupId: string;
  familyId: string;
  action: 'added' | 'left' | 'removed';
  familyName?: string;
  joinedBy?: string;
  removedBy?: string;
}

// Schedule events
export interface ScheduleEventData {
  groupId: string;
  scheduleSlotId?: string;
  week?: string;
}

export interface ScheduleSlotCapacityEventData {
  groupId: string;
  scheduleSlotId: string;
  status: 'full' | 'warning';
  currentLoad: number;
  capacity: number;
  message?: string;
}

// System events
export interface NotificationEventData {
  type: 'SCHEDULE_PUBLISHED' | 'MEMBER_JOINED' | 'MEMBER_LEFT';
  message: string;
  data?: Record<string, unknown>;
}

export interface ErrorEventData {
  type: string;
  message: string;
}
```

## Validation

Payload validation sent by clients is done server-side with Zod. Validation schemas are defined in `src/socket/validation.ts`.

**Server-side validation example:**

```typescript
import { scheduleSlotJoinSchema, validatePayload } from './validation';

// Validate a payload
const result = validatePayload(scheduleSlotJoinSchema, {
  scheduleSlotId: 'slot-123'
});

if (!result.success) {
  console.error('Invalid payload:', result.error);
  // Send error event to client
}
```

## Best Practices

1. **Error handling:** Always listen to the `error` event to handle server errors
2. **Reconnection:** Configure automatic reconnection with appropriate values
3. **Cleanup:** Unsubscribe from rooms when component unmounts
4. **Typing:** Implement a delay before emitting `stopped_typing` to avoid flickering
5. **Capacity:** Monitor capacity events to warn users

## Resources

- **Specification:** `asyncapi.yaml`
- **Source code:** `backend/src/socket/`
- **Validation:** `backend/src/socket/validation.ts`
- **Events:** `backend/src/shared/events.ts`
- **OpenAPI (REST):** `../openapi/swagger.json`
