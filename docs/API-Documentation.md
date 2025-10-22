# EduLift - API Documentation

## Table of Contents
1. [API Overview](#api-overview)
2. [Authentication](#authentication)
3. [Error Handling](#error-handling)
4. [Family Management API](#family-management-api)
5. [Group Management API](#group-management-api)
6. [Children Management API](#children-management-api)
7. [Vehicle Management API](#vehicle-management-api)
8. [Schedule Management API](#schedule-management-api)
9. [Dashboard API](#dashboard-api)
10. [Real-Time WebSocket API](#real-time-websocket-api)
11. [Rate Limiting](#rate-limiting)
12. [API Versioning](#api-versioning)

---

## API Overview

EduLift provides a RESTful API with real-time WebSocket support for collaborative transportation management. The API follows semantic versioning and uses JWT for authentication.

### Base URL
```
Production: https://api.edulift.com/api/v1
Development: http://localhost:3001/api/v1
```

### Content Type
All API requests should use `application/json` content type unless otherwise specified.

### Standard Response Format
```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  validationErrors?: ValidationError[];
  metadata?: {
    timestamp: string;
    requestId: string;
    version: string;
  };
}

interface ValidationError {
  field: string;
  message: string;
}
```

**Note:** The actual implementation uses a simplified error format with `error` as a string and optional `validationErrors` array for validation failures.

---

## Authentication

EduLift uses passwordless authentication via magic links and JWT tokens for API access.

### Magic Link Authentication

#### Send Magic Link
```http
POST /api/v1/auth/magic-link
Content-Type: application/json

{
  "email": "user@example.com",
  "name": "John Doe",
  "inviteCode": "ABC123XYZ",
  "platform": "native",
  "code_challenge": "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
}
```

**Request Parameters:**
- `email` (required): User's email address
- `name` (optional): User's display name (for new users)
- `inviteCode` (optional): Invitation code to be processed after authentication
- `platform` (optional): Platform type for magic link generation (`web` | `native`). Default: `web`
- `code_challenge` (required): PKCE code challenge (RFC 7636). SHA256 hash of code_verifier, base64url encoded (43-128 chars)

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Magic link sent to your email",
    "expiresIn": 900
  }
}
```

#### Verify Magic Link
```http
POST /api/v1/auth/verify
Content-Type: application/json

{
  "token": "magic-link-token-from-email",
  "code_verifier": "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
}
```

**Request Parameters:**
- `token` (required): Magic link token from email
- `code_verifier` (required): PKCE code verifier (RFC 7636). Random string (43-128 chars) used to generate code_challenge

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user123",
      "email": "user@example.com",
      "name": "John Doe",
      "createdAt": "2024-01-15T10:00:00Z"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
      "expiresIn": 86400
    }
  }
}
```

### Token Management

#### Refresh Access Token
```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### Logout
```http
POST /api/v1/auth/logout
Authorization: Bearer {accessToken}
```

#### Update Profile
Update the authenticated user's profile information.

```http
PUT /api/v1/auth/profile
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "name": "Updated Name",
  "email": "updated@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user123",
      "email": "updated@example.com",
      "name": "Updated Name"
    }
  }
}
```

#### Test Configuration
Test endpoint to verify email service configuration (development/debugging).

```http
GET /api/v1/auth/test-config
```

**Response:**
```json
{
  "success": true,
  "data": {
    "nodeEnv": "development",
    "emailUser": "SET",
    "hasCredentials": true,
    "mockServiceTest": "Working v2"
  }
}
```

### Authorization Header
All authenticated requests must include the JWT token:
```http
Authorization: Bearer {accessToken}
```

### Deep Link Support

EduLift supports deep links for native mobile applications using the `edulift://` scheme. When `platform: "native"` is specified in API requests, email notifications will contain deep links instead of web URLs.

#### Supported Deep Link Formats

| Action | Web URL | Native Deep Link |
|--------|---------|------------------|
| Magic Link Auth | `/auth/verify?token=XXX` | `edulift://auth/verify?token=XXX` |
| Magic Link + Invite | `/auth/verify?token=XXX&inviteCode=YYY` | `edulift://auth/verify?token=XXX&inviteCode=YYY` |
| Family Invitation | `/families/join?code=XXX` | `edulift://families/join?code=XXX` |
| Group Invitation | `/groups/join?code=XXX` | `edulift://groups/join?code=XXX` |
| Dashboard | `/dashboard` | `edulift://dashboard` |
| Schedule View | `/groups/{id}/schedule` | `edulift://groups/{id}/schedule` |

#### Platform Parameter

Most invitation and notification endpoints accept an optional `platform` parameter:
- `web` (default): Generates standard HTTP URLs for web browsers
- `native`: Generates `edulift://` deep links for mobile applications

#### Examples

**Native Magic Link:**
```json
{
  "email": "user@example.com",
  "platform": "native"
}
```
Result: Email contains `edulift://auth/verify?token=...`

**Native Magic Link with Invitation:**
```json
{
  "email": "user@example.com",
  "inviteCode": "ABC123XYZ",
  "platform": "native"
}
```
Result: Email contains `edulift://auth/verify?token=...&inviteCode=ABC123XYZ`

This allows the mobile app to handle both authentication and invitation processing in a single flow.

### PKCE Security Implementation

EduLift implements **PKCE (Proof Key for Code Exchange)** following RFC 7636 to secure magic link authentication against cross-user attacks and CSRF vulnerabilities.

#### Security Architecture

PKCE binds each magic link to a cryptographically secure challenge, preventing unauthorized access even if magic links are intercepted:

1. **Client generates PKCE pair**: code_verifier (random) + code_challenge (SHA256 hash)
2. **Store verifier locally**: Never transmitted over network or email
3. **Send challenge to server**: Included with magic link request
4. **Server stores challenge**: Bound to specific magic link token
5. **Client proves possession**: Must provide verifier during verification
6. **Server validates**: Verifies verifier generates the stored challenge

#### PKCE Flow Example

**Step 1: Generate PKCE Pair (Client-side)**
```javascript
// Frontend/Mobile: Generate PKCE pair
const pkcePair = await generatePKCEPair(); 
// {
//   code_verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
//   code_challenge: "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
// }

// Store verifier securely (localStorage/keychain)
storePKCEPair(pkcePair, email);
```

**Step 2: Request Magic Link (with PKCE Challenge)**
```http
POST /api/v1/auth/magic-link
Content-Type: application/json

{
  "email": "user@example.com",
  "code_challenge": "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
}
```

**Step 3: Verify Magic Link (with PKCE Verifier)**
```http
POST /api/v1/auth/verify
Content-Type: application/json

{
  "token": "magic-link-token",
  "code_verifier": "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"
}
```

#### PKCE Error Responses

**Invalid PKCE Challenge:**
```json
{
  "success": false,
  "error": "PKCE_CHALLENGE_INVALID",
  "message": "code_challenge must be 43-128 characters, base64url encoded"
}
```

**Missing PKCE Verifier:**
```json
{
  "success": false,
  "error": "PKCE_VERIFIER_REQUIRED", 
  "message": "code_verifier is required for magic link verification"
}
```

**PKCE Validation Failed:**
```json
{
  "success": false,
  "error": "PKCE_VALIDATION_FAILED",
  "message": "Authentication failed. Please try again."
}
```

#### Security Benefits

- **Cross-User Protection**: User A cannot use User B's magic link
- **CSRF Prevention**: Random verifiers prevent request forgery
- **Interception Safe**: Magic links useless without locally stored verifier
- **RFC 7636 Compliant**: Industry standard OAuth2 security extension
- **Zero User Impact**: Completely transparent to end users

#### Client Implementation Notes

**Frontend (React)**
- Uses `pkce-challenge` library (5M+ downloads/week)
- Stores PKCE data in localStorage with email validation
- Automatic cleanup after successful authentication

**Mobile (Flutter)**
- Uses standard Dart `crypto` library (built-in)
- Secure storage via flutter_secure_storage
- Full deep link support with PKCE validation

**Error Handling**
- Network failures: Retry with same verifier
- Storage issues: Generate new PKCE pair
- Validation errors: Clear storage and start over

---

## Error Handling

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Specific field error details"
    }
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "requestId": "req_123456",
    "version": "v1"
  }
}
```

### Common Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | VALIDATION_ERROR | Request validation failed |
| 401 | UNAUTHORIZED | Authentication required |
| 403 | INSUFFICIENT_PERMISSIONS | User lacks required permissions |
| 404 | RESOURCE_NOT_FOUND | Requested resource not found |
| 409 | CONFLICT | Resource conflict (e.g., duplicate) |
| 422 | BUSINESS_LOGIC_ERROR | Business rule violation |
| 429 | RATE_LIMIT_EXCEEDED | Too many requests |
| 500 | INTERNAL_SERVER_ERROR | Server error |

### PKCE-Specific Error Codes
| Error Code | Description |
|------------|-------------|
| PKCE_CHALLENGE_REQUIRED | code_challenge parameter is required for magic link requests |
| PKCE_VERIFIER_REQUIRED | code_verifier parameter is required for verification |
| PKCE_VALIDATION_FAILED | code_verifier does not match the stored code_challenge |
| PKCE_CHALLENGE_INVALID | code_challenge format is invalid (must be 43-128 chars, base64url) |
| PKCE_VERIFIER_INVALID | code_verifier format is invalid (must be 43-128 chars) |

### Family-Specific Error Codes
- `FAMILY_NOT_FOUND`: Family does not exist
- `NOT_FAMILY_MEMBER`: User is not a member of the family
- `MEMBER_LIMIT_EXCEEDED`: Family has reached maximum members (6)
- `INVALID_INVITE_CODE`: Invite code is invalid or expired
- `ADMIN_REQUIRED`: Operation requires family admin role
- `USER_ALREADY_IN_FAMILY`: User already belongs to another family
- `INVITATION_ALREADY_EXISTS`: A pending invitation already exists for this email

### Schedule-Specific Error Codes
- `VEHICLE_CAPACITY_EXCEEDED`: Assignment would exceed vehicle capacity
- `VEHICLE_CONFLICT`: Vehicle already assigned to overlapping time slot
- `DRIVER_UNAVAILABLE`: Driver already assigned to another slot
- `CHILD_ALREADY_ASSIGNED`: Child already assigned to a vehicle for this slot

---

## Family Management API

### Create Family
Creates a new family with the authenticated user as admin.

```http
POST /api/v1/families
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "The Smith Family"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "family": {
      "id": "family123",
      "name": "The Smith Family",
      "inviteCode": "ABC123XYZ",
      "createdAt": "2024-01-15T10:00:00Z",
      "members": [
        {
          "id": "member123",
          "userId": "user123",
          "role": "ADMIN",
          "joinedAt": "2024-01-15T10:00:00Z",
          "user": {
            "id": "user123",
            "name": "John Doe",
            "email": "john@example.com"
          }
        }
      ]
    }
  }
}
```

### Get Current Family
Retrieves the family the authenticated user belongs to.

```http
GET /api/v1/families/current
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "family": {
      "id": "family123",
      "name": "The Smith Family",
      "inviteCode": "ABC123XYZ",
      "members": [...],
      "children": [...],
      "vehicles": [...]
    }
  }
}
```

### Validate Invite Code
Validate a family invite code with intelligent user detection (public endpoint) - supports unified invitation system.

```http
POST /api/v1/families/validate-invite
Content-Type: application/json

