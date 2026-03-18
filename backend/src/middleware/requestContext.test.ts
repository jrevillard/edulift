/**
 * Unit tests for request context middleware
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { requestContextMiddleware } from './requestContext';
import { Context, Next } from 'hono';

// Mock the getClientIP function
jest.mock('../utils/ipExtractor', () => ({
  getClientIP: jest.fn(() => '192.168.1.100'),
}));

describe('requestContextMiddleware', () => {
  let mockContext: Context;
  let mockNext: Next;

  beforeEach(() => {
    // Create a mock Hono context
    mockContext = {
      req: {
        header: jest.fn((name: string) => {
          const headers: Record<string, string> = {
            'user-agent': 'Mozilla/5.0 Test Browser',
          };
          return headers[name.toLowerCase()] || headers[name];
        }),
        method: 'GET',
        url: 'https://example.com/api/test?param=value',
      },
      set: jest.fn(),
      get: jest.fn(),
    } as unknown as Context;

    // Create a mock next function
    mockNext = jest.fn(async () => Promise.resolve());
  });

  it('should extract and set request metadata in context', async () => {
    await requestContextMiddleware(mockContext, mockNext);

    // Verify that set was called with requestMetadata
    expect(mockContext.set).toHaveBeenCalledWith(
      'requestMetadata',
      expect.objectContaining({
        clientIp: '192.168.1.100',
        userAgent: 'Mozilla/5.0 Test Browser',
        requestId: expect.any(String),
        timestamp: expect.any(String),
        method: 'GET',
        path: '/api/test',
      })
    );
  });

  it('should generate a unique requestId for each request', async () => {
    // Create two completely separate contexts
    const context1: Context = {
      req: {
        header: jest.fn(() => 'Agent1'),
        method: 'GET',
        url: 'https://example.com/api/test1',
      },
      set: jest.fn(),
      get: jest.fn(),
    } as unknown as Context;

    const context2: Context = {
      req: {
        header: jest.fn(() => 'Agent2'),
        method: 'POST',
        url: 'https://example.com/api/test2',
      },
      set: jest.fn(),
      get: jest.fn(),
    } as unknown as Context;

    await requestContextMiddleware(context1, mockNext);
    await requestContextMiddleware(context2, mockNext);

    const metadata1 = (context1.set as any).mock.calls.find(
      (call: any[]) => call[0] === 'requestMetadata'
    )[1];

    const metadata2 = (context2.set as any).mock.calls.find(
      (call: any[]) => call[0] === 'requestMetadata'
    )[1];

    expect(metadata1.requestId).not.toBe(metadata2.requestId);
  });

  it('should set individual properties for easier access', async () => {
    await requestContextMiddleware(mockContext, mockNext);

    const calls = (mockContext.set as any).mock.calls;

    // Check for clientIp
    expect(calls).toContainEqual(['clientIp', '192.168.1.100']);

    // Check for requestId
    const requestIdCall = calls.find((call: any[]) => call[0] === 'requestId');
    expect(requestIdCall).toBeDefined();
    expect(requestIdCall[1]).toMatch(/^[a-f0-9-]{36}$/i); // UUID format (case insensitive)

    // Check for requestTimestamp
    const timestampCall = calls.find((call: any[]) => call[0] === 'requestTimestamp');
    expect(timestampCall).toBeDefined();
    expect(timestampCall[1]).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601 format
  });

  it('should extract correct path without query string', async () => {
    await requestContextMiddleware(mockContext, mockNext);

    const metadataCall = (mockContext.set as any).mock.calls.find(
      (call: any[]) => call[0] === 'requestMetadata'
    );

    expect(metadataCall[1].path).toBe('/api/test');
  });

  it('should handle missing user-agent header', async () => {
    const contextWithoutUA: Context = {
      ...mockContext,
      req: {
        ...mockContext.req,
        header: jest.fn(() => undefined),
      },
    } as unknown as Context;

    await requestContextMiddleware(contextWithoutUA, mockNext);

    const metadataCall = (contextWithoutUA.set as any).mock.calls.find(
      (call: any[]) => call[0] === 'requestMetadata'
    );

    expect(metadataCall[1].userAgent).toBeUndefined();
  });

  it('should call next() to continue middleware chain', async () => {
    await requestContextMiddleware(mockContext, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('should handle different HTTP methods', async () => {
    const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

    for (const method of methods) {
      // Create fresh context for each method
      const contextWithMethod: Context = {
        req: {
          header: jest.fn((name: string) => {
            const headers: Record<string, string> = {
              'user-agent': 'Mozilla/5.0 Test Browser',
            };
            return headers[name.toLowerCase()] || headers[name];
          }),
          method,
          url: 'https://example.com/api/test',
        },
        set: jest.fn(),
        get: jest.fn(),
      } as unknown as Context;

      await requestContextMiddleware(contextWithMethod, mockNext);

      const metadataCall = (contextWithMethod.set as any).mock.calls.find(
        (call: any[]) => call[0] === 'requestMetadata'
      );

      expect(metadataCall[1].method).toBe(method);
    }
  });

  it('should generate timestamps in ISO 8601 format', async () => {
    await requestContextMiddleware(mockContext, mockNext);

    const metadataCall = (mockContext.set as any).mock.calls.find(
      (call: any[]) => call[0] === 'requestMetadata'
    );

    const timestamp = metadataCall[1].timestamp;

    // Verify ISO 8601 format
    expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

    // Verify it's a valid date
    const date = new Date(timestamp);
    expect(date.toISOString()).toBe(timestamp);

    // Verify it's recent (within last second)
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    expect(diff).toBeLessThan(1000);
  });

  it('should extract correct path for root URL', async () => {
    const contextWithRoot: Context = {
      ...mockContext,
      req: {
        ...mockContext.req,
        url: 'https://example.com/',
      },
    } as unknown as Context;

    await requestContextMiddleware(contextWithRoot, mockNext);

    const metadataCall = (contextWithRoot.set as any).mock.calls.find(
      (call: any[]) => call[0] === 'requestMetadata'
    );

    expect(metadataCall[1].path).toBe('/');
  });

  it('should handle complex paths with multiple segments', async () => {
    const contextWithComplexPath: Context = {
      ...mockContext,
      req: {
        ...mockContext.req,
        url: 'https://example.com/api/v1/users/123/posts/456?filter=active',
      },
    } as unknown as Context;

    await requestContextMiddleware(contextWithComplexPath, mockNext);

    const metadataCall = (contextWithComplexPath.set as any).mock.calls.find(
      (call: any[]) => call[0] === 'requestMetadata'
    );

    expect(metadataCall[1].path).toBe('/api/v1/users/123/posts/456');
  });

  it('should preserve the context throughout middleware execution', async () => {
    const originalSet = mockContext.set;

    await requestContextMiddleware(mockContext, mockNext);

    // Verify set was called multiple times (requestMetadata + individual props)
    expect(originalSet).toHaveBeenCalledTimes(4);

    // Verify the context wasn't corrupted
    expect(mockContext.set).toBe(originalSet);
  });
});
