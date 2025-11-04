# EduLift Backend - AI Agent Instructions

This file provides specific instructions for AI coding agents working on the EduLift backend services.

## 🛠️ Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Prisma ORM
- **Real-time**: Socket.IO
- **Testing**: Jest
- **Authentication**: JWT-based authentication
- **Validation**: Custom validation middleware

## 📁 Project Structure

```
src/
├── app.ts          - Express application setup
├── server.ts       - Server entry point
├── controllers/    - Request handlers
├── services/       - Business logic
├── repositories/   - Data access layer
├── routes/         - API route definitions
├── middleware/     - Custom middleware
├── utils/          - Utility functions
├── constants/      - Application constants
├── types/          - TypeScript types and interfaces
├── shared/         - Shared utilities and types
├── socket/         - Socket.IO real-time functionality
└── __tests__/      - Unit tests

tests/
└── integration/    - Integration tests

prisma/
├── schema.prisma   - Database schema
└── migrations/     - Database migrations
```

## ▶️ Development Commands

- **Development Server**: `npm run dev`
- **Build**: `npm run build`
- **Start**: `npm start`

## 🧪 Testing Commands

- **Unit Tests**: `npm test` or `npm run test:watch`
- **Unit Test Coverage**: `npm run test:coverage`
- **Integration Tests**: `npm run test:integration`

## 📝 Code Style Guidelines

- Follow existing TypeScript and Express patterns
- Use async/await for asynchronous operations
- Implement proper error handling with custom error classes
- Write unit tests for new services and functions
- Use Prisma for database operations
- Follow REST API best practices

## 🔄 Common Workflows

1. **Creating New API Endpoints**:
   - Define route in appropriate file under `src/routes/`
   - Create controller in `src/controllers/`
   - Implement business logic in `src/services/`
   - Add data access in `src/repositories/`
   - Include proper validation and error handling

2. **Database Changes**:
   - Update schema in `prisma/schema.prisma`
   - Create migration with `npm run db:migrate`
   - Update repositories to use new schema
   - Update types if needed

3. **Real-time Features**:
   - Add functionality in `src/socket/`
   - Emit events from controllers/services
   - Handle events in mobile/web clients

4. **Authentication/Authorization**:
   - Use existing middleware patterns
   - Implement role-based access control
   - Validate permissions in services

## 🌍 Timezone Handling

EduLift supports timezone-aware scheduling to handle users across different timezones:

### Core Concepts

- **User Timezone**: Stored in `users.timezone` field (IANA format, e.g., "Europe/Paris", "America/New_York")
- **UTC Storage**: All `DateTime` fields in database store UTC values
- **Conversion**: Display layer converts UTC → User timezone for presentation
- **Default**: Users default to "UTC" timezone if not specified

### Key Files

- **`src/utils/timezoneUtils.ts`** - Timezone utilities and conversion functions
  - `isValidTimezone(timezone)` - Validates IANA timezone format
  - `getValidatedTimezone(timezone)` - Safe getter with UTC fallback
  - `convertUtcToTimezone(datetime, timezone)` - UTC to user timezone conversion
  - `COMMON_TIMEZONES` - List of 40+ common timezones

- **`src/types/index.ts`** - User type definitions include `timezone` field
- **`src/repositories/UserRepository.ts`** - Validates timezone on create/update
- **`prisma/schema.prisma`** - User and Group models have `timezone` field

### API Endpoints

- **`GET /auth/profile`** - Returns user with timezone
- **`PUT /auth/profile`** - Update user profile including timezone
- **`PATCH /auth/timezone`** - Dedicated endpoint to update timezone only

### Usage Example

```typescript
// In services - get user's timezone
const user = await userRepository.findById(userId);
const timezone = user.timezone; // e.g., "Europe/Paris"

// Convert UTC datetime to user's timezone
import { convertUtcToTimezone, getTimeInTimezone } from '../utils/timezoneUtils';

const utcDatetime = new Date('2025-01-15T07:30:00Z'); // UTC
const localTime = getTimeInTimezone(utcDatetime, timezone); // "09:30" in Paris (UTC+2)

// Validate timezone before storing
import { isValidTimezone, getValidatedTimezone } from '../utils/timezoneUtils';

if (isValidTimezone(inputTimezone)) {
  // Valid IANA timezone
} else {
  // Invalid - will default to UTC
}
```

### Best Practices

1. **Always store UTC in database** - Never store timezone-specific datetimes
2. **Validate timezones** - Use `isValidTimezone()` before storing user input
3. **Default to UTC** - Use `getValidatedTimezone()` for safe fallback
4. **Timezone-aware errors** - Include local time in error messages for users
5. **Test DST transitions** - Ensure timezone conversions work across daylight saving changes

### Testing

Comprehensive test suite available in:
- `src/utils/__tests__/timezoneUtils.test.ts` - 30+ tests covering conversion, validation, edge cases
- Tests include DST handling, day boundary crossing, real-world scenarios

## 🔗 Deep Link System Architecture

EduLift uses a sophisticated deep link system with a three-tier fallback strategy to ensure reliable URL generation across all environments.

### Core Components

#### DEEP_LINK_BASE_URL vs FRONTEND_URL

