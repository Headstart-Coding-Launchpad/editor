import '@testing-library/jest-dom'

// Query jsdom's storage instead of Node's native getter, which warns when no
// persistence file is configured in recent Node versions.
if (typeof window.localStorage?.clear !== 'function') {
  const values = new Map()
  const storage = {
    get length() { return values.size },
    clear: () => values.clear(),
    getItem: key => values.has(String(key)) ? values.get(String(key)) : null,
    key: index => Array.from(values.keys())[index] ?? null,
    removeItem: key => values.delete(String(key)),
    setItem: (key, value) => values.set(String(key), String(value)),
  }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
}

// matchMedia mock — jsdom does not implement it
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// ResizeObserver — jsdom does not implement it. No-op by default so components that
// merely mount it (SplitPane's minLeftPx, useElementSize, ScratchWorkspace) don't crash;
// tests that need to actually drive resize behavior stub it locally instead (see
// useElementSize.test.jsx) — a local `globalThis.ResizeObserver = ...` override in a test
// takes precedence for that test and is expected to restore this default afterward.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// Blob URL mocks
global.URL.createObjectURL = () => 'blob:mock-url'
global.URL.revokeObjectURL = () => {}

// crypto.randomUUID mock for predictable IDs in tests
if (!global.crypto) {
  global.crypto = {}
}
if (!global.crypto.randomUUID) {
  let counter = 0
  global.crypto.randomUUID = () => `test-uuid-${++counter}`
}
