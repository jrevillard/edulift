import { z } from 'zod';

/**
 * Zod validation schemas for WebSocket event payloads
 * Provides runtime type safety and validation for client-sent data
 */

// Common schemas
const idSchema = z.string().min(1, 'ID cannot be empty');
const weekSchema = z.string().regex(/^\d{4}-\d{1,2}$/, 'Week must be in format YYYY-W or YYYY-WW (e.g., 2024-1 or 2024-12)');

/**
 * Schedule Slot Join/Leave payload validation
 */
export const scheduleSlotJoinSchema = z.object({
  scheduleSlotId: idSchema,
});

export type ScheduleSlotJoinData = z.infer<typeof scheduleSlotJoinSchema>;

/**
 * Schedule Slot Update payload validation
 * Matches ScheduleSlotUpdateData interface in SocketService
 */
export const scheduleSlotUpdateSchema = z.object({
  scheduleSlotId: idSchema,
  vehicleId: idSchema.optional(),
  driverId: idSchema.optional(),
  childrenIds: z.array(idSchema).optional(),
  action: z.enum(['assign', 'remove']).optional(),
});

export type ScheduleSlotUpdateData = z.infer<typeof scheduleSlotUpdateSchema>;

/**
 * Group Join/Leave payload validation
 */
export const groupJoinSchema = z.object({
  groupId: idSchema,
});

export type GroupJoinData = z.infer<typeof groupJoinSchema>;

/**
 * Schedule Subscribe/Unsubscribe payload validation
 */
export const scheduleSubscribeSchema = z.object({
  groupId: idSchema,
  week: weekSchema,
});

export type ScheduleSubscribeData = z.infer<typeof scheduleSubscribeSchema>;

/**
 * Typing events payload validation
 */
export const typingStartSchema = z.object({
  scheduleSlotId: idSchema,
});

export type TypingStartData = z.infer<typeof typingStartSchema>;

/**
 * Authentication payload validation (for test events)
 */
export const authenticateSchema = z.object({
  userId: idSchema,
});

export type AuthenticateData = z.infer<typeof authenticateSchema>;

/**
 * Simple ID payload validation for test events
 */
export const simpleIdSchema = z.object({
  id: idSchema,
});

export type SimpleIdData = z.infer<typeof simpleIdSchema>;

/**
 * Heartbeat acknowledgment payload validation (server-to-client)
 */
export const heartbeatAckSchema = z.object({
  timestamp: z.number().int().positive(),
});

export type HeartbeatAckData = z.infer<typeof heartbeatAckSchema>;

/**
 * Error payload validation (server-to-client)
 */
export const errorPayloadSchema = z.object({
  type: z.string(),
  message: z.string(),
});

export type ErrorPayload = z.infer<typeof errorPayloadSchema>;

/**
 * Connection success payload validation (server-to-client)
 */
export const connectedPayloadSchema = z.object({
  userId: idSchema,
  groups: z.array(idSchema),
  timestamp: z.number().int().positive(),
});

export type ConnectedPayload = z.infer<typeof connectedPayloadSchema>;

/**
 * Validates a payload against a schema and returns a detailed error if invalid
 *
 * @param schema - The Zod schema to validate against
 * @param payload - The payload to validate
 * @returns Object with success flag and optional error message
 */
export const validatePayload = <T extends z.ZodType>(
  schema: T,
  payload: unknown,
): { success: true; data: z.infer<T> } | { success: false; error: string } => {
  const result = schema.safeParse(payload);

  if (result.success) {
    return { success: true, data: result.data };
  }

  // Format error messages for better debugging
  const errorMessages = result.error.issues.map((e: z.ZodIssue) =>
    `${e.path.join('.')}: ${e.message}`,
  ).join('; ');

  return {
    success: false,
    error: `Invalid payload: ${errorMessages}`,
  };
};
