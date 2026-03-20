import { defineConfig } from '@playwright/test';

/**
 * Local Playwright config for E2E tests
 * Restricts test discovery to e2e/ folder ONLY
 * Prevents scanning frontend/ and backend/ unit tests
 */
export default defineConfig({
  // CRITICAL: Only scan e2e/tests directory - ignore everything else
  // This prevents Playwright from scanning frontend/ and backend/ unit tests
  // which have different test frameworks (Vitest/Jest) and cause errors
  testMatch: '**/tests/**/*.spec.ts',

  // Explicitly ignore patterns for non-E2E directories
  testIgnore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/.nuxt/**',
    '**/frontend/**',    // Ignore frontend unit tests
    '**/backend/**',     // Ignore backend unit tests
    '**/flutter/**',     // Ignore flutter tests
  ],
});
