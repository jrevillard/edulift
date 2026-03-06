/**
 * Test setup for max listeners
 *
 * This file increases the max listeners for the process to prevent
 * MaxListenersExceededWarning during Jest test runs.
 * The warning occurs when multiple test workers are created and
 * each adds listeners to the process exit event.
 */

// Increase max listeners to prevent warnings during test execution
// Some libraries (like Prisma) add multiple exit listeners during tests
process.setMaxListeners(50);

// Suppress MaxListenersExceededWarning in tests
process.on('warning', (warning) => {
  if (warning.name === 'MaxListenersExceededWarning') {
    // Ignore this specific warning as it's expected in Jest parallel testing
    return;
  }
  // Log other warnings as usual
  console.warn(warning);
});