// Dependency-free vi.mock factories for tests that render useStudentCodeState (see
// ./studentCodeStateHarness.js). Kept separate from the harness so a factory can be
// imported lazily inside vi.mock without pulling the app module graph (and the very
// module being mocked) into the mock's own resolution.
import { vi } from 'vitest'

/** Stand-in for src/modules/python/pyodide.js — no Worker, always "ready". */
export function pyodideMock() {
  return {
    initPyodide: vi.fn(() => Promise.resolve()),
    runPython: vi.fn(() => Promise.resolve({ status: 'success' })),
    stopPython: vi.fn(),
    provideInput: vi.fn(),
    updateGpioInputs: vi.fn(),
    isPyodideReady: () => true,
  }
}

const EMPTY_ASSETS = []

/** Stand-in for src/shared/useTypeAssets.js — no Firestore listener. */
export function typeAssetsMock() {
  return { useTypeAssets: () => ({ typeStorageAssets: EMPTY_ASSETS, loading: false }) }
}

/** Stand-in for src/shared/useLessonStorageAssets.js — no Storage listing. */
export function lessonStorageAssetsMock() {
  return { useLessonStorageAssets: () => ({ storageAssets: EMPTY_ASSETS, loading: false }) }
}