{
  "inviteCode": "ABC123XYZ789"
}
```

**Response (Valid - Comprehensive):**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "familyId": "family123",
    "familyName": "The Smith Family",
    "role": "MEMBER",
    "personalMessage": "Welcome to our family!",
    "email": "user@example.com",
    "existingUser": true,
    "userCurrentFamily": {
      "id": "family456",
      "name": "Current Family",
      "userRole": "ADMIN"
    }
  }
}
```

**Response (Valid - New User):**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "familyId": "family123",
    "familyName": "The Smith Family",
    "role": "MEMBER",
    "personalMessage": "Welcome to our family!",
    "email": "newuser@example.com",
    "existingUser": false,
    "userCurrentFamily": null
  }
}
```

**Response (Invalid/Expired):**
```json
{
  "success": false,
  "data": {
    "valid": false,
    "error": "Invalid or expired invitation code",
    "errorCode": "EXPIRED"
  }
}
```

**Response (Email Mismatch - Security):**
```json
{
  "success": false,
  "data": {
    "valid": false,
    "error": "This invitation was sent to a different email address. Please log in with the correct account or sign up.",
    "errorCode": "EMAIL_MISMATCH"
  }
}
```

**Advanced Features:**
- **Intelligent User Detection**: Automatically detects if invitation recipient exists and their family status
- **Security**: Prevents invitation hijacking through email validation
- **Context Preservation**: Provides all necessary information for frontend to render appropriate interface
- **Family Conflict Detection**: Identifies when user already belongs to another family
- **Public Access**: No authentication required for validation (security through invitation codes)
- **Error Codes**: Structured error responses for different failure scenarios

**Error Codes:**
- `EXPIRED`: Invitation has expired (past 7 days)
- `CANCELLED`: Invitation was cancelled by family admin
- `INVALID`: Invalid invitation code format
- `FAMILY_FULL`: Target family has reached maximum capacity
- `EMAIL_MISMATCH`: Authenticated user email doesn't match invitation email

### Join Family
Join an existing family using an invite code.

```http
POST /api/v1/families/join
Authorization: Bearer {token}
Content-Type: application/json

