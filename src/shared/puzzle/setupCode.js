// Hidden setup on a Python or Turtle task (docs/authoring/python.md "Hidden setup"): the
// `setupCode` and `setupNote` task fields. Pure and Node-safe.
//
//   setupCode: |
//     playlist = ["Intro", "Theme"]
//   setupNote: playlist already exists
//
// setupCode runs first on every run, in the same program and namespace as the student's code
// (so its variables show in the name-tag panel and the checks see them), but never in the
// editor. The worker puts its lines after the student's last line (pyodide.worker.js), so the
// student's line numbers in errors, #@peek, slow-mo and hints are unchanged. An error inside it
// is the author's: the student sees SETUP_ERROR_TEXT, never its traceback (the real one goes to
// the browser console).

export const SETUP_ERROR_TEXT = "This task's setup has a problem — tell your tutor."

// A setupNote longer than this gets a validation warning (it shows as one short line).
export const SETUP_NOTE_CHARS = 120

export const SETUP_CODE_TASK_FIELD = Object.freeze({
  name: 'setupCode',
  type: 'string',
  authored: true,
  description:
    "Hidden setup: Python that runs before the student's code on every run, in the same program (its variables show in the name-tag panel and the checks see them). Never shown in the editor.",
})

export const SETUP_NOTE_TASK_FIELD = Object.freeze({
  name: 'setupNote',
  type: 'string',
  authored: true,
  description:
    'One short line shown above the editor saying what setupCode made, e.g. "playlist already exists".',
})

/** The task's setup code (null when it has none). */
export function getTaskSetupCode(task) {
  const code = task?.setupCode
  return typeof code === 'string' && code.trim() ? code : null
}

/** The task's setup note (null when it has none). */
export function getTaskSetupNote(task) {
  const note = task?.setupNote
  return typeof note === 'string' && note.trim() ? note.trim() : null
}

/**
 * What a run sends the worker for a task's setup: `{ code, afterLine }` (`afterLine`: how many
 * of the program's first lines are the runtime's own, e.g. Turtle's shim — the setup runs after
 * them), or null without setup.
 */
export function setupRunOptions(task, { afterLine = 0 } = {}) {
  const code = getTaskSetupCode(task)
  if (!code) return null
  return { code, afterLine: Number.isInteger(afterLine) && afterLine > 0 ? afterLine : 0 }
}

const CLOSERS = { ')': '(', ']': '[', '}': '{' }

/**
 * A quick syntax check that needs no Python: unclosed strings, unbalanced brackets and an
 * indented first line. Returns a plain-English problem, or null. It can't catch everything
 * Python would (the Builder's preview runs the real thing); it catches the usual slips.
 */
export function findSetupSyntaxProblem(code) {
  if (typeof code !== 'string') return null
  const stack = []
  let i = 0
  let line = 1
  const firstCode = code.split('\n').find((text) => text.trim() && !text.trim().startsWith('#'))
  if (firstCode && /^\s/.test(firstCode)) return 'its first line of code is indented'
  while (i < code.length) {
    const ch = code[i]
    if (ch === '\n') {
      line += 1
      i += 1
      continue
    }
    if (ch === '#') {
      while (i < code.length && code[i] !== '\n') i += 1
      continue
    }
    if (ch === '"' || ch === "'") {
      const triple = code.slice(i, i + 3) === ch.repeat(3)
      const quote = triple ? ch.repeat(3) : ch
      const startLine = line
      i += quote.length
      let closed = false
      while (i < code.length) {
        if (code[i] === '\\') {
          if (code[i + 1] === '\n') line += 1
          i += 2
          continue
        }
        if (code.slice(i, i + quote.length) === quote) {
          i += quote.length
          closed = true
          break
        }
        if (code[i] === '\n') {
          if (!triple) break
          line += 1
        }
        i += 1
      }
      if (!closed) return `a string on line ${startLine} is never closed`
      continue
    }
    if (ch === '(' || ch === '[' || ch === '{') stack.push({ ch, line })
    else if (CLOSERS[ch]) {
      const open = stack.pop()
      if (!open || open.ch !== CLOSERS[ch])
        return `line ${line} has a "${ch}" with no matching opener`
    }
    i += 1
  }
  const open = stack.pop()
  return open ? `a "${open.ch}" on line ${open.line} is never closed` : null
}

/** Builder / CLI validation of a Python or Turtle task's `setupCode` and `setupNote`. */
export function validateSetupCode(task, n, errors, warnings) {
  const raw = task?.setupCode
  if (raw != null) {
    if (typeof raw !== 'string') {
      errors.push(`Task ${n} setupCode must be Python code (text)`)
    } else if (!raw.trim()) {
      warnings.push(`Task ${n} setupCode is empty; it is ignored`)
    } else {
      const problem = findSetupSyntaxProblem(raw)
      if (problem) errors.push(`Task ${n} setupCode has a syntax problem: ${problem}`)
      if (/(^|[^\w.])input\s*\(/.test(raw)) {
        warnings.push(
          `Task ${n} setupCode calls input(), which would ask the student a question before their code runs`
        )
      }
      if (task.interactionMode === 'submit') {
        warnings.push(`Task ${n} setupCode never runs: the task is submitted, not run`)
      }
    }
  }
  const note = task?.setupNote
  if (note != null) {
    if (typeof note !== 'string') {
      errors.push(`Task ${n} setupNote must be text`)
    } else {
      if (note.trim().length > SETUP_NOTE_CHARS) {
        warnings.push(
          `Task ${n} setupNote is over ${SETUP_NOTE_CHARS} characters; keep it to one short line`
        )
      }
      if (!getTaskSetupCode(task)) {
        warnings.push(`Task ${n} has a setupNote but no setupCode`)
      }
    }
  }
}
