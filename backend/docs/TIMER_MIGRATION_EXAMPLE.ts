/**
 * TIMER MIGRATION EXAMPLE
 *
 * This file demonstrates the migration from manual timers to automatic middleware.
 * It shows a complete before/after comparison for a real endpoint.
 *
 * @see backend/docs/TIMER_MIGRATION_GUIDE.md for the full migration guide
 * @see backend/docs/TIMER_ARCHITECTURE_ANALYSIS.md for the architectural analysis
 */

// ============================================================================
// BEFORE: Manual Timer Approach (Current Implementation)
// ============================================================================

/**
 * ❌ BEFORE: Manual timer with extensive boilerplate
 *
 * Problems with this approach:
 * - 40+ lines of code for a simple endpoint
 * - Easy to forget timer.end() in early returns
 * - Repetitive logging code
 * - Difficult to maintain
 * - Risk of inconsistent logging
 */
export const BEFORE_createFamily = async (c: any) => {
  const userId = c.get('userId');
  const { name } = c.req.valid('json');
  const timer = createTimer('FamilyController.createFamily', c);

  // Multiple logging calls
  familyLogger.logStart('createFamily', c, {
    businessContext: { userId, name },
  });

  loggerInstance.info('createFamily', { userId, name });

  try {
    // Business logic
    const existingFamily = await familyServiceInstance.getUserFamily(userId);

    if (existingFamily) {
      // Early return - RISK: forgetting timer.end()
      timer.end({ error: 'User already in family' });
      familyLogger.logWarning('createFamily', c, 'User already belongs to a family');
      loggerInstance.warn('createFamily: user already belongs to a family', { userId });
      return c.json({
        success: false,
        error: 'User already belongs to a family',
        code: 'ALREADY_IN_FAMILY' as const,
      }, 409);
    }

    const family = await familyServiceInstance.createFamily(userId, name);

    // Success path - need to remember to call timer.end()
    timer.end({ userId, familyId: family.id });
    familyLogger.logSuccess('createFamily', c, { userId, familyId: family.id });
    loggerInstance.info('createFamily: success', { userId, familyId: family.id });
    return c.json({
      success: true,
      data: transformFamilyForResponse(family),
    }, 201);

  } catch (error) {
    // Error path - need to remember to call timer.end()
    timer.end({ error: (error as Error).message });
    familyLogger.logError('createFamily', c, error);
    loggerInstance.error('createFamily: error', { userId, error });
    const normalizedError = normalizeError(error);
    return c.json({
      success: false,
      error: normalizedError.message,
      code: 'CREATE_FAILED' as const,
    }, 500);
  }
};

// ============================================================================
// AFTER: Automatic Middleware Approach (Recommended)
// ============================================================================

/**
 * ✅ AFTER: Automatic middleware with minimal boilerplate
 *
 * Benefits of this approach:
 * - 15 lines of code for the same endpoint (60% reduction)
 * - No risk of forgetting timer.end() (automatic)
 * - No repetitive logging code (automatic)
 * - Easy to maintain
 * - Consistent logging across all endpoints
 * - Server-Timing header for DevTools
 */
export const AFTER_createFamily = async (c: any) => {
  const userId = c.get('userId');
  const { name } = c.req.valid('json');

  // Optional: granular timing for specific operations
  startTime(c, 'checkExisting');
  const existingFamily = await familyServiceInstance.getUserFamily(userId);
  endTime(c, 'checkExisting');

  if (existingFamily) {
    // Early return - no need to worry about timers!
    return c.json({
      success: false,
      error: 'User already belongs to a family',
      code: 'ALREADY_IN_FAMILY' as const,
    }, 409);
  }

  startTime(c, 'createFamily');
  const family = await familyServiceInstance.createFamily(userId, name);
  endTime(c, 'createFamily');

  // Automatic success logging and Server-Timing header
  return c.json({
    success: true,
    data: transformFamilyForResponse(family),
  }, 201);
};

// ============================================================================
// COMPARISON: Side by Side
// ============================================================================