{
  "inviteCode": "ABC123XYZ"
}
```

### Update Family Name
Update family name (admin only).

```http
PUT /api/v1/families/name
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "The Updated Smith Family"
}
```

### Generate Invite Code
Generate a new invite code for the family (admin only).

```http
POST /api/v1/families/invite-code
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "inviteCode": "ABC123XYZ",
    "expiresAt": "2024-01-22T10:00:00Z"
  }
}
```

### Get User Permissions
Get the current user's permissions within a specific family.

```http
GET /api/v1/families/{familyId}/permissions
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "canManageFamily": true,
    "canInviteMembers": true,
    "canManageChildren": true,
    "canManageVehicles": true,
    "role": "ADMIN"
  }
}
```

### Invite Family Member
Invite a new member to the family (admin only).

```http
POST /api/v1/families/{familyId}/invite
Authorization: Bearer {token}
Content-Type: application/json

{
  "email": "newmember@example.com",
  "role": "MEMBER", // Optional: ADMIN | MEMBER (default: MEMBER)
  "personalMessage": "Bienvenue dans notre famille !", // Optional
  "platform": "native" // Optional: web | native (default: web)
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "inviteCode": "ABC123XYZ",
    "email": "newmember@example.com",
    "invitationId": "invitation123"
  },
  "message": "Invitation sent successfully"
}
```

**Errors:**
- `400` - Email required or invalid role
- `403` - Only family admins can invite members
- `400` - User already belongs to a family
- `400` - Invitation already pending for this email
- `400` - Family full (6 member limit)

### Get Pending Invitations
List all pending (non-expired) invitations for the family.

```http
GET /api/v1/families/{familyId}/invitations
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "invitation123",
      "email": "newmember@example.com",
      "role": "MEMBER",
      "personalMessage": "Bienvenue dans notre famille !",
      "status": "PENDING",
      "inviteCode": "ABC123XYZ",
      "expiresAt": "2025-06-23T10:30:00.000Z",
      "createdAt": "2025-06-16T10:30:00.000Z",
      "invitedByUser": {
        "id": "user123",
        "name": "Admin User",
        "email": "admin@example.com"
      }
    }
  ]
}
```

### Cancel Invitation
Cancel a pending invitation (admin only).

```http
DELETE /api/v1/families/{familyId}/invitations/{invitationId}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Invitation cancelled successfully"
}
```

**Errors:**
- `403` - Only family admins can cancel invitations
- `404` - Invitation not found or already processed

### Update Member Role
Update a family member's role (admin only).

```http
PUT /api/v1/families/members/{memberId}/role
Authorization: Bearer {token}
Content-Type: application/json

{
  "role": "ADMIN"
}
```

### Remove Family Member
Remove a member from the family (admin only).

```http
DELETE /api/v1/families/{familyId}/members/{memberId}
Authorization: Bearer {token}
```

### Leave Family
Leave the current family (member action).

```http
POST /api/v1/families/{familyId}/leave
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully left the family"
}
```

---

## Group Management API

### Create Group
Create a new coordination group.

```http
POST /api/v1/groups
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Elementary School Carpool",
  "description": "Morning and afternoon transportation for elementary students"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "group": {
      "id": "group123",
      "name": "Elementary School Carpool",
      "description": "Morning and afternoon transportation for elementary students",
      "inviteCode": "GRP456ABC",
      "adminId": "user123",
      "createdAt": "2024-01-15T10:00:00Z"
    }
  }
}
```

### Get User's Groups
Retrieve all groups the authenticated user is a member of.

```http
GET /api/v1/groups/my-groups
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "groups": [
      {
        "id": "group123",
        "name": "Elementary School Carpool",
        "role": "ADMIN",
        "memberCount": 5,
        "activeSchedules": 2
      }
    ]
  }
}
```

### Join Group
Join an existing group using invite code.

```http
POST /api/v1/groups/join
Authorization: Bearer {token}
Content-Type: application/json

