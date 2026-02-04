import { vi, beforeAll, afterAll, afterEach } from 'vitest';

// Global test setup

beforeAll(() => {
  // Set test environment
  process.env.NODE_ENV = 'test';
});

afterEach(() => {
  // Clear all mocks after each test
  vi.clearAllMocks();
});

afterAll(() => {
  // Cleanup after all tests
  vi.restoreAllMocks();
});

// Mock console.error to reduce noise in tests
vi.spyOn(console, 'error').mockImplementation(() => {});

// Helper to restore console.error when needed
export const restoreConsoleError = () => {
  vi.spyOn(console, 'error').mockRestore();
};
