/**
 * Test Setup File
 *
 * This file runs before all tests to ensure proper test environment setup,
 * particularly for WebSocket functionality that requires global state.
 */

// Set test environment variables
process.env.FRONTEND_URL = 'https://app.edulift.com';

import { setGlobalSocketHandler } from './utils/socketEmitter';

// Mock SocketHandler for tests
const mockSocketHandler = {
  broadcastToGroup: jest.fn(),
  broadcastToUser: jest.fn(),
  getConnectedUsers: jest.fn().mockReturnValue(0),
  forceDisconnectUser: jest.fn(),
  getIO: jest.fn(),
  cleanup: jest.fn(),
};

// Set up global mock SocketHandler before any tests run
beforeAll(() => {
  setGlobalSocketHandler(mockSocketHandler);
});

// Clean up after all tests
afterAll(() => {
  setGlobalSocketHandler(null);
});

// Reset mocks before each test for clean slate
beforeEach(() => {
  jest.clearAllMocks();
  // Re-set the mock handler in case any test changed it
  setGlobalSocketHandler(mockSocketHandler);
});

// Export the mock for tests that need to verify calls
export { mockSocketHandler };