{
  "inviteCode": "GRP456ABC"
}
```

### Leave Group
Leave a group (member action).

```http
POST /api/v1/groups/{groupId}/leave
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully left the group"
}
```

### Update Group
Update group information (admin only).

```http
PATCH /api/v1/groups/{groupId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Updated Group Name",
  "description": "Updated description"
}
```

### Get Group Families
Retrieve all families in a group with their roles and permissions.

```http
GET /api/v1/groups/{groupId}/families
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "family123",
      "name": "Famille Dupont",
      "role": "OWNER",
      "isMyFamily": true,
      "canManage": false,
      "adminName": "John Dupont",
      "adminEmail": "john@dupont.fr"
    },
    {
      "id": "family456", 
      "name": "Famille Martin",
      "role": "MEMBER",
      "isMyFamily": false,
      "canManage": true,
      "adminName": "Marie Martin",
      "adminEmail": "marie@martin.fr"
    }
  ]
}
```

**Response Fields:**
- `id`: Family identifier
- `name`: Family display name
- `role`: Family role in group (`OWNER` | `ADMIN` | `MEMBER`)
- `isMyFamily`: Boolean indicating if this is the requesting user's family
- `canManage`: Boolean indicating if the requesting user can manage this family
- `adminName`: Name of family admin (for contact purposes)
- `adminEmail`: Email of family admin (only shown for own family due to privacy)

### Update Family Role in Group
Change a family's role within a group (Owner families only).

```http
PATCH /api/v1/groups/{groupId}/families/{familyId}/role
Authorization: Bearer {token}
Content-Type: application/json

{
  "role": "ADMIN"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Family role updated successfully"
  }
}
```

**Validation Rules:**
- Only Owner families can change roles
- Cannot change own family's role
- Cannot demote last Owner family

### Remove Family from Group
Remove a family from a group (Owner families only).

```http
DELETE /api/v1/groups/{groupId}/families/{familyId}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Family removed from group successfully"
  }
}
```

**Validation Rules:**
- Only Owner families can remove other families
- Cannot remove own family
- Cannot remove last Owner family

### Validate Group Invite Code
Validate a group invitation code (public endpoint).

```http
POST /api/v1/groups/validate-invite
Content-Type: application/json

{
  "inviteCode": "GRP456ABC"
}
```

### Validate Group Invite Code (Authenticated)
Validate a group invitation code with user context (authenticated endpoint).

```http
POST /api/v1/groups/validate-invite-auth
Authorization: Bearer {token}
Content-Type: application/json

{
  "inviteCode": "GRP456ABC"
}
```

**Response (With User Context):**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "group": {
      "id": "group123",
      "name": "Elementary School Carpool"
    },
    "userStatus": "FAMILY_MEMBER",
    "familyInfo": {
      "id": "family123",
      "name": "The Smith Family",
      "role": "ADMIN"
    },
    "canAccept": true,
    "actionRequired": "READY_TO_JOIN"
  }
}
```

### Search Families
Search for families to invite to the group (admin only).

```http
POST /api/v1/groups/{groupId}/search-families
Authorization: Bearer {token}
Content-Type: application/json

{
  "query": "smith",
  "limit": 10
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "families": [
      {
        "id": "family123",
        "name": "The Smith Family",
        "adminName": "John Smith",
        "adminEmail": "john@smith.com",
        "memberCount": 3
      }
    ]
  }
}
```

### Invite Family to Group
Invite a family to join the group (admin only).

```http
POST /api/v1/groups/{groupId}/invite
Authorization: Bearer {token}
Content-Type: application/json

{
  "familyId": "family123",
  "role": "MEMBER",
  "personalMessage": "Welcome to our carpool group!",
  "platform": "native"
}
```

**Request Parameters:**
- `familyId` (required): ID of the family to invite to the group
- `role` (optional): Role to assign (`ADMIN` | `MEMBER`). Default: `MEMBER`
- `personalMessage` (optional): Custom message to include in invitation
- `platform` (optional): Platform type for invitation URL generation (`web` | `native`). Default: `web`
  - `web`: Generates `https://app.edulift.com/groups/join?code=XXX`
  - `native`: Generates `edulift://groups/join?code=XXX` for mobile app deep linking

### Get Pending Invitations
Get all pending invitations for the group (admin only).

```http
GET /api/v1/groups/{groupId}/invitations
Authorization: Bearer {token}
```

### Cancel Group Invitation
Cancel a pending group invitation (admin only).

```http
DELETE /api/v1/groups/{groupId}/invitations/{invitationId}
Authorization: Bearer {token}
```


---

## Invitations Management API

EduLift has a unified invitation system that handles both family and group invitations.

### Validate Universal Invite Code
Validates any invitation code (family or group) with intelligent context detection.

```http
POST /api/v1/invitations/validate
Content-Type: application/json

{
  "inviteCode": "ABC123XYZ"
}
```

**Response (Family Invitation):**
```json
{
  "success": true,
  "data": {
    "type": "FAMILY",
    "valid": true,
    "familyId": "family123",
    "familyName": "The Smith Family",
    "role": "MEMBER",
    "email": "user@example.com",
    "existingUser": true
  }
}
```

