# Firebase Cloud Messaging Setup Guide

This guide walks you through setting up Firebase Cloud Messaging (FCM) for the EduLift backend API.

## Prerequisites

- Firebase project created
- Firebase Admin SDK service account credentials
- Backend server with environment variable support

## Step 1: Firebase Project Setup

1. Go to the [Firebase Console](https://console.firebase.google.com)
2. Create a new project or select an existing one
3. Enable Cloud Messaging in the project settings

## Step 2: Generate Service Account Credentials

1. In Firebase Console, go to **Project Settings** → **Service Accounts**
2. Click **Generate New Private Key**
3. Download the JSON file containing your service account credentials
4. Keep this file secure - it contains sensitive authentication information

## Step 3: Environment Configuration

Add the following environment variables to your `.env` file:

```env
# Firebase Cloud Messaging Configuration
FIREBASE_NOTIFICATIONS_ENABLED=true
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour-Firebase-Private-Key-Here\n-----END PRIVATE KEY-----"
```

### Getting the Values

From your downloaded service account JSON file:
- `FIREBASE_PROJECT_ID`: Use the `project_id` field
- `FIREBASE_CLIENT_EMAIL`: Use the `client_email` field
- `FIREBASE_PRIVATE_KEY`: Use the `private_key` field (keep the newlines as `\n`)

Example service account JSON structure:
```json
{
  "type": "service_account",
  "project_id": "your-firebase-project-id",
  "private_key_id": "key-id",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs"
}
```

## Step 4: Database Migration

Run the database migration to create the FCM tokens table:

```bash
npm run db:migrate
```

This will create the `fcm_tokens` table with the following structure:
- `id` - Unique identifier
- `userId` - Reference to user
- `token` - FCM registration token
- `deviceId` - Optional device identifier
- `platform` - Platform type (android, ios, web)
- `isActive` - Active status flag
- `lastUsed` - Last usage timestamp
- `createdAt` - Creation timestamp
- `updatedAt` - Update timestamp

## Step 5: Install Dependencies

The Firebase Admin SDK dependency should already be installed. If not:

```bash
npm install firebase-admin
```

## Step 6: Testing the Setup

1. Start your backend server
2. Check the logs for Firebase initialization success message:
   ```
   🔥 FirebaseService: Successfully initialized Firebase Admin SDK
   🔔 PushNotificationServiceFactory: Using Firebase push notifications for project: your-project-id
   ```

3. Test the health endpoint:
   ```bash
   curl http://localhost:3001/health
   ```

4. Register an FCM token (requires authentication):
   ```bash
   curl -X POST http://localhost:3001/api/v1/fcm-tokens \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
     -d '{
       "token": "TEST_FCM_TOKEN",
       "platform": "web",
       "deviceId": "test-device"
     }'
   ```

## Step 7: Client-Side Integration

### Web Client

```javascript
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// Initialize Firebase (use your config)
const firebaseConfig = {
  // Your web app's Firebase configuration
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Request permission and get token
async function requestNotificationPermission() {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: 'YOUR_VAPID_KEY'
      });
      
      // Send token to backend
      await fetch('/api/v1/fcm-tokens', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({
          token: token,
          platform: 'web',
          deviceId: getDeviceId()
        })
      });
      
      return token;
    }
  } catch (error) {
    console.error('Error getting notification permission:', error);
  }
}

// Handle foreground messages
onMessage(messaging, (payload) => {
  console.log('Message received: ', payload);
  // Show notification or update UI
});
```

### Android Client (React Native)

```javascript
import messaging from '@react-native-firebase/messaging';

async function requestUserPermission() {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (enabled) {
    const token = await messaging().getToken();
    
    // Send token to backend
    await fetch('/api/v1/fcm-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        token: token,
        platform: 'android',
        deviceId: getDeviceId()
      })
    });
  }
}

// Handle foreground messages
messaging().onMessage(async remoteMessage => {
  console.log('FCM Message received:', remoteMessage);
});

// Handle background/quit state messages
messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('Message handled in the background!', remoteMessage);
});
```

### iOS Client (React Native)

```javascript
import messaging from '@react-native-firebase/messaging';

async function requestUserPermission() {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (enabled) {
    const token = await messaging().getToken();
    
    // Send token to backend
    await fetch('/api/v1/fcm-tokens', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userToken}`
      },
      body: JSON.stringify({
        token: token,
        platform: 'ios',
        deviceId: getDeviceId()
      })
    });
  }
}
```

## Step 8: Verification

### Test Notification Sending

Use the test endpoint to verify notifications are working:

```bash
curl -X POST http://localhost:3001/api/v1/fcm-tokens/test \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "title": "Test Notification",
    "body": "This is a test push notification",
    "priority": "high"
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "successCount": 1,
    "failureCount": 0,
    "invalidTokens": [],
    "totalTokens": 1
  }
}
```

### Check Token Status

```bash
curl http://localhost:3001/api/v1/fcm-tokens \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

## Troubleshooting

### Common Issues

1. **Firebase not initialized**
   - Check environment variables are set correctly
   - Verify private key format (preserve newlines)
   - Ensure Firebase project exists and FCM is enabled

2. **Invalid tokens**
   - Tokens may expire or become invalid
   - Implement token refresh in your client app
   - Clean up invalid tokens regularly

3. **Permission denied**
   - Verify service account has necessary permissions
   - Check Firebase project settings
   - Ensure service account is active

4. **Network errors**
   - Check firewall settings
   - Verify outbound connectivity to Firebase servers
   - Monitor rate limits and quotas

### Debugging

Enable debug logging by setting:
```env
NODE_ENV=development
```

Check server logs for Firebase initialization messages:
- ✅ Success: `FirebaseService: Successfully initialized Firebase Admin SDK`
- ❌ Error: `FirebaseService: Failed to initialize Firebase Admin SDK`

### Firebase Console Verification

1. Go to Firebase Console → Cloud Messaging
2. Send a test message to verify setup
3. Check message statistics and delivery reports
4. Monitor token registrations in Analytics

## Security Best Practices

1. **Environment Variables**
   - Never commit Firebase credentials to version control
   - Use secure environment variable management
   - Rotate service account keys regularly

2. **Token Management**
   - Validate token ownership before operations
   - Implement rate limiting on token endpoints
   - Clean up inactive tokens regularly

3. **Notification Content**
   - Sanitize all notification content
   - Avoid sensitive data in notifications
   - Use data payloads for app-specific information

4. **Monitoring**
   - Monitor notification delivery rates
   - Track invalid token rates
   - Set up alerts for service issues

## Production Considerations

1. **Scaling**
   - Use batch sending for multiple recipients
   - Implement queue system for high-volume notifications
   - Monitor Firebase quotas and limits

2. **Reliability**
   - Implement retry logic for failed sends
   - Use dead letter queues for failed notifications
   - Monitor and alert on service availability

3. **Performance**
   - Cache Firebase service instances
   - Use connection pooling
   - Optimize database queries for token retrieval

4. **Compliance**
   - Respect user notification preferences
   - Implement opt-out mechanisms
   - Follow platform-specific guidelines

## Additional Resources

- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)
- [FCM HTTP v1 API Reference](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages)
- [Firebase Console](https://console.firebase.google.com)