/**
 * Is the shared Python worker stuck? (deep review 2026-11-10, R3.) pyodide.js sets it when a
 * worker dies before it got ready (its onerror: e.g. a mid-class deploy removed the old hashed
 * worker file) or has not said "ready" in time (that worker lives on: a slow download that then
 * finishes clears it again); the student screens show "Python fell asleep" with one Reload
 * button (src/shared/PythonAsleepPrompt.jsx; "Python is taking a while" while the load is only
 * slow, third review). Kept apart from pyodide.js so the many tests that mock pyodide.js still
 * get the real flag.
 */

// What a Run or a load says while Python is stuck, for the callers with an output or status line
// (teacher sandbox, Builder preview, code files, a shared link, electronics).
export const PYTHON_ASLEEP_MESSAGE = 'Python fell asleep. Reload the page to wake it up.'
// The same, while the load is only slow (third review, 10 Nov): nothing is wrong yet.
export const PYTHON_SLOW_MESSAGE = 'Python is taking a while… Reload 🔄 if it stays stuck'

/** True for the error initPyodide throws while Python is stuck (or slow). */
export function isPythonAsleepError(err) {
  const message = String(err?.message ?? err)
  return message.includes(PYTHON_ASLEEP_MESSAGE) || message.includes(PYTHON_SLOW_MESSAGE)
}

/**
 * The line a caught Run or load error adds to an output: the stuck (or slow) message and a
 * newline, or '' for any other error.
 */
export function asleepNote(err) {
  if (!isPythonAsleepError(err)) return ''
  const slow = String(err?.message ?? err).includes(PYTHON_SLOW_MESSAGE)
  return `${slow ? PYTHON_SLOW_MESSAGE : PYTHON_ASLEEP_MESSAGE}\n`
}

// 'ok'; 'slow' (no "ready" after the first timer: the student sees the prompt, the tutor nothing);
// 'stuck' (the worker errored, or no "ready" after the second timer: the tutor's chip too).
let level = 'ok'
const listeners = new Set()

export function getPythonHealthLevel() {
  return level
}

/** True while the student screens show the prompt (slow or stuck): Run waits. */
export function isPythonStuck() {
  return level !== 'ok'
}

function setLevel(next) {
  if (next === level) return
  level = next
  for (const listener of [...listeners]) listener(level !== 'ok', level)
}

/** true: really stuck; false: fine again. */
export function setPythonStuck(value) {
  setLevel(value ? 'stuck' : 'ok')
}

/** The load is slow (not stuck): only from 'ok', never down from 'stuck'. */
export function setPythonSlow() {
  if (level === 'ok') setLevel('slow')
}

/** Calls `listener(shown, level)` on every change of level; returns the unsubscribe. */
export function onPythonStuckChange(listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
