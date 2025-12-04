// Test setup for API client tests
import { vi } from 'vitest';

// Mock openapi-fetch with a complete client implementation
const mockClient = {
  use: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
  put: vi.fn(),
};

vi.mock('openapi-fetch', () => ({
  default: vi.fn(() => mockClient),
}));