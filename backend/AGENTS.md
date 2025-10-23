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

## ⚠️ Important Notes

- Always validate input data before processing
- Use transactions for multi-step database operations
- Handle errors gracefully with appropriate HTTP status codes
- Follow security best practices for API endpoints
- Maintain backward compatibility when modifying existing APIs
- Update tests when modifying existing functionality

Always use context7 when I need code generation, setup or configuration steps, or
library/API documentation. This means you should automatically use the Context7 MCP
tools to resolve library id and get library docs without me having to explicitly ask.