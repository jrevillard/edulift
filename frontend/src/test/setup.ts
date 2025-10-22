import '@testing-library/jest-dom'

// Mock window.matchMedia (required for some components)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  })
}

// Mock IntersectionObserver
(globalThis as { IntersectionObserver?: unknown }).IntersectionObserver = class IntersectionObserver {
  constructor() {}
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
  Element.prototype.scrollIntoView = function() {
    // Mock implementation - do nothing
  }
}

// Mock getBoundingClientRect
if (typeof Element !== 'undefined') {
  Element.prototype.getBoundingClientRect = function() {
    return {
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => {}
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