- **`DEEP_LINK_BASE_URL`**: Primary URL for deep links in emails and notifications
  - Development/E2E: `edulift://` (custom protocol for mobile apps)
  - Staging: `https://transport.tanjama.fr:50443/` (HTTPS with custom port)
  - Production: `https://transport.tanjama.fr/` (standard HTTPS)

- **`FRONTEND_URL**: Fallback URL for web-based access
  - Always points to the web frontend
  - Used as secondary fallback if `DEEP_LINK_BASE_URL` is invalid
  - Same across environments but different purposes

#### Three-Tier Fallback Strategy

The system uses a robust fallback mechanism in `BaseEmailService.generateUrl()`:

1. **Primary**: `DEEP_LINK_BASE_URL` (environment-specific)
2. **Secondary**: `FRONTEND_URL` (web fallback)
3. **Tertiary**: `http://localhost:3000` (emergency fallback)

### Environment-Specific Configuration

#### Development/E2E Environment
```bash
DEEP_LINK_BASE_URL=edulift://
FRONTEND_URL=http://localhost:3000
```
- Uses custom `edulift://` protocol for mobile app deep linking
- Fallback to localhost for web development

#### Staging Environment
```bash
DEEP_LINK_BASE_URL=https://transport.tanjama.fr:50443/
FRONTEND_URL=https://transport.tanjama.fr:50443
```
- Uses HTTPS with custom port (50443) for staging
- Allows testing mobile deep links on real devices

#### Production Environment
```bash
DEEP_LINK_BASE_URL=https://transport.tanjama.fr/
FRONTEND_URL=https://transport.tanjama.fr
```
- Uses standard HTTPS on port 443
- Optimized for production mobile app experience

### Security Validation

All URLs undergo comprehensive security validation in `BaseEmailService.validateDeepLinkUrl()`:

- **Protocol validation**: Allows `http:`, `https:`, and `edulift:`
- **Hostname security**: Blocks private IPs in production
- **Pattern detection**: Prevents XSS and injection attacks
- **Format validation**: Ensures proper URL structure

### URL Generation Examples

#### Group Invitation Email
```typescript
// Development
generateUrl('groups/join', new URLSearchParams({ code: 'ABC123' }))
// Result: edulift://groups/join?code=ABC123

// Staging
generateUrl('groups/join', new URLSearchParams({ code: 'ABC123' }))
// Result: https://transport.tanjama.fr:50443/groups/join?code=ABC123

// Production
generateUrl('groups/join', new URLSearchParams({ code: 'ABC123' }))
// Result: https://transport.tanjama.fr/groups/join?code=ABC123
```

#### Magic Link Authentication
```typescript
// Uses FRONTEND_URL directly (not DEEP_LINK_BASE_URL)
const magicLinkUrl = `${process.env.FRONTEND_URL}/auth/verify?token=${token}`;
// Development: http://localhost:3000/auth/verify?token=abc123
// Staging: https://transport.tanjama.fr:50443/auth/verify?token=abc123
// Production: https://transport.tanjama.fr/auth/verify?token=abc123
```

### Configuration Management

#### Ansible Template System
The deep link URLs are generated dynamically using Ansible templates:

- **Template**: `deploy/ansible/templates/_url_macros.j2`
- **Environment Config**: `deploy/ansible/templates/env.j2`
- **Macro**: `deep_link_url(environment)` generates appropriate URLs

#### Manual Override Support
You can override URLs via Ansible inventory:
```yaml
edulift_deployment:
  urls:
    deep_link_base: "https://custom.example.com/"
    frontend: "https://custom.example.com"
```

### Integration Points

#### Email Services
- All email templates use `generateUrl()` for consistent link generation
- Mobile-friendly buttons with copyable link fallbacks
- Security validation prevents malicious URLs

#### Push Notifications
- Uses `DEEP_LINK_BASE_URL` for deep linking in push notifications
- Ensures users land in the correct mobile app context

#### API Responses
- Consistent URL generation across all API endpoints
- Maintains deep link compatibility

### Testing and Validation

#### Unit Tests
- `BaseEmailService.test.ts`: Comprehensive URL generation tests
- Tests cover all environments and fallback scenarios
- Security validation testing for malicious URLs

#### Integration Tests
- End-to-end testing of deep link flows
- Mobile app compatibility verification
- Email delivery and link functionality

### Troubleshooting

#### Common Issues

1. **Deep links not opening on mobile**
   - Verify app association with `edulift://` protocol
   - Check universal link configuration for HTTPS URLs

2. **Fallback URLs not working**
   - Verify `FRONTEND_URL` configuration
   - Check network connectivity to fallback URLs

3. **Security validation failures**
   - Review URL format and protocol
   - Check for suspicious patterns in hostname

#### Debug Logging
Enable debug logging in development:
```typescript
// Logs URL source and validation details
console.debug(`[BaseEmailService] Using URL from ${urlSource}: ${validBaseUrl}`);
```

## ⚠️ Important Notes

- Always validate input data before processing
- Use transactions for multi-step database operations
- Handle errors gracefully with appropriate HTTP status codes
- Follow security best practices for API endpoints
- Maintain backward compatibility when modifying existing APIs
- Update tests when modifying existing functionality
- Test deep link functionality in all environments before deployment
- Verify mobile app association with custom protocols

Always use context7 when I need code generation, setup or configuration steps, or
library/API documentation. This means you should automatically use the Context7 MCP
tools to resolve library id and get library docs without me having to explicitly ask.