/**
 * Is the shared Python worker stuck? (deep review 2026-11-10, R3.) pyodide.js sets it when a
 * worker dies before it got ready (its onerror: e.g. a mid-class deploy removed the old hashed
 * worker file) or has not said "ready" in time (that worker lives on: a slow download that then
 * finishes clears it again); the student screens show "Python fell asleep" with one Reload
 * button (src/shared/PythonAsleepPrompt.jsx). Kept apart from pyodide.js so the many tests that
 * mock pyodide.js still get the real flag.
 */

// What a Run or a load says while Python is stuck, for the callers with an output or status line
// (teacher sandbox, Builder preview, code files, a shared link, electronics).
export const PYTHON_ASLEEP_MESSAGE = 'Python fell asleep. Reload the page to wake it up.'

let stuck = false
const listeners = new Set()

export function isPythonStuck() {
  return stuck
}

export function setPythonStuck(value) {
  const next = !!value
  if (next === stuck) return
  stuck = next
  for (const listener of [...listeners]) listener(stuck)
}

/** Calls `listener(stuck)` on every change; returns the unsubscribe. */
export function onPythonStuckChange(listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
