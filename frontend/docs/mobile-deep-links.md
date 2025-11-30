# 📱 Mobile Deep Links Documentation - EduLift

## 🎯 Overview

This documentation explains how mobile deep links are implemented in EduLift to provide a seamless user experience between web and mobile application.

## 🏗️ Architecture

### Core Components

1. **`useMobileDetection`** - Hook to detect mobile device type
2. **`mobileRedirection.ts`** - Redirection and fallback utility
3. **Pages with mobile detection** - Pages that attempt to open mobile app

### User Flow

```
Email → HTTPS Link → Web Page → Mobile Detection
                            ↙        ↘
                         Mobile    Desktop
                           ↓          ↓
                Attempt Mobile App   Continue Web
                           ↓          ↓
                Success/Fallback     Normal Interface
```

## 📋 Pages with Mobile Detection

### 1. `/auth/verify` - Magic Links
- **Backend URLs**: `{DEEP_LINK_BASE_URL}/auth/verify?token={TOKEN}`
- **Parameters**: `token`, `inviteCode`
- **Mobile scheme**: `edulift://auth/verify?token={TOKEN}`
- **Component**: `VerifyMagicLinkPage.tsx`

### 2. `/families/join` - Family Invitations
- **Backend URLs**: `{DEEP_LINK_BASE_URL}/families/join?code={INVITE_CODE}`
- **Parameters**: `code`
- **Mobile scheme**: `edulift://families/join?code={INVITE_CODE}`
- **Component**: `UnifiedFamilyInvitationPage.tsx`

### 3. `/groups/join` - Group Invitations
- **Backend URLs**: `{DEEP_LINK_BASE_URL}/groups/join?code={INVITE_CODE}`
- **Parameters**: `code`
- **Mobile scheme**: `edulift://groups/join?code={INVITE_CODE}`
- **Component**: `UnifiedGroupInvitationPage.tsx`

### 4. `/dashboard` - Notifications and Reminders
- **Backend URLs**: `{DEEP_LINK_BASE_URL}/dashboard`
- **Parameters**: None (direct redirect)
- **Mobile scheme**: `edulift://dashboard`
- **Component**: `DashboardPage.tsx` (to be implemented)

## 🛠️ Technical Implementation

### Mobile Detection Hook

```typescript
import { useMobileDetection } from '../hooks/useMobileDetection';

const mobileDetection = useMobileDetection();
// mobileDetection.isMobile      : boolean
// mobileDetection.isIOS         : boolean
// mobileDetection.isAndroid     : boolean
// mobileDetection.deviceType    : 'ios' | 'android' | 'desktop' | 'unknown'
```

### Redirection Utility

```typescript
import { attemptMobileAppOpen, parseSearchParams } from '../utils/mobileRedirection';

// In useEffect or page load
if (mobileDetection.isMobile && !mobileState.hasAttemptedRedirect) {
  attemptMobileAppOpen(
    '/auth/verify',  // mobile path
    parseSearchParams(searchParams),  // parameters
    mobileDetection,
    {
      fallbackDelay: 2500,
      onAttempt: (customUrl) => console.log(`Attempt: ${customUrl}`),
      onFallback: () => console.log('App not detected, fallback web')
    }
  );
}
```

## 🎨 Mobile Fallback Component

Each page includes a fallback component that shows when mobile app is not detected:

```typescript
if (mobileState.showMobileFallback) {
  return (
    <div className="min-h-screen bg-gradient...">
      <Card>
        <CardHeader>
          <Smartphone className="h-12 w-12" />
          <CardTitle>Open in Mobile App</CardTitle>
          <CardDescription>
            It looks like you're on mobile but the app isn't installed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => window.open(App Store)}>
            Download on App Store
          </Button>
          <Button onClick={() => window.open(Play Store)}>
            Download on Google Play
          </Button>
          <Button onClick={() => setMobileState(prev => ({ ...prev, showMobileFallback: false }))}>
            Continue in Browser
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
```

## 🔄 Process to Add a New Page

1. **Identify web route** in `App.tsx`
2. **Add route to mapping** in `mobileRedirection.ts`:
   ```typescript
   const ROUTE_MAPPING: RouteMapping = {
     // ... existing routes
     '/new-route': '/new-route'
   };
   ```
3. **Add mobile detection** to page component:
   ```typescript
   import { useMobileDetection } from '../hooks/useMobileDetection';
   import { attemptMobileAppOpen, parseSearchParams } from '../utils/mobileRedirection';

   const mobileDetection = useMobileDetection();
   const [mobileState, setMobileState] = useState({
     hasAttemptedRedirect: false,
     showMobileFallback: false
   });

   useEffect(() => {
     if (mobileDetection.isMobile && !mobileState.hasAttemptedRedirect) {
       attemptMobileAppOpen('/new-route', parseSearchParams(searchParams), mobileDetection);
     }
   }, []);
   ```
4. **Add fallback component** as shown in examples above

## ⚙️ Backend Configuration

Backend uses these environment variables:
- `DEEP_LINK_BASE_URL` - Base URL for deep links (priority)
- `FRONTEND_URL` - Frontend URL (fallback)

**Backend generated URLs**:
```typescript
// Magic link
const magicLinkUrl = `${process.env.DEEP_LINK_BASE_URL}/auth/verify?token=${token}&inviteCode=${inviteCode}`;

// Family invitation
const familyInviteUrl = `${process.env.DEEP_LINK_BASE_URL}/families/join?code=${inviteCode}`;

// Group invitation
const groupInviteUrl = `${process.env.DEEP_LINK_BASE_URL}/groups/join?code=${inviteCode}`;
```

## 🔧 Testing and Debugging

### Debug Logs
- `📱 Attempting to open mobile app: {customUrl}`
- `📱 Mobile app not detected, continuing on web`

### Test Scenarios
1. **Desktop** → Normal web navigation
2. **Mobile with app installed** → Redirect to app
3. **Mobile without app** → Fallback with download prompt

### Testing Tools
- Chrome DevTools > Device Mode to simulate mobile
- Android/iOS emulators
- Real devices for final validation

## 🚨 Limitations and Notes

1. **iOS**: Redirect via `window.location.href` works well
2. **Android**: Uses `window.location.href` to detect if app is installed
3. **Fallback**: 2.5 second delay before showing fallback
4. **Security**: URLs are validated on backend to avoid dangerous protocols

## 📚 References

- [Custom URL Scheme Documentation](https://developer.apple.com/documentation/xcode/defining-a-custom-url-scheme-for-your-app)
- [Android App Links](https://developer.android.com/training/app-links)
- [React Router Documentation](https://reactrouter.com/)

---

**Last Updated**: 30/11/2025
**Owner**: Frontend Development EduLift