**Response (Group Invitation):**
```json
{
  "success": true,
  "data": {
    "type": "GROUP",
    "valid": true,
    "groupId": "group123",
    "groupName": "Elementary School Carpool",
    "role": "MEMBER",
    "requiresFamily": true
  }
}
```

---

## Children Management API

### Get Family Children
Retrieve all children in the user's family.

```http
GET /api/v1/children
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "children": [
      {
        "id": "child123",
        "name": "Emma Smith",
        "age": 8,
        "familyId": "family123",
        "createdAt": "2024-01-15T10:00:00Z",
        "groupMemberships": [
          {
            "groupId": "group123",
            "groupName": "Elementary School Carpool",
            "addedAt": "2024-01-15T11:00:00Z"
          }
        ]
      }
    ]
  }
}
```

### Add Child
Add a new child to the family.

```http
POST /api/v1/children
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Emma Smith",
  "age": 8,
  "schoolInfo": "Greenwood Elementary, Grade 3"
}
```

### Update Child
Update child information.

```http
PATCH /api/v1/children/{childId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Emma Jane Smith",
  "age": 9,
  "schoolInfo": "Greenwood Elementary, Grade 4"
}
```

### Delete Child
Remove a child from the family.

```http
DELETE /api/v1/children/{childId}
Authorization: Bearer {token}
```

---

## Vehicle Management API

### Get Family Vehicles
Retrieve all vehicles in the user's family.

```http
GET /api/v1/vehicles
Authorization: Bearer {token}
```

### Get Vehicle Details
Get details for a specific vehicle.

```http
GET /api/v1/vehicles/{vehicleId}
Authorization: Bearer {token}
```

### Get Vehicle Weekly Schedule
Get a vehicle's schedule for a specific week.

```http
GET /api/v1/vehicles/{vehicleId}/schedule?week={week}
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "vehicles": [
      {
        "id": "vehicle123",
        "name": "Honda CR-V",
        "capacity": 7,
        "familyId": "family123",
        "createdAt": "2024-01-15T10:00:00Z",
        "currentAssignments": 2,
        "upcomingTrips": [
          {
            "date": "2024-01-16",
            "time": "08:00",
            "groupName": "Elementary School Carpool"
          }
        ]
      }
    ]
  }
}
```

### Add Vehicle
Add a new vehicle to the family.

```http
POST /api/v1/vehicles
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Honda CR-V",
  "capacity": 7,
  "description": "Blue SUV, license plate ABC-123"
}
```

### Update Vehicle
Update vehicle information.

```http
PATCH /api/v1/vehicles/{vehicleId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Honda CR-V (Updated)",
  "capacity": 8,
  "description": "Blue SUV with updated capacity"
}
```

### Delete Vehicle
Remove a vehicle from the family.

```http
DELETE /api/v1/vehicles/{vehicleId}
Authorization: Bearer {token}
```

---

## Schedule Management API

### Get Group Schedule
Retrieve the schedule for a specific group and date range.

```http
GET /api/v1/groups/{groupId}/schedule-slots?startDate={startDate}&endDate={endDate}
Authorization: Bearer {token}
```

**Query Parameters:**
- `startDate` (optional): Start date in ISO 8601 format
- `endDate` (optional): End date in ISO 8601 format

**Response:**
```json
{
  "success": true,
  "data": {
    "scheduleSlots": [
      {
        "id": "slot123",
        "groupId": "group123",
        "day": "MONDAY",
        "time": "08:00",
        "week": "2024-W03",
        "vehicleAssignments": [
          {
            "id": "assign123",
            "vehicleId": "vehicle123",
            "driverId": "user123",
            "vehicle": {
              "id": "vehicle123",
              "name": "Honda CR-V",
              "capacity": 7
            },
            "driver": {
              "id": "user123",
              "name": "John Doe"
            },
            "childAssignments": [
              {
                "childId": "child123",
                "child": {
                  "id": "child123",
                  "name": "Emma Smith",
                  "age": 8
                }
              }
            ]
          }
        ]
      }
    ]
  }
}
```

### Create Schedule Slot with Vehicle
Create a new time slot for transportation with initial vehicle assignment.

```http
POST /api/v1/groups/{groupId}/schedule-slots
Authorization: Bearer {token}
Content-Type: application/json

{
  "datetime": "2025-06-30T06:00:00.000Z",
  "vehicleId": "vehicle123",
  "driverId": "user123",
  "seatOverride": 8
}
```

**Note:** Vehicle assignment is required when creating a schedule slot.

### Update Schedule Slot
Update an existing schedule slot.

```http
PATCH /api/v1/schedule-slots/{slotId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "time": "08:15"
}
```

### Delete Schedule Slot
Remove a schedule slot and all its assignments.

```http
DELETE /api/v1/schedule-slots/{slotId}
Authorization: Bearer {token}
```

### Assign Vehicle to Slot
Assign a vehicle and driver to a time slot.

```http
POST /api/v1/schedule-slots/{slotId}/vehicles
Authorization: Bearer {token}
Content-Type: application/json

{
  "vehicleId": "vehicle123",
  "driverId": "user123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "assignment": {
      "id": "assign123",
      "scheduleSlotId": "slot123",
      "vehicleId": "vehicle123",
      "driverId": "user123",
      "availableSeats": 7,
      "createdAt": "2024-01-15T10:00:00Z"
    }
  }
}
```

### Remove Vehicle from Slot
Remove a vehicle assignment from a time slot.

```http
DELETE /api/v1/schedule-slots/{slotId}/vehicles/{vehicleAssignmentId}
Authorization: Bearer {token}
```

### Assign Child to Vehicle
Assign a child to a specific vehicle in a schedule slot.

