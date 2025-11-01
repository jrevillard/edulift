# 📋 EduLift Backend Logging Guidelines

This guide establishes best practices for logging in the EduLift backend to ensure consistent, actionable, and maintainable logs.

## 🎯 Logging Levels

### When to use each level

#### 🐛 **DEBUG** - Development & Troubleshooting
Use for detailed information useful during development and debugging.

**Use DEBUG for:**
- Function entry/exit with parameters
- Intermediate calculation results
- Database query details
- External API request/response bodies
- Cache hits/misses
- State transitions
- Loop iterations (when relevant)

**Examples:**
```typescript
logger.debug('Updating schedule config', { groupId, scheduleHours });
logger.debug('Database query executed', { sql, params, duration: '45ms' });
logger.debug('Cache miss for key', { key: 'user:123' });
```

#### ℹ️ **INFO** - Business Events & Milestones
Use for significant business events and application lifecycle.

**Use INFO for:**
- User actions (login, signup, resource creation)
- Background job start/completion
- System startup/shutdown
- Configuration loaded
- Successful external integrations
- Scheduled task execution

**Examples:**
```typescript
logger.info('User logged in', { userId, email });
logger.info('Weekly schedule published', { groupId, week: '2024-W03' });
logger.info('Email sent successfully', { recipient, subject });
```

#### ⚠️ **WARN** - Recoverable Issues
Use for situations that are unusual but don't prevent operation.

**Use WARN for:**
- Deprecated feature usage
- Fallback to default values
- Retry attempts
- Resource limits approached
- Non-critical validation failures
- Performance degradation

**Examples:**
```typescript
logger.warn('Invalid timezone provided, defaulting to UTC', { timezone });
logger.warn('API rate limit approaching', { current: 280, max: 300 });
logger.warn('Retry attempt 2/3 for external service', { service: 'email' });
```

#### ❌ **ERROR** - Failures & Exceptions
Use for errors that prevent an operation from completing.

**Use ERROR for:**
- Exceptions and stack traces
- Failed database operations
- External service failures
- Authentication/authorization failures
- Data integrity issues
- Configuration errors

**Examples:**
```typescript
logger.error('Failed to update schedule config', { groupId, error: error.message });
logger.error('Database connection lost', { error: error.stack });
logger.error('External API returned 500', { service: 'email', status: 500 });
```

## 🏗️ Structured Logging

Always include context as metadata, not in the message string.

### ✅ Good
```typescript
logger.info('User created', {
  userId: user.id,
  email: user.email,
  familyId: user.familyId
});
```

### ❌ Bad
```typescript
logger.info(`User ${user.id} created with email ${user.email}`);
```

## 📝 Message Format

- Use **present tense** for actions: "Creating user" (not "Created user")
- Use **past tense** for completed events: "User created" (not "User creation successful")
- Be **concise** and **descriptive**
- Start with a **verb** when possible

### Examples
```typescript
// Actions in progress
logger.debug('Validating schedule configuration', { groupId });

// Completed events
logger.info('Schedule configuration validated', { groupId, isValid: true });

// Errors
logger.error('Schedule validation failed', { groupId, errors });
```

## 🔍 Context-Specific Loggers

Create contextual loggers for better log filtering:

```typescript
import { createLogger } from '../utils/logger';

const logger = createLogger('GroupScheduleConfigService');

logger.info('Configuration updated', { groupId });
// Output: [INFO] [GroupScheduleConfigService] Configuration updated {"groupId":"..."}
```

## 🚫 What NOT to Log

### Never log sensitive data:
- Passwords (even hashed)
- JWT tokens
- API keys
- Credit card numbers
- Personal identifiable information (PII) without anonymization

### Avoid logging:
- Large payloads (>1KB) - log a summary instead
- Binary data
- Circular references
- Redundant information already in other logs

## 🛠️ Console Override System

The backend uses `consoleOverride.ts` which automatically redirects all `console.*` calls to the structured logger:

- `console.log()` → `logger.info()`
- `console.error()` → `logger.error()`
- `console.warn()` → `logger.warn()`
- `console.debug()` → `logger.debug()`

**This means:**
- All console calls respect `LOG_LEVEL` environment variable
- No duplicate logs in any environment
- Consistent format across the entire application

### When to use console vs logger?

**Prefer `logger.*` for:**
- Business logic logging
- Service-level logging
- Structured data logging

**Use `console.*` for:**
- Quick debugging during development
- Third-party libraries that use console
- Legacy code (will be auto-converted)

## ⚙️ Configuration

Control logging via environment variables:

```bash
# Set log level (error, warn, info, debug)
LOG_LEVEL=debug

# Enable pretty/colorized output (true/false)
LOG_PRETTY=true

# HTTP request logging format (dev, combined, tiny)
HTTP_LOG_FORMAT=dev
```

## 📊 Examples by Service

### Controller Logging
```typescript
async updateGroupScheduleConfig(req: Request, res: Response) {
  const { groupId } = req.params;
  const logger = createLogger('GroupScheduleConfigController');

  logger.info('Schedule config update requested', { groupId, userId: req.user.id });

  try {
    const config = await this.service.updateGroupScheduleConfig(...);
    logger.info('Schedule config updated successfully', { groupId, configId: config.id });
    res.json({ success: true, data: config });
  } catch (error) {
    logger.error('Schedule config update failed', { groupId, error: error.message });
    throw error;
  }
}
```

### Service Logging
```typescript
async updateGroupScheduleConfig(groupId: string, scheduleHours: ScheduleHours) {
  const logger = createLogger('GroupScheduleConfigService');

  logger.debug('Validating schedule hours', { groupId, slotCount: Object.keys(scheduleHours).length });

  // Validation logic...

  logger.debug('Schedule hours validated', { groupId, isValid: true });

  const config = await this.prisma.groupScheduleConfig.update(...);

  logger.info('Schedule config persisted', { groupId, configId: config.id });

  return config;
}
```

### Error Handling
```typescript
try {
  await someOperation();
} catch (error) {
  if (error instanceof AppError) {
    // Expected application errors
    logger.warn('Operation failed with expected error', {
      errorCode: error.code,
      message: error.message
    });
  } else {
    // Unexpected errors
    logger.error('Unexpected error during operation', {
      error: error.message,
      stack: error.stack
    });
  }
  throw error;
}
```

## 🔄 Migration from console.* to logger.*

While `consoleOverride` handles `console.*` calls automatically, gradually migrate to explicit `logger.*` usage:

### Before
```typescript
console.log('User created:', user.id);
console.error('Database error:', error);
```

### After
```typescript
const logger = createLogger('UserService');
logger.info('User created', { userId: user.id });
logger.error('Database operation failed', { operation: 'create', error: error.message });
```

## 📚 Additional Resources

- [Pino Documentation](https://getpino.io/)
- [Best Practices for Logging](https://stackify.com/logging-best-practices/)
- [12-Factor App: Logs](https://12factor.net/logs)

---

**Remember:** Good logging is about finding the right balance between too much noise and too little information. When in doubt, prefer DEBUG level and adjust based on operational needs.
