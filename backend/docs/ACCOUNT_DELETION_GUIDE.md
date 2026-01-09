# Account Deletion Guide

## Overview

EduLift implements a **secure 2-step account deletion flow** with PKCE (Proof Key for Code Exchange) protection to prevent accidental deletions and ensure user consent.

## Architecture

### Security Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    ACCOUNT DELETION SECURITY                    │
└─────────────────────────────────────────────────────────────────┘

Layer 1: JWT Authentication (both steps)
├── DELETE-REQUEST: User must be logged in
└── DELETE-CONFIRM: User must be logged in (same device as request)

Layer 2: PKCE Protection
├── code_challenge: Sent during request (step 1)
└── code_verifier: Required during confirmation (step 2)

Layer 3: Email Token
├── Secure token sent to user's email
└── Token must be presented during confirmation (step 2)

Layer 4: Token Expiration
├── Email token expires after 1 hour (configurable)
└── Prevents delayed/accidental confirmations
```

## API Endpoints

### Step 1: Request Deletion

**Endpoint**: `POST /auth/profile/delete-request`

**Authentication**: Required (JWT)

**Request Body**:
```json
{
  "code_challenge": "aB3dE5fG7hJ9kLmNoPqRsTuVwXyZ1234567890ABCDEFG"
}
```

**PKCE Requirements**:
- `code_challenge` must be 43-128 characters (required)
- Generated as: `code_challenge = BASE64URL(SHA256(code_verifier))`
- `code_verifier` must be stored securely on client side

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "message": "Deletion confirmation email sent"
  }
}
```

**Security Validations**:
1. ✅ JWT token is valid and not expired
2. ✅ User account exists and is active
3. ✅ PKCE code_challenge is present and valid length
4. ✅ No pending deletion request already exists
5. ✅ Rate limiting applied (max 1 request per hour)

**Email Sent**:
```email
Subject: Confirm your EduLift account deletion

Hello [User Name],

You requested to delete your EduLift account. This action is irreversible and will permanently delete:
- Your profile and personal information
- Your family membership
- Your vehicles and children data
- All your scheduling data

To confirm, click the link below (valid for 1 hour):
[Confirm Account Deletion]

If you did not request this, please ignore this email.

Best regards,
The EduLift Team
```

### Step 2: Confirm Deletion

**Endpoint**: `POST /auth/profile/delete-confirm`

**Authentication**: Required (JWT)

**Request Body**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "code_verifier": "aB3dE5fG7hJ9kLmNoPqRsTuVwXyZ1234567890ABCDEFG"
}
```

**Parameters**:
- `token`: Secure token received in email (required)
- `code_verifier`: Original PKCE verifier generated during request (required)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "message": "Account deleted successfully",
    "deletedAt": "2026-01-09T12:34:56.789Z"
  }
}
```

**Security Validations**:
1. ✅ JWT token is valid and not expired
2. ✅ User account exists and is active
3. ✅ PKCE code_verifier matches code_challenge from step 1
4. ✅ Email token is valid and not expired
5. ✅ Email token has not been used before (one-time use)
6. ✅ Email token belongs to the authenticated user
7. ✅ Request is made from same device as step 1 (PKCE enforcement)

**Deletion Process** (atomic transaction):
1. Invalidate all JWT access tokens
2. Invalidate all refresh tokens
3. Remove user from all group memberships
4. Remove user from all family memberships
5. If user was last family member: delete family, vehicles, children
6. Delete user account record
7. Log deletion event for audit

**Error Responses**:
```json
// Token expired
{
  "success": false,
  "error": "Deletion token has expired. Please request a new one.",
  "code": "TOKEN_EXPIRED"
}

// Invalid PKCE
{
  "success": false,
  "error": "Invalid PKCE verification code",
  "code": "INVALID_PKCE_VERIFIER"
}

// Token already used
{
  "success": false,
  "error": "Deletion token has already been used",
  "code": "TOKEN_ALREADY_USED"
}

// Token not found
{
  "success": false,
  "error": "Invalid or expired deletion token",
  "code": "INVALID_TOKEN"
}
```

## Client Implementation Guide

### PKCE Implementation (TypeScript)

```typescript
// Generate PKCE pair
async function generatePKCE() {
  // Generate random code_verifier (43-128 characters)
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const code_verifier = base64UrlEncode(array);

  // Calculate code_challenge
  const encoder = new TextEncoder();
  const data = encoder.encode(code_verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const code_challenge = base64UrlEncode(hash);

  return { code_verifier, code_challenge };
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
```

### Step 1: Request Deletion

```typescript
// Store code_verifier securely (localStorage/sessionStorage)
async function requestAccountDeletion() {
  const { code_verifier, code_challenge } = await generatePKCE();

  // Store verifier for confirmation step
  sessionStorage.setItem('deletion_code_verifier', code_verifier);

  const response = await fetch('/api/v1/auth/profile/delete-request', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code_challenge }),
  });

  const result = await response.json();
  if (result.success) {
    // Show message: "Check your email to confirm deletion"
  }
}
```

### Step 2: Confirm Deletion

```typescript
// Extract token from email link (e.g., ?token=XYZ)
async function confirmAccountDeletion(tokenFromEmail: string) {
  const code_verifier = sessionStorage.getItem('deletion_code_verifier');

  if (!code_verifier) {
    // Error: Cannot confirm - original request not found
    // User must request deletion again
    return;
  }

  const response = await fetch('/api/v1/auth/profile/delete-confirm', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token: tokenFromEmail,
      code_verifier,
    }),
  });

  const result = await response.json();

  if (result.success) {
    // Clear stored verifier
    sessionStorage.removeItem('deletion_code_verifier');
    // Redirect to login/signup page
    window.location.href = '/login?account-deleted=true';
  }
}
```