/**
 * COMPARISON TABLE
 *
 * | Metric | Before (Manual) | After (Automatic) | Improvement |
 * |--------|----------------|-------------------|-------------|
 * | Lines of Code | 40+ | 15 | -62% |
 * | timer.end() calls | 3 (can be forgotten) | 0 (automatic) | 100% reliable |
 * | Logger calls | 6 | 0 (automatic) | -100% |
 * | Early returns | 2 (risky) | 2 (safe) | 100% safe |
 * | Server-Timing | No | Yes | DevTools compatible |
 * | Maintainability | Low | High | Much easier |
 * | Consistency | Low | High | Guaranteed |
 */

// ============================================================================
// MIGRATION STEPS
// ============================================================================

/**
 * STEP-BY-STEP MIGRATION
 *
 * Step 1: Apply the middleware globally (one-time setup)
 * ```typescript
 * // In backend/src/index.ts
 * import { performanceLogging } from './middleware/performanceLogging';
 * app.use('*', performanceLogging());
 * ```
 *
 * Step 2: Remove timer creation
 * ```typescript
 * // ❌ Remove this line:
 * const timer = createTimer('FamilyController.createFamily', c);
 * ```
 *
 * Step 3: Remove logger calls
 * ```typescript
 * // ❌ Remove these lines:
 * familyLogger.logStart('createFamily', c, { ... });
 * familyLogger.logSuccess('createFamily', c, { ... });
 * familyLogger.logError('createFamily', c, error);
 * loggerInstance.info('createFamily', { ... });
 * loggerInstance.warn('createFamily: ...', { ... });
 * loggerInstance.error('createFamily: error', { ... });
 * ```
 *
 * Step 4: Add optional granular timings
 * ```typescript
 * // ✅ Add these lines for specific operations:
 * startTime(c, 'operationName');
 * // ... your operation ...
 * endTime(c, 'operationName');
 * ```
 *
 * Step 5: Remove all timer.end() calls
 * ```typescript
 * // ❌ Remove ALL occurrences of:
 * timer.end({ ... });
 * ```
 *
 * Step 6: Remove try-catch (unless needed for business logic)
 * ```typescript
 * // ✅ The middleware automatically handles errors
 * // You only need try-catch if you have custom error handling
 * ```
 *
 * Step 7: Test the endpoint
 * ```bash
 * curl -X POST http://localhost:3001/api/v1/families \
 *   -H "Authorization: Bearer YOUR_TOKEN" \
 *   -H "Content-Type: application/json" \
 *   -d '{"name":"Test Family"}'
 *
 * # Check the response headers:
 * # Server-Timing: checkExisting;dur=5, createFamily;dur=50, total;dur=55
 * ```
 */

// ============================================================================
// MORE EXAMPLES
// ============================================================================

/**
 * EXAMPLE 2: Endpoint with multiple early returns
 */

// ❌ BEFORE: Risky early returns
export const BEFORE_updateFamilyName = async (c: any) => {
  const userId = c.get('userId');
  const { name } = c.req.valid('json');
  const timer = createTimer('FamilyController.updateFamilyName', c);

  try {
    if (!name) {
      timer.end({ error: 'Name required' });
      return c.json({ success: false, error: 'Name required' }, 400);
    }

    if (name.length < 3) {
      timer.end({ error: 'Name too short' });
      return c.json({ success: false, error: 'Name too short' }, 400);
    }

    const family = await familyServiceInstance.updateFamilyName(userId, name);
    timer.end({ familyId: family.id });
    return c.json({ success: true, data: family }, 200);

  } catch (error) {
    timer.end({ error: error.message });
    return c.json({ success: false, error: error.message }, 500);
  }
};

// ✅ AFTER: Safe early returns
export const AFTER_updateFamilyName = async (c: any) => {
  const userId = c.get('userId');
  const { name } = c.req.valid('json');

  if (!name) {
    return c.json({ success: false, error: 'Name required' }, 400);
  }

  if (name.length < 3) {
    return c.json({ success: false, error: 'Name too short' }, 400);
  }

  startTime(c, 'updateFamilyName');
  const family = await familyServiceInstance.updateFamilyName(userId, name);
  endTime(c, 'updateFamilyName');

  return c.json({ success: true, data: family }, 200);
};