```http
POST /api/v1/schedule-slots/{scheduleSlotId}/assign-child
Authorization: Bearer {token}
Content-Type: application/json

{
  "childId": "child123",
  "vehicleAssignmentId": "assign123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "assignment": {
      "id": "childAssign123",
      "childId": "child123",
      "vehicleAssignmentId": "assign123",
      "assignedAt": "2024-01-15T10:00:00Z"
    }
  }
}
```

### Remove Child from Vehicle
Remove a child assignment from a vehicle.

```http
DELETE /api/v1/schedule-slots/{scheduleSlotId}/children/{childId}
Authorization: Bearer {token}
```

### Get Available Vehicles
Get vehicles available for a specific time slot.

```http
GET /api/v1/groups/{groupId}/vehicles/available/{timeSlotId}
Authorization: Bearer {token}
```

### Get Child's Weekly Schedule
Get a child's schedule for a specific week.

```http
GET /api/v1/children/{childId}/schedule?week={week}
Authorization: Bearer {token}
```

### Copy Week Schedule
Copy a week's schedule to another week.

```http
POST /api/v1/schedule-slots/copy-week
Authorization: Bearer {token}
Content-Type: application/json

{
  "groupId": "group123",
  "sourceWeek": "2024-W03",
  "targetWeek": "2024-W04",
  "copyAssignments": true
}
```

### Group Schedule Configuration

#### Get Group Schedule Configuration
Retrieve the schedule configuration for a specific group.

```http
GET /api/v1/groups/{groupId}/schedule-config
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "config123",
    "groupId": "group123",
    "scheduleHours": {
      "MONDAY": ["07:00", "07:30", "08:00", "08:30", "15:00", "15:30", "16:00", "16:30"],
      "TUESDAY": ["07:00", "07:30", "08:00", "08:30", "15:00", "15:30", "16:00", "16:30"],
      "WEDNESDAY": ["07:00", "07:30", "08:00", "08:30", "15:00", "15:30", "16:00", "16:30"],
      "THURSDAY": ["07:00", "07:30", "08:00", "08:30", "15:00", "15:30", "16:00", "16:30"],
      "FRIDAY": ["07:00", "07:30", "08:00", "08:30", "15:00", "15:30", "16:00", "16:30"]
    },
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z",
    "isDefault": false
  }
}
```

**Error Response (Configuration Not Found):**
```json
{
  "success": false,
  "error": {
    "code": "CONFIGURATION_NOT_FOUND",
    "message": "Group schedule configuration not found. Please contact an administrator to configure schedule slots."
  }
}
```

#### Update Group Schedule Configuration
Update the schedule configuration for a group (admin only).

```http
PUT /api/v1/groups/{groupId}/schedule-config
Authorization: Bearer {token}
Content-Type: application/json

{
  "scheduleHours": {
    "MONDAY": ["07:00", "08:00", "15:00", "16:00"],
    "TUESDAY": ["07:30", "08:30", "15:30", "16:30"],
    "WEDNESDAY": ["07:00", "08:00", "15:00", "16:00"],
    "THURSDAY": ["07:30", "08:30", "15:30", "16:30"],
    "FRIDAY": ["07:00", "08:00", "15:00", "16:00"]
  }
}
```

**Validation Rules:**
- Time format must be HH:MM (24-hour)
- Minimum 15-minute intervals between time slots
- Maximum 20 time slots per weekday
- No duplicate time slots within the same weekday
- Only weekdays MONDAY through FRIDAY are supported
- Cannot remove time slots with existing bookings

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "config123",
    "groupId": "group123",
    "scheduleHours": {
      "MONDAY": ["07:00", "08:00", "15:00", "16:00"],
      "TUESDAY": ["07:30", "08:30", "15:30", "16:30"],
      "WEDNESDAY": ["07:00", "08:00", "15:00", "16:00"],
      "THURSDAY": ["07:30", "08:30", "15:30", "16:30"],
      "FRIDAY": ["07:00", "08:00", "15:00", "16:00"]
    },
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T14:30:00Z",
    "isDefault": false
  }
}
```

**Error Response (Validation):**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid time format: 25:00. Expected HH:MM"
  }
}
```

**Error Response (Conflict):**
```json
{
  "success": false,
  "error": {
    "code": "BOOKING_CONFLICT",
    "message": "Cannot remove time slots with existing bookings: MONDAY 08:00 (3 children assigned)"
  }
}
```

#### Reset Group Schedule Configuration
Reset the schedule configuration to default values (admin only).

```http
POST /api/v1/groups/{groupId}/schedule-config/reset
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "config123",
    "groupId": "group123",
    "scheduleHours": {
      "MONDAY": ["07:00", "07:30", "08:00", "08:30", "15:00", "15:30", "16:00", "16:30"],
      "TUESDAY": ["07:00", "07:30", "08:00", "08:30", "15:00", "15:30", "16:00", "16:30"],
      "WEDNESDAY": ["07:00", "07:30", "08:00", "08:30", "15:00", "15:30", "16:00", "16:30"],
      "THURSDAY": ["07:00", "07:30", "08:00", "08:30", "15:00", "15:30", "16:00", "16:30"],
      "FRIDAY": ["07:00", "07:30", "08:00", "08:30", "15:00", "15:30", "16:00", "16:30"]
    },
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T14:45:00Z",
    "isDefault": true
  }
}
```

#### Get Group Time Slots
Retrieve available time slots for a specific group and weekday.

```http
GET /api/v1/groups/{groupId}/schedule-config/time-slots?weekday=MONDAY
Authorization: Bearer {token}
```

**Query Parameters:**
- `weekday` (required): Weekday name (MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY)

