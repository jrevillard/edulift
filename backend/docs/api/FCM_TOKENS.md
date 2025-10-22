# FCM Tokens API Documentation

This document describes the Firebase Cloud Messaging (FCM) token management API endpoints.

## Overview

The FCM Tokens API allows authenticated users to manage their Firebase Cloud Messaging tokens for push notifications. These endpoints enable token registration, validation, topic subscription management, and testing.

## Base URL

All endpoints are prefixed with `/api/v1/fcm-tokens`

## Authentication

All endpoints require authentication. Include the user authentication token in your requests.

## Endpoints

### 1. Save FCM Token

Register or update an FCM token for the authenticated user.

**Endpoint:** `POST /api/v1/fcm-tokens`

**Request Body:**
```json
{
  "token": "string (required)",
  "deviceId": "string (optional)",
  "platform": "android|ios|web (required)"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "token-id",
    "platform": "android",
    "isActive": true,
    "createdAt": "2024-03-15T10:00:00.000Z"
  }
}
```

**Error Responses:**
- `400` - Validation error
- `401` - Authentication required
- `500` - Server error

### 2. Get User FCM Tokens

Retrieve all active FCM tokens for the authenticated user.

**Endpoint:** `GET /api/v1/fcm-tokens`

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "token-id-1",
      "platform": "android",
      "deviceId": "device-123",
      "isActive": true,
      "lastUsed": "2024-03-15T10:00:00.000Z",
      "createdAt": "2024-03-10T08:00:00.000Z"
    },
    {
      "id": "token-id-2",
      "platform": "ios",
      "deviceId": "device-456",
      "isActive": true,
      "lastUsed": "2024-03-14T15:30:00.000Z",
      "createdAt": "2024-03-12T12:00:00.000Z"
    }
  ]
}
```

### 3. Delete FCM Token

Delete a specific FCM token that belongs to the authenticated user.

**Endpoint:** `DELETE /api/v1/fcm-tokens/:token`

**Parameters:**
- `token` - The FCM token to delete

**Response (200):**
```json
{
  "success": true,
  "message": "FCM token deleted successfully"
}
```

**Error Responses:**
- `404` - Token not found or does not belong to user
- `500` - Server error

### 4. Validate FCM Token

Validate an FCM token by sending a test message to Firebase.

**Endpoint:** `POST /api/v1/fcm-tokens/validate`

**Request Body:**
```json
{
  "token": "string (required)"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "fcm-token-123",
    "isValid": true,
    "isServiceAvailable": true
  }
}
```

**Error Responses:**
- `400` - Validation error
- `404` - Token not found or does not belong to user

### 5. Subscribe to Topic

Subscribe an FCM token to a specific topic for targeted notifications.

**Endpoint:** `POST /api/v1/fcm-tokens/subscribe`

**Request Body:**
```json
{
  "token": "string (required)",
  "topic": "string (required)"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "fcm-token-123",
    "topic": "family-updates",
    "subscribed": true
  }
}
```

**Error Responses:**
- `400` - Validation error
- `404` - Active token not found or does not belong to user

### 6. Unsubscribe from Topic

Unsubscribe an FCM token from a specific topic.

**Endpoint:** `POST /api/v1/fcm-tokens/unsubscribe`

**Request Body:**
```json
{
  "token": "string (required)",
  "topic": "string (required)"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "token": "fcm-token-123",
    "topic": "family-updates",
    "unsubscribed": true
  }
}
```

### 7. Send Test Notification

Send a test push notification to all of the user's active devices.

**Endpoint:** `POST /api/v1/fcm-tokens/test`

**Request Body:**
```json
{
  "title": "string (required)",
  "body": "string (required)",
  "data": {
    "key": "value"
  },
  "priority": "high|normal (optional)"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "successCount": 2,
    "failureCount": 0,
    "invalidTokens": [],
    "totalTokens": 2
  }
}
```

**Error Responses:**
- `400` - Validation error
- `503` - Push notification service unavailable

### 8. Get Token Statistics

Get statistics about the user's FCM tokens.

**Endpoint:** `GET /api/v1/fcm-tokens/stats`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "userTokenCount": 3,
    "serviceAvailable": true,
    "platforms": {
      "android": 2,
      "ios": 1,
      "web": 0
    }
  }
}
```

## Common Data Types

### FCM Token Data
```typescript
interface FcmTokenData {
  id?: string;
  userId: string;
  token: string;
  deviceId?: string;
  platform: 'android' | 'ios' | 'web';
  isActive?: boolean;
  lastUsed?: Date;
}
```

### Push Notification Data
```typescript
interface PushNotificationData {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  clickAction?: string;
  sound?: string;
  badge?: number;
  priority?: 'high' | 'normal';
  timeToLive?: number; // TTL in seconds
}
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error description",
  "message": "Detailed error message",
  "details": [] // Optional validation details
}
```

Common HTTP status codes:
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `404` - Not Found (resource not found)
- `500` - Internal Server Error
- `503` - Service Unavailable (Firebase not configured)

## Platform-Specific Notes

### Android
- Uses FCM registration tokens
- Supports data-only messages
- Handles token refresh automatically

### iOS
- Uses APNs tokens converted to FCM
- Requires notification permissions
- Supports silent notifications

### Web
- Uses FCM web push tokens
- Requires user permission for notifications
- Limited by browser support

## Configuration

The FCM service requires the following environment variables:

```env
FIREBASE_NOTIFICATIONS_ENABLED=true
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Firebase-Private-Key-Here\n-----END PRIVATE KEY-----"
```

## Examples

### Client Registration Flow

```javascript
// 1. Register FCM token after user login
const token = await getMessaging().getToken();

await fetch('/api/v1/fcm-tokens', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userToken}`
  },
  body: JSON.stringify({
    token: token,
    deviceId: getDeviceId(),
    platform: 'web'
  })
});

// 2. Test notifications
await fetch('/api/v1/fcm-tokens/test', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${userToken}`
  },
  body: JSON.stringify({
    title: 'Test Notification',
    body: 'This is a test message',
    priority: 'high'
  })
});
```

### Server-Side Usage

```typescript
import { PushNotificationServiceFactory } from './services/PushNotificationServiceFactory';

// Send notification to users
const pushService = PushNotificationServiceFactory.getInstance(prisma);

await pushService.sendToUsers(['user-1', 'user-2'], {
  title: 'Schedule Update',
  body: 'Your transportation schedule has been updated',
  data: {
    type: 'schedule_update',
    groupId: 'group-123'
  },
  clickAction: '/dashboard',
  priority: 'high'
});
```

## Security Considerations

1. **Token Privacy**: FCM tokens are sensitive and should be treated as secrets
2. **User Ownership**: Always verify that tokens belong to the authenticated user
3. **Rate Limiting**: Implement rate limiting for notification endpoints
4. **Token Cleanup**: Regularly clean up invalid/inactive tokens
5. **Topic Security**: Validate topic names and permissions before subscription

## Best Practices

1. **Token Management**: 
   - Store tokens securely in the database
   - Update `lastUsed` timestamp when sending notifications
   - Clean up invalid tokens regularly

2. **Notification Design**:
   - Keep titles and bodies concise
   - Include relevant action data
   - Use appropriate priority levels

3. **Error Handling**:
   - Handle invalid tokens gracefully
   - Retry failed notifications with exponential backoff
   - Log errors for monitoring

4. **Performance**:
   - Batch notifications when possible
   - Use topics for broadcast messages
   - Monitor Firebase quotas and limits