/**
 * EXAMPLE 3: Endpoint with parallel operations
 */

// ❌ BEFORE: Manual timing of parallel operations
export const BEFORE_getDashboard = async (c: any) => {
  const userId = c.get('userId');
  const timer = createTimer('DashboardController.getDashboard', c);

  try {
    const startTime = Date.now();

    const [user, family, groups] = await Promise.all([
      userService.findById(userId),
      familyService.findByUser(userId),
      groupService.findByUser(userId),
    ]);

    const duration = Date.now() - startTime;
    timer.end({ duration, hasFamily: !!family, groupsCount: groups.length });

    return c.json({
      success: true,
      data: { user, family, groups }
    }, 200);

  } catch (error) {
    timer.end({ error: error.message });
    return c.json({ success: false, error: error.message }, 500);
  }
};

// ✅ AFTER: Automatic timing with granular measurements
export const AFTER_getDashboard = async (c: any) => {
  const userId = c.get('userId');

  // Measure user fetch separately
  startTime(c, 'fetchUser');
  const user = await userService.findById(userId);
  endTime(c, 'fetchUser');

  // Measure parallel operations together
  startTime(c, 'fetchFamilyAndGroups');
  const [family, groups] = await Promise.all([
    familyService.findByUser(userId),
    groupService.findByUser(userId),
  ]);
  endTime(c, 'fetchFamilyAndGroups');

  return c.json({
    success: true,
    data: { user, family, groups }
  }, 200);

  // Server-Timing: fetchUser;dur=20, fetchFamilyAndGroups;dur=50, total;dur=70
};

/**
 * EXAMPLE 4: Complex endpoint with business logic error handling
 */

// ❌ BEFORE: Complex try-catch with timers
export const BEFORE_joinFamily = async (c: any) => {
  const userId = c.get('userId');
  const { inviteCode } = c.req.valid('json');
  const timer = createTimer('FamilyController.joinFamily', c);

  familyLogger.logStart('joinFamily', c, {
    businessContext: {
      userId,
      inviteCode: `${inviteCode.substring(0, 8)}...`,
    },
  });

  loggerInstance.info('joinFamily', { userId, inviteCode: `${inviteCode.substring(0, 8)}...` });

  try {
    const family = await familyServiceInstance.joinFamily(inviteCode.trim(), userId);

    timer.end({ userId, familyId: family.id });
    familyLogger.logSuccess('joinFamily', c, { userId, familyId: family.id });
    loggerInstance.info('joinFamily: success', { userId, familyId: family.id });

    return c.json({
      success: true,
      data: transformFamilyForResponse(family),
    }, 200);

  } catch (error) {
    timer.end({ error: (error as Error).message });
    familyLogger.logError('joinFamily', c, error);
    loggerInstance.error('joinFamily: error', { userId, error });

    const normalizedError = normalizeError(error);
    const statusCode = normalizedError.statusCode === 404 ? 404 : 400;

    return c.json({
      success: false,
      error: normalizedError.message,
      code: 'JOIN_FAILED' as const,
    }, statusCode);
  }
};

// ✅ AFTER: Clean business logic with automatic timing
export const AFTER_joinFamily = async (c: any) => {
  const userId = c.get('userId');
  const { inviteCode } = c.req.valid('json');

  // Note: We still need try-catch for custom status codes,
  // but NO timer logic needed!
  try {
    startTime(c, 'joinFamily');
    const family = await familyServiceInstance.joinFamily(inviteCode.trim(), userId);
    endTime(c, 'joinFamily');

    return c.json({
      success: true,
      data: transformFamilyForResponse(family),
    }, 200);

  } catch (error) {
    // The middleware automatically logs the error with timing
    const normalizedError = normalizeError(error);
    const statusCode = normalizedError.statusCode === 404 ? 404 : 400;

    return c.json({
      success: false,
      error: normalizedError.message,
      code: 'JOIN_FAILED' as const,
    }, statusCode);
  }
};

