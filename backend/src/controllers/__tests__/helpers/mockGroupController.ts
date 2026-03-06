/**
 * Mock Group Controller for testing
 * This replaces the actual GroupController with a mock that we can control
 */

import { Hono } from 'hono';

// Mock service functions
const mockGetGroupScheduleConfig = jest.fn();
const mockGetGroupTimeSlots = jest.fn();
const mockUpdateGroupScheduleConfig = jest.fn();
const mockResetGroupScheduleConfig = jest.fn();

// Mock prisma
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
  },
};

// Create a mock app that simulates GroupController behavior
const createMockGroupController = () => {
  const app = new Hono();

  // GET /:groupId/schedule-config
  app.get('/:groupId/schedule-config', async (c) => {
    const groupId = c.req.param('groupId');
    const result = await mockGetGroupScheduleConfig(groupId);

    // Transform result to match controller response format
    const scheduleHours = result.scheduleHours || {};
    const responseData = {
      id: result.id,
      groupId: result.groupId,
      scheduleHours: {
        MONDAY: scheduleHours.MONDAY || [],
        TUESDAY: scheduleHours.TUESDAY || [],
        WEDNESDAY: scheduleHours.WEDNESDAY || [],
        THURSDAY: scheduleHours.THURSDAY || [],
        FRIDAY: scheduleHours.FRIDAY || [],
      },
      group: result.group,
      createdAt: result.createdAt ? result.createdAt.toISOString() : null,
      updatedAt: result.updatedAt ? result.updatedAt.toISOString() : null,
    };

    return c.json({
      success: true,
      data: responseData,
    }, 200);
  });

  // GET /:groupId/schedule-config/time-slots
  app.get('/:groupId/schedule-config/time-slots', async (c) => {
    const groupId = c.req.param('groupId');
    const weekday = c.req.query('weekday');
    if (!weekday) {
      return c.json({ error: 'Weekday parameter is required' }, 400);
    }

    // Validate weekday format
    const validWeekdays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'];
    if (!validWeekdays.includes(weekday.toUpperCase())) {
      return c.json({ error: 'Invalid weekday parameter' }, 400);
    }

    const result = await mockGetGroupTimeSlots(groupId, weekday);
    return c.json({
      groupId,
      weekday,
      timeSlots: result,
    }, 200);
  });

  // PUT /:groupId/schedule-config
  app.put('/:groupId/schedule-config', async (c) => {
    const groupId = c.req.param('groupId');
    const body = await c.req.json();
    try {
      const result = await mockUpdateGroupScheduleConfig(groupId, body.scheduleHours);
      return c.json({
        ...result,
        isDefault: false,
      }, 200);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return c.json({ error: errorMessage }, 500);
    }
  });

  // POST /:groupId/schedule-config/reset
  app.post('/:groupId/schedule-config/reset', async (c) => {
    const groupId = c.req.param('groupId');
    const result = await mockResetGroupScheduleConfig(groupId);
    return c.json({
      ...result,
      isDefault: true,
    }, 200);
  });

  // GET /schedule-config/default
  app.get('/schedule-config/default', async (c) => {
    return c.json({
      success: true,
      data: {
        MONDAY: [],
        TUESDAY: [],
        WEDNESDAY: [],
        THURSDAY: [],
        FRIDAY: [],
      },
    }, 200);
  });

  return app;
};

export {
  mockGetGroupScheduleConfig,
  mockGetGroupTimeSlots,
  mockUpdateGroupScheduleConfig,
  mockResetGroupScheduleConfig,
  mockPrisma,
  createMockGroupController,
};