/**
 * Mock for the openapi-fetch API client
 * Prevents actual network requests during tests
 */

import { vi } from 'vitest';

// Create mock client
const mockClient = {
  GET: vi.fn(),
  POST: vi.fn(),
  PUT: vi.fn(),
  PATCH: vi.fn(),
  DELETE: vi.fn(),
  use: vi.fn(),
};

// Export the mock client as default and as named export
export const api = mockClient;
export default mockClient;

// Helper to reset all mocks
export const resetApiMocks = () => {
  mockClient.GET.mockReset();
  mockClient.POST.mockReset();
  mockClient.PUT.mockReset();
  mockClient.PATCH.mockReset();
  mockClient.DELETE.mockReset();
  mockClient.use.mockReset();
};

// Helper to mock successful response
export const mockSuccess = (data: unknown) => ({
  data,
  error: null,
});

// Helper to mock error response
export const mockError = (error: unknown) => ({
  data: null,
  error,
});