**Response:**
```json
{
  "success": true,
  "data": {
    "groupId": "group123",
    "weekday": "MONDAY",
    "timeSlots": ["07:00", "07:30", "08:00", "08:30", "15:00", "15:30", "16:00", "16:30"]
  }
}
```

**Error Response (No Configuration):**
```json
{
  "success": false,
  "error": {
    "code": "CONFIGURATION_NOT_FOUND",
    "message": "Group schedule configuration not found. Please contact an administrator to configure schedule slots."
  }
}
```

#### Get Default Schedule Hours
Retrieve the default schedule hours template.

```http
GET /api/v1/groups/schedule-config/default
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "scheduleHours": {
      "MONDAY": ["07:00", "07:30", "08:00", "08:30", "15:00", "15:30", "16:00", "16:30"],
      "TUESDAY": ["07:00", "07:30", "08:00", "08:30", "15:00", "15:30", "16:00", "16:30"],
      "WEDNESDAY": ["07:00", "07:30", "08:00", "08:30", "15:00", "15:30", "16:00", "16:30"],
      "THURSDAY": ["07:00", "07:30", "08:00", "08:30", "15:00", "15:30", "16:00", "16:30"],
      "FRIDAY": ["07:00", "07:30", "08:00", "08:30", "15:00", "15:30", "16:00", "16:30"]
    },
    "isDefault": true
  }
}
```

---

## Dashboard API

### Get Dashboard Data
Retrieve aggregated dashboard information for the user.

```http
GET /api/v1/dashboard
Authorization: Bearer {token}
```

**Updated Implementation Note**: The dashboard now uses multiple endpoint calls for better performance:
- Family data: `GET /api/v1/families/current`
- Children data: `GET /api/v1/children` 
- Groups data: `GET /api/v1/groups/my-groups`
- Recent activity: `GET /api/v1/dashboard/activity`

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalChildren": 2,
      "totalVehicles": 1,
      "activeGroups": 3,
      "upcomingTrips": 5
    },
    "upcomingSchedule": [
      {
        "date": "2024-01-16",
        "day": "TUESDAY",
        "trips": [
          {
            "time": "08:00",
            "direction": "TO_SCHOOL",
            "groupName": "Elementary School Carpool",
            "role": "DRIVER",
            "vehicleName": "Honda CR-V",
            "children": ["Emma Smith", "Lucas Smith"],
            "passengers": ["Alice Johnson"]
          }
        ]
      }
    ],
    "recentActivity": [
      {
        "id": "activity123",
        "action": "CHILD_ASSIGNED",
        "description": "Emma Smith assigned to Honda CR-V for Tuesday 08:00",
        "timestamp": "2024-01-15T14:30:00Z",
        "user": "John Doe"
      }
    ],
    "notifications": [
      {
        "id": "notif123",
        "type": "CAPACITY_WARNING",
        "title": "Vehicle at capacity",
        "message": "Honda CR-V is at full capacity for Wednesday 08:00",
        "createdAt": "2024-01-15T15:00:00Z",
        "read": false
      }
    ]
  }
}
```

### Get Quick Actions
Retrieve available quick actions for the user.

```http
GET /api/v1/dashboard/quick-actions
Authorization: Bearer {token}
```

### Mark Notification as Read
Mark a notification as read.

```http
PATCH /api/v1/dashboard/notifications/{notificationId}
Authorization: Bearer {token}
Content-Type: application/json

{
  "read": true
}
```

---

## Real-Time WebSocket API

EduLift uses Socket.IO for real-time collaboration features.

### Connection
```javascript
const socket = io('ws://localhost:3001', {
  auth: {
    token: 'your-jwt-token'
  },
  transports: ['websocket', 'polling']
});
```

### Client Events

#### Join Schedule Room
Subscribe to real-time updates for a specific schedule.

```javascript
socket.emit('join-schedule', {
  groupId: 'group123',
  week: '2024-W03'
});
```

#### Update Vehicle Assignment
Broadcast a vehicle assignment update.

```javascript
socket.emit('update-vehicle-assignment', {
  slotId: 'slot123',
  vehicleId: 'vehicle123',
  driverId: 'user123',
  groupId: 'group123',
  week: '2024-W03'
});
```

#### Assign Child
Broadcast a child assignment update.

```javascript
socket.emit('assign-child', {
  slotId: 'slot123',
  vehicleAssignmentId: 'assign123',
  childId: 'child123',
  groupId: 'group123',
  week: '2024-W03'
});
```

#### Typing Indicators
Indicate when user is actively editing.

```javascript
// Start typing
socket.emit('typing-start', {
  context: 'schedule-slot-123',
  userName: 'John Doe'
});

