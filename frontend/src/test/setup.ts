import '@testing-library/jest-dom'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Interface for test environment window extension
interface TestWindow extends Window {
  __TEST_ENVIRONMENT__?: boolean;
}

// Set global test environment flag to prevent navigation redirects in API client
if (typeof window !== 'undefined') {
  (window as TestWindow).__TEST_ENVIRONMENT__ = true
}

// Automatic cleanup after each test
afterEach(() => {
  cleanup()
})

// Mock window.matchMedia (required for some components)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => { },
      removeListener: () => { },
      addEventListener: () => { },
      removeEventListener: () => { },
      dispatchEvent: () => { },
    }),
  })
}

// Mock IntersectionObserver
(globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = class IntersectionObserver {
  constructor() { }
  observe() {
    return null
  }
  disconnect() {
    return null
  }
  unobserve() {
    return null
  }
}

// Mock scrollIntoView (required for Radix UI components)
if (typeof Element !== 'undefined') {
  Element.prototype.scrollIntoView = function () {
    // Mock implementation - do nothing
  }
}

// Mock getBoundingClientRect
if (typeof Element !== 'undefined') {
  Element.prototype.getBoundingClientRect = function () {
    return {
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => { }
    }
  }
}

// Mock console.error to clean up test output
const originalError = console.error
console.error = (...args) => {
  if (
    typeof args[0] === 'string' &&
    args[0].includes('Warning: ReactDOM.render is deprecated')
  ) {
    return
  }
  originalError.call(console, ...args)
}