## Security Considerations

### Why JWT + PKCE + Email Token?

**JWT Authentication (Required)**:
- Ensures user is logged in for both steps
- Prevents anonymous deletion requests
- Prevents cross-device confirmation (must be same device)

**PKCE Protection**:
- Prevents token interception attacks
- Even if email link is intercepted, attacker cannot confirm without code_verifier
- code_verifier never leaves the client device

**Email Token**:
- Provides explicit user consent (GDPR compliance)
- Prevents accidental deletions
- Creates audit trail

**Three-Layer Security = Defense in Depth**:
```
Attacker would need:
1. Valid JWT token (logged in as victim) ✗
2. Access to victim's email (for email token) ✗
3. Access to victim's device (for code_verifier) ✗
```

### Token Storage

**Database** (SecureToken table):
```sql
CREATE TABLE SecureToken (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,  -- 'ACCOUNT_DELETION'
  userId TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  codeChallenge TEXT NOT NULL,
  expiresAt DATETIME NOT NULL,
  usedAt DATETIME,  -- NULL until token is used
  createdAt DATETIME NOT NULL,
  FOREIGN KEY (userId) REFERENCES User(id)
);
```

**Client** (Temporary):
- `code_verifier`: Session storage (cleared on browser close)
- Recommended: Use secure storage (Keychain on iOS, Keystore on Android)

### Rate Limiting

```
DELETE-REQUEST:
- Max 1 request per hour per user
- Prevents email spam

DELETE-CONFIRM:
- Max 5 attempts per token
- Prevents brute force attacks
```

## GDPR Compliance

### Right to be Forgotten

✅ **All user data is permanently deleted**:
- User profile (name, email, timezone)
- Family memberships
- Group memberships
- Associated vehicles and children (if last family member)
- All scheduling data
- Secure tokens

❌ **Data retained for legal/security reasons**:
- Audit logs (deletion event, timestamp, IP)
- Aggregate statistics (user counts, not identifiable)

### Consent Documentation

Each deletion creates an audit log entry:
```json
{
  "event": "ACCOUNT_DELETED",
  "userId": "cl123...",
  "timestamp": "2026-01-09T12:34:56.789Z",
  "method": "email_confirmation",
  "ip": "192.168.1.1",
  "userAgent": "Mozilla/5.0...",
  "tokenHash": "sha256(deletion_token)"
}
```

## Testing

### Manual Testing Flow

```bash
# 1. Login and get JWT
POST /auth/magic-link
→ Receive JWT token

# 2. Request deletion with PKCE
POST /auth/profile/delete-request
Headers: Authorization: Bearer <JWT>
Body: { "code_challenge": "..." }
→ Receive email

# 3. Extract token from email
→ Copy token from email link

# 4. Confirm deletion
POST /auth/profile/delete-confirm
Headers: Authorization: Bearer <JWT>
Body: { "token": "...", "code_verifier": "..." }
→ Account deleted

# 5. Verify deletion
POST /auth/magic-link (with same email)
→ Should work (account deleted, can recreate)
```

### Automated Tests

See: `backend/src/controllers/__tests__/AuthController.test.ts`

```typescript
describe('Account Deletion', () => {
  it('should request deletion with valid PKCE', async () => {
    // Test request deletion endpoint
  });

  it('should confirm deletion with valid token and PKCE', async () => {
    // Test confirm deletion endpoint
  });

  it('should reject confirmation without JWT', async () => {
    // Test that JWT is required
  });

  it('should reject confirmation with invalid PKCE', async () => {
    // Test PKCE validation
  });

  it('should delete all user data atomically', async () => {
    // Test complete data deletion
  });
});
```

## Configuration

Environment variables (`.env`):

```bash
# Token expiration times
ACCOUNT_DELETION_TOKEN_EXPIRES_IN=1h    # Email token validity

# Rate limiting
ACCOUNT_DELETION_MAX_REQUESTS_PER_HOUR=1
ACCOUNT_DELETION_MAX_CONFIRM_ATTEMPTS=5

# Security
PKCE_CODE_VERIFIER_MIN_LENGTH=43
PKCE_CODE_VERIFIER_MAX_LENGTH=128
```

## Troubleshooting

### Common Issues

**1. "Missing PKCE verifier" error**
- Cause: code_verifier not stored or cleared from session
- Solution: Ensure client stores code_verifier in sessionStorage during request

**2. "Invalid PKCE verification code" error**
- Cause: code_verifier doesn't match code_challenge
- Solution: Regenerate PKCE pair and request deletion again

**3. "Token expired" error**
- Cause: Email token expired (default 1 hour)
- Solution: User must request new deletion email

**4. "JWT required" error**
- Cause: User not logged in during confirmation
- Solution: User must login before confirming deletion

**5. Cross-device confirmation fails**
- Cause: PKCE code_verifier is device-specific
- Solution: This is expected behavior - user must confirm on same device

## Related Documentation

- [Authentication Guide](./AUTHENTICATION.md) - JWT and magic link authentication
- [Security Best Practices](./SECURITY.md) - Overall security architecture
- [GDPR Compliance](./GDPR_COMPLIANCE.md) - Data privacy and user rights
- [API Documentation](../docs/API-Documentation.md) - Complete API reference

## Changelog

### 2026-01-09
- **BREAKING**: Changed `delete-confirm` from public to JWT-protected
- Rationale: PKCE already enforces same-device, JWT adds security layer
- Impact: Clients must include valid JWT in confirmation request
- Migration: Update client to include JWT header in confirmation request

### Previous versions
- Initial implementation with PKCE and email tokens
- Rate limiting and audit logging
- GDPR compliance features