// Stop typing
socket.emit('typing-stop', {
  context: 'schedule-slot-123'
});
```

### Server Events

#### Vehicle Assignment Updated
Receive real-time vehicle assignment updates.

```javascript
socket.on('vehicle-assignment-updated', (data) => {
  console.log('Vehicle assignment updated:', data);
  // data = {
  //   slotId: 'slot123',
  //   assignment: { vehicleId, driverId, ... },
  //   updatedBy: 'John Doe',
  //   timestamp: '2024-01-15T10:30:00Z'
  // }
});
```

#### Child Assignment Updated
Receive real-time child assignment updates.

```javascript
socket.on('child-assignment-updated', (data) => {
  console.log('Child assignment updated:', data);
});
```

#### Capacity Warning
Receive warnings about vehicle capacity issues.

```javascript
socket.on('capacity-warning', (data) => {
  console.log('Capacity warning:', data);
  // data = {
  //   slotId: 'slot123',
  //   vehicleId: 'vehicle123',
  //   currentCapacity: 7,
  //   attemptedAssignments: 8,
  //   message: 'Vehicle capacity would be exceeded'
  // }
});
```

#### Conflict Detected
Receive notifications about scheduling conflicts.

```javascript
socket.on('conflict-detected', (data) => {
  console.log('Conflict detected:', data);
  // data = {
  //   type: 'VEHICLE_DOUBLE_BOOKING',
  //   conflictingSlots: [...],
  //   resolution: 'suggested-resolution'
  // }
});
```

#### User Typing
Receive typing indicators from other users.

```javascript
socket.on('user-typing', (data) => {
  console.log('User typing:', data);
  // data = {
  //   userId: 'user123',
  //   userName: 'John Doe',
  //   context: 'schedule-slot-123',
  //   isTyping: true
  // }
});
```

### Connection Events

#### Connection Established
```javascript
socket.on('connect', () => {
  console.log('Connected to server');
});
```

#### Disconnection
```javascript
socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});
```

#### Connection Error
```javascript
socket.on('connect_error', (error) => {
  console.error('Connection error:', error);
});
```

---

## Rate Limiting

EduLift implements comprehensive rate limiting to ensure fair usage, prevent abuse, and maintain system stability.

### Backend Rate Limiting

#### Global Rate Limits (Per IP Address)
- **Default Limit**: 300 requests per minute (configurable via `RATE_LIMIT_MAX_REQUESTS`)
- **Window**: 60 seconds (configurable via `RATE_LIMIT_WINDOW_MS`)
- **Scope**: All API endpoints
- **Can be disabled**: Set `RATE_LIMIT_ENABLED=false` to disable rate limiting

#### CORS Configuration
- **Configuration**: Environment variable `CORS_ORIGIN`
- **Development**: Supports dynamic origins for devcontainer environments
- **Production**: Restricted to configured domains
- **WebSocket**: Same CORS policy as REST API

### Frontend Rate Limiting

#### API Call Throttling
- **Invite Code Validation**: 1 request per second per invite code
- **Purpose**: Prevents flood requests during CORS issues or connection problems

### Socket.IO Rate Limiting

#### Connection Settings
- **Reconnection Attempts**: 3 attempts maximum
- **Initial Delay**: 3 seconds
- **Maximum Delay**: 30 seconds (exponential backoff)
- **Connection Timeout**: 10 seconds

#### Event Rate Limits
- **General Events**: 100 events per minute per connection
- **Real-time Updates**: No specific limit (controlled by business logic)

### Rate Limit Response
```json
{
  "success": false,
  "error": "Too many requests, please try again later"
}
```

**HTTP Status**: `429 Too Many Requests`

### Rate Limiting Headers
Backend responses include rate limiting information:
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642248000
Retry-After: 60
```

### Flood Prevention Measures

#### Connection Flood Prevention
1. **Backend**: IP-based rate limiting with memory store
2. **Frontend**: Reduced aggressive reconnection attempts
3. **WebSocket**: Connection timeout and attempt limits
4. **API**: Client-side request deduplication

#### Error Handling During CORS Issues
- **Backend Connection Alert**: Only shows when user is authenticated
- **No False Positives**: Prevents "Unable to connect" alerts on login page
- **Graceful Degradation**: System remains functional during network issues

---

## API Versioning

### Current Version
- **Current**: v1
- **Supported**: v1
- **Deprecated**: None

### Version Header
Include API version in requests:
```http
API-Version: v1
```

### Version in URL
API version is included in the URL path:
```
/api/v1/families
/api/v1/groups
```

### Deprecation Policy
- New features added to current version
- Breaking changes require new version
- Previous versions supported for 12 months after deprecation
- Deprecation notices provided 6 months in advance

### Migration Guide
When new API versions are released, migration guides will be provided including:
- Breaking changes summary
- Updated endpoint mappings
- Code examples for common migrations
- Timeline for deprecation

---

## SDK Examples

### JavaScript/TypeScript SDK
```typescript
import { EduLiftAPI } from '@edulift/api-client';

const client = new EduLiftAPI({
  baseURL: 'https://api.edulift.com/api/v1',
  token: 'your-jwt-token'
});

// Get family data
const family = await client.families.getCurrent();

// Create schedule slot
const slot = await client.scheduleSlots.create({
  groupId: 'group123',
  datetime: '2025-06-30T06:00:00.000Z',
  vehicleId: 'vehicle123',
  driverId: 'user123'
});

// Assign vehicle
const assignment = await client.scheduleSlots.assignVehicle(slot.id, {
  vehicleId: 'vehicle123',
  driverId: 'user123'
});
```

### React Hook Examples
```typescript
import { useQuery, useMutation } from '@tanstack/react-query';
import { useSocket } from './hooks/useSocket';

// Fetch family data
const { data: family, isLoading } = useQuery({
  queryKey: ['family'],
  queryFn: () => client.families.getCurrent()
});

// Create child mutation
const createChildMutation = useMutation({
  mutationFn: (childData) => client.children.create(childData),
  onSuccess: () => {
    queryClient.invalidateQueries(['children']);
  }
});

// Real-time schedule updates
const { socket } = useSocket();

useEffect(() => {
  socket?.emit('join-schedule', { groupId, week });
  
  socket?.on('vehicle-assignment-updated', (data) => {
    queryClient.setQueryData(['schedule', groupId, week], (old) => {
      return updateScheduleWithAssignment(old, data);
    });
  });

  return () => {
    socket?.off('vehicle-assignment-updated');
  };
}, [socket, groupId, week]);
```

This API documentation provides comprehensive coverage of all EduLift endpoints, real-time features, and integration patterns. For implementation examples and advanced usage, refer to the Technical Documentation.