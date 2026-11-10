/**
 * Is the shared Python worker stuck? (deep review 2026-11-10, R3.) pyodide.js sets it when the
 * worker dies (its onerror: e.g. a mid-class deploy removed the old hashed worker file) or when it
 * never says "ready" in time; the student screens show "Python fell asleep" with one Reload
 * button (src/shared/PythonAsleepPrompt.jsx). Kept apart from pyodide.js so the many tests that
 * mock pyodide.js still get the real flag.
 */

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