// ============================================================================
// IMPORTS
// ============================================================================

/**
 * REQUIRED IMPORTS (NEW APPROACH)
 *
 * ```typescript
 * import { startTime, endTime } from '../../middleware/performanceLogging';
 * // Or directly from Hono:
 * import { startTime, endTime } from 'hono/timing';
 * ```
 *
 * REMOVED IMPORTS (OLD APPROACH)
 *
 * ```typescript
 * // ❌ No longer needed:
 * import { createTimer, createControllerLogger } from '../../utils/controllerLogging';
 * import { createLogger } from '../../utils/logger';
 *
 * // ❌ No longer needed:
 * const controllerLogger = createControllerLogger('MyController');
 * const loggerInstance = createLogger('MyController');
 * ```
 */

// ============================================================================
// TESTING
// ============================================================================

/**
 * TESTING THE MIGRATION
 *
 * 1. Manual Testing:
 * ```bash
 * # Test the endpoint
 * curl -X POST http://localhost:3001/api/v1/families \
 *   -H "Authorization: Bearer YOUR_TOKEN" \
 *   -H "Content-Type: application/json" \
 *   -d '{"name":"Test Family"}'
 *
 * # Check response headers
 * curl -I http://localhost:3001/api/v1/families/current \
 *   -H "Authorization: Bearer YOUR_TOKEN"
 *
 * # Expected output:
 * # Server-Timing: checkExisting;dur=5, createFamily;dur=50, total;dur=55
 * ```
 *
 * 2. DevTools Testing:
 * - Open Chrome DevTools (F12)
 * - Go to Network tab
 * - Make a request
 * - Click on the request
 * - Go to Timing tab
 * - You should see: checkExisting (5ms), createFamily (50ms), total (55ms)
 *
 * 3. Automated Testing:
 * ```typescript
 * import { Hono } from 'hono';
 * import { performanceLogging } from '../middleware/performanceLogging';
 *
 * describe('FamilyController with automatic timing', () => {
 *   let app: Hono;
 *
 *   beforeEach(() => {
 *     app = new Hono();
 *     app.use('*', performanceLogging());
 *     // ... setup routes ...
 *   });
 *
 *   it('should include Server-Timing header', async () => {
 *     const response = await app.request('/api/v1/families', {
 *       method: 'POST',
 *       headers: { 'Authorization': 'Bearer token' },
 *       body: JSON.stringify({ name: 'Test' }),
 *     });
 *
 *     expect(response.headers.get('Server-Timing')).toMatch(/total;dur=\d+/);
 *   });
 * });
 * ```
 */

// ============================================================================
// CONCLUSION
// ============================================================================

/**
 * SUMMARY OF BENEFITS
 *
 * 1. Reliability: 100% - No risk of forgetting timer.end()
 * 2. Code Reduction: 60-70% less code per endpoint
 * 3. Maintainability: Much easier to read and modify
 * 4. Consistency: All endpoints use the same pattern
 * 5. DevTools: Native integration with browser DevTools
 * 6. Standards: Uses HTTP Server-Timing standard
 * 7. Performance: Less overhead than manual timers
 * 8. Testing: Easier to test (can disable in test env)
 *
 * MIGRATION EFFORT
 *
 * - Setup: 5 minutes (one-time)
 * - Per endpoint: 2-3 minutes
 * - Total for 8 controllers (~50 endpoints): 2-3 hours
 * - Testing: 30 minutes
 * - Total time: 3-4 hours
 *
 * NEXT STEPS
 *
 * 1. Read the full migration guide: backend/docs/TIMER_MIGRATION_GUIDE.md
 * 2. Review the architectural analysis: backend/docs/TIMER_ARCHITECTURE_ANALYSIS.md
 * 3. Apply the middleware globally (5 minutes)
 * 4. Migrate one controller as a pilot (30 minutes)
 * 5. Test thoroughly (15 minutes)
 * 6. Migrate remaining controllers (2 hours)
 * 7. Final testing and cleanup (30 minutes)
 *
 * Good luck! 🚀
 */

export {};
