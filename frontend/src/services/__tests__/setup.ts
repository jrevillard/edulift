// Test setup for API client tests
import { vi } from 'vitest';

// Mock openapi-fetch with a complete client implementation
const mockClient = {
  use: vi.fn(),
  GET: vi.fn(),
  POST: vi.fn(),
  PATCH: vi.fn(),
  DELETE: vi.fn(),
  PUT: vi.fn(),
};

vi.mock('openapi-fetch', () => ({
  default: vi.fn(() => mockClient),
}));