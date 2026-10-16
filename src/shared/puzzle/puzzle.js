// Puzzle rules on a Python or Turtle task (docs/authoring/python.md "Puzzle rules"): the
// `puzzle` task field and the `max_lines` check. Pure and Node-safe: the classroom, the
// Builder, the CLI and the session report share it.
//
//   puzzle:
//     onlyEdit: [2]   # lock every non-blank starter line except these (see ../lockedLines.js)
//     maxLines: 4     # at most this many lines of code: a live "3 / 4 lines" counter, and the
//                     # max_lines check's limit
//     par: 1          # lines changed or added compared with the starter. Never pass/fail: after
//                     # a pass the student sees "Solved in 2 changes (par 1)" / "Solved at par ⭐"
//     noNewLines: true  # students can't add a line anywhere, only edit lines and slots (P6-30;
//                       # see ../lockedLinesEditor.js)
//
// Lines of code (maxLines, linesUsed) are the non-blank lines that aren't only a comment.
// Locked lines count; a task's hidden setupCode never does (it isn't in the student's code).
import { parseLineHints } from '../lineHints.js'
import {
  isLockMarkerLine,
  isLockValuesMarkerLine,
  lockFenceOfMarkerLine,
  lineValueSpans,
  onlyEditLocks,
  valueSkeleton,
} from '../lockedLines.js'
import { getCompleteStage, getStarterStage } from '../taskStages.js'

// A check field as a list (no import of ../../modules/checks.js: its registry imports this file).
function normalizeChecks(check) {
  if (!check) return []
  return (Array.isArray(check) ? check : [check]).filter((c) => c?.type)
}

export const MAX_LINES_CHECK_TYPE = 'max_lines'

// The task field, as python and turtle declare it in their definitions' taskFields.
export const PUZZLE_TASK_FIELD = Object.freeze({
  name: 'puzzle',
  type: 'object',
  description:
    'Puzzle rules: { onlyEdit: [starter line numbers the student may change; every other non-blank line is locked], maxLines: most lines of code allowed (blank and comment lines do not count; shows a live counter; the max_lines check enforces it), par: lines changed or added compared with the starter (never pass/fail; shown after a pass), noNewLines: true (students cannot add a line anywhere; they edit the editable lines and #@slot slots only) }.',
})

const KNOWN_KEYS = new Set(['onlyEdit', 'maxLines', 'par', 'noNewLines'])

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

const isWholeNumber = (value, min) => Number.isInteger(value) && value >= min

/**
 * The task's puzzle rules, normalised — `{ onlyEdit, maxLines, par, noNewLines }` (each null,
 * or false, when unset) — or null when the task has none.
 */
export function getTaskPuzzle(task) {
  const raw = task?.puzzle
  if (!isPlainObject(raw)) return null
  const onlyEdit = Array.isArray(raw.onlyEdit)
    ? raw.onlyEdit.filter((line) => isWholeNumber(line, 1))
    : null
  const maxLines = isWholeNumber(raw.maxLines, 1) ? raw.maxLines : null
  const par = isWholeNumber(raw.par, 0) ? raw.par : null
  const noNewLines = raw.noNewLines === true
  if (onlyEdit == null && maxLines == null && par == null && !noNewLines) return null
  return { onlyEdit, maxLines, par, noNewLines }
}

// A line of code: not blank, and not only a comment.
export function isCodeLine(line) {
  const trimmed = String(line ?? '').trim()
  return trimmed !== '' && !trimmed.startsWith('#')
}

/** How many lines of code `code` has (blank and comment-only lines don't count). */
export function countCodeLines(code) {
  if (typeof code !== 'string') return 0
  return code.split('\n').filter(isCodeLine).length
}

// The lines of code compared for par: indentation kept (it matters in Python), trailing
// spaces dropped.
function parLines(code) {
  return String(code ?? '')
    .split('\n')
    .filter(isCodeLine)
    .map((line) => line.trimEnd())
}

/**
 * Lines changed or added compared with the starter: the lines of code each side has that the
 * other lacks (a longest-common-subsequence match), the larger of the two — so changing a line
 * is 1, adding two is 2 and deleting one is 1. Blank and comment lines never count.
 */
export function countChangesFromStarter(code, starterCode) {
  const a = parLines(starterCode)
  const b = parLines(code)
  // LCS length, one row at a time.
  let prev = new Array(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i += 1) {
    const row = new Array(b.length + 1).fill(0)
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], row[j - 1])
    }
    prev = row
  }
  const common = prev[b.length]
  return Math.max(a.length - common, b.length - common)
}

// The starter code a task's puzzle compares against, without author markers (a classroom task
// is already stripped; an authored one is stripped here).
export function puzzleStarterCode(task) {
  const raw = getStarterStage(task)?.stage?.code ?? task?.starterCode ?? ''
  return parseLineHints(String(raw ?? ''), 'python').code
}

function puzzleCompleteCode(task) {
  const raw = getCompleteStage(task)?.stage?.code ?? task?.completeCode
  return typeof raw === 'string' ? parseLineHints(raw, 'python').code : null
}

/** The live line counter: `{ used, max, over, text }`, or null without `maxLines`. */
export function lineCounter(code, puzzle) {
  if (!puzzle?.maxLines) return null
  const used = countCodeLines(code)
  return {
    used,
    max: puzzle.maxLines,
    over: used > puzzle.maxLines,
    text: `${used} / ${puzzle.maxLines} lines`,
  }
}

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`

/**
 * What a passed puzzle with a par says: `{ changes, par, atPar, text }`, or null without `par`.
 * At (or under) par the text carries ⭐ with words; otherwise it says how many changes it took.
 */
export function parResult(code, task) {
  const puzzle = getTaskPuzzle(task)
  if (puzzle?.par == null) return null
  const changes = countChangesFromStarter(code, puzzleStarterCode(task))
  const atPar = changes <= puzzle.par
  const text =
    changes === puzzle.par
      ? 'Solved at par ⭐'
      : atPar
        ? `Solved in ${plural(changes, 'change')}, under par (par ${puzzle.par}) ⭐`
        : `Solved in ${plural(changes, 'change')} (par ${puzzle.par})`
  return { changes, par: puzzle.par, atPar, text }
}

/** The default hint of a max_lines check: "Can you do it in 4 lines? A loop might help." */
export function maxLinesHint(limit) {
  return `Can you do it in ${plural(limit, 'line')}? A loop might help.`
}

/**
 * The `max_lines` check: passes when the student's code (`context.code`) has at most `value`
 * lines of code. A task's checks get their `value` from `puzzle.maxLines` when they leave it out
 * (resolvePuzzleChecks). No run needed.
 */
export function evaluateMaxLinesCheck(check, context = {}) {
  const limit = Number(check?.value)
  if (!Number.isFinite(limit) || limit < 1 || typeof context?.code !== 'string') return false
  return countCodeLines(context.code) <= limit
}

function resolveCheckList(raw, maxLines) {
  if (raw == null) return raw
  let changed = false
  const resolve = (check) => {
    if (check?.type !== MAX_LINES_CHECK_TYPE) return check
    const value = check.value ?? maxLines
    const hint = check.hint ?? (Number.isFinite(Number(value)) ? maxLinesHint(Number(value)) : null)
    if (value === check.value && hint === check.hint) return check
    changed = true
    return {
      ...check,
      ...(value != null ? { value } : {}),
      ...(hint ? { hint } : {}),
    }
  }
  const next = Array.isArray(raw) ? raw.map(resolve) : resolve(raw)
  return changed ? next : raw
}

/**
 * The task with each `max_lines` check (completion and feedback) given its limit from
 * `puzzle.maxLines` when it has no `value`, and the default hint when it has no `hint`. The same
 * task comes back when nothing changed. Applied where the classroom loads its lesson and before
 * `lessons test-checks` evaluates a task.
 */
export function resolvePuzzleChecks(task) {
  if (!task || typeof task !== 'object') return task
  const maxLines = getTaskPuzzle(task)?.maxLines ?? null
  const check = resolveCheckList(task.check, maxLines)
  const feedbackChecks = resolveCheckList(task.feedbackChecks, maxLines)
  if (check === task.check && feedbackChecks === task.feedbackChecks) return task
  const next = { ...task, check }
  if (task.feedbackChecks !== undefined) next.feedbackChecks = feedbackChecks
  return next
}

/** The lesson with resolvePuzzleChecks applied to every task (groups' subtasks included). */
export function resolveLessonPuzzleChecks(lesson) {
  if (!lesson || !Array.isArray(lesson.tasks)) return lesson
  let changed = false
  const mapTasks = (tasks) =>
    tasks.map((task) => {
      if (task?.type === 'group' && Array.isArray(task.subtasks)) {
        const subtasks = mapTasks(task.subtasks)
        return subtasks.some((sub, i) => sub !== task.subtasks[i]) ? { ...task, subtasks } : task
      }
      const next = resolvePuzzleChecks(task)
      if (next !== task) changed = true
      return next
    })
  const tasks = mapTasks(lesson.tasks)
  return changed || tasks.some((task, i) => task !== lesson.tasks[i])
    ? { ...lesson, tasks }
    : lesson
}

// ─── Session report ──────────────────────────────────────────────────────────

/**
 * The report's puzzle fields for one student's task — `{ linesUsed, changesFromStarter }` from
 * the code of their passing run — or {} when the task has no puzzle or they never passed.
 */
export function puzzleReportFields(task, passingSubmission) {
  if (!getTaskPuzzle(task) || typeof passingSubmission !== 'string') return {}
  return {
    linesUsed: countCodeLines(passingSubmission),
    changesFromStarter: countChangesFromStarter(passingSubmission, puzzleStarterCode(task)),
  }
}

/**
 * The tutor's student-card note for a puzzle task: 'Solved at par' (passed, at or under par),
 * 'Over line limit' (more lines of code than maxLines), or null.
 */
export function puzzleCardNote(task, code, passed) {
  const puzzle = getTaskPuzzle(task)
  if (!puzzle || typeof code !== 'string') return null
  if (puzzle.maxLines && countCodeLines(code) > puzzle.maxLines) return 'Over line limit'
  if (passed && puzzle.par != null && parResult(code, task)?.atPar) return 'Solved at par'
  return null
}

// ─── Validation (Builder and CLI) ────────────────────────────────────────────

/** Builder / CLI validation of a Python or Turtle task's `puzzle` and `max_lines` checks. */
export function validatePuzzle(task, n, errors, warnings) {
  const raw = task?.puzzle
  const maxLinesChecks = [
    ...normalizeChecks(task?.check).map((check) => ({ check, kind: 'check' })),
    ...normalizeChecks(task?.feedbackChecks).map((check) => ({ check, kind: 'feedback check' })),
  ].filter(({ check }) => check?.type === MAX_LINES_CHECK_TYPE)

  if (raw != null && !isPlainObject(raw)) {
    errors.push(`Task ${n} puzzle must be an object, e.g. { maxLines: 4 }`)
    return
  }
  const puzzle = raw ?? {}
  for (const { check, kind } of maxLinesChecks) {
    if (check.value == null && puzzle.maxLines == null) {
      errors.push(
        `Task ${n} has a max_lines ${kind} but no limit: set puzzle.maxLines or the check's value`
      )
    } else if (check.value != null && !isWholeNumber(Number(check.value), 1)) {
      errors.push(`Task ${n} has a max_lines ${kind} whose value is not a whole number of lines`)
    }
  }
  if (raw == null) return

  const extra = Object.keys(raw).filter((key) => !KNOWN_KEYS.has(key))
  if (extra.length > 0) {
    warnings.push(`Task ${n} puzzle has unknown key(s) ${extra.join(', ')}; they are ignored`)
  }
  if (raw.maxLines != null && !isWholeNumber(raw.maxLines, 1)) {
    errors.push(`Task ${n} puzzle.maxLines must be a whole number of lines, 1 or more`)
  }
  if (raw.par != null && !isWholeNumber(raw.par, 0)) {
    errors.push(`Task ${n} puzzle.par must be a whole number of changes, 0 or more`)
  }
  if (raw.noNewLines != null && typeof raw.noNewLines !== 'boolean') {
    errors.push(`Task ${n} puzzle.noNewLines must be true or false`)
  }

  const starter = puzzleStarterCode(task)
  const starterLines = starter.split('\n')
  if (raw.onlyEdit != null) {
    if (!Array.isArray(raw.onlyEdit) || raw.onlyEdit.some((line) => !isWholeNumber(line, 1))) {
      errors.push(`Task ${n} puzzle.onlyEdit must be a list of starter line numbers, e.g. [2, 3]`)
    } else {
      const outOfRange = raw.onlyEdit.filter((line) => line > starterLines.length)
      if (outOfRange.length > 0) {
        errors.push(
          `Task ${n} puzzle.onlyEdit line ${outOfRange.join(', ')} is past the end of the starter code (${starterLines.length} lines, not counting marker lines)`
        )
      }
      if (raw.onlyEdit.length === 0) {
        warnings.push(`Task ${n} puzzle.onlyEdit is empty, so every starter line is locked`)
      }
    }
  }

  if (raw.maxLines != null && maxLinesChecks.length === 0) {
    warnings.push(
      `Task ${n} puzzle.maxLines shows a line counter, but no max_lines check enforces it — add { type: max_lines } to the check`
    )
  }

  // Every puzzle must be solvable within its rules: the complete code is the proof.
  const complete = puzzleCompleteCode(task)
  if (complete == null) {
    if (raw.maxLines != null || raw.par != null) {
      warnings.push(
        `Task ${n} has puzzle rules but no complete code, so they can't be checked as solvable`
      )
    }
  } else {
    if (isWholeNumber(raw.maxLines, 1) && countCodeLines(complete) > raw.maxLines) {
      errors.push(
        `Task ${n} complete code has ${countCodeLines(complete)} lines of code, over puzzle.maxLines ${raw.maxLines}`
      )
    }
    if (isWholeNumber(raw.par, 0)) {
      const changes = countChangesFromStarter(complete, starter)
      if (changes > raw.par) {
        warnings.push(
          `Task ${n} complete code takes ${changes} changes from the starter, more than puzzle.par ${raw.par}`
        )
      }
    }
  }
}

/**
 * Warnings for a task's edit zones (P6-30): more than one #@lock-first or #@lock-last, a fence
 * marker with no line after it, and complete code with lines on a fenced side (students couldn't
 * write it).
 */
function validateEditZones(task, n, rawStarter, parsed, warnings) {
  const markers = { first: 0, last: 0 }
  for (const line of rawStarter.split('\n')) {
    const fence = lockFenceOfMarkerLine(line, 'python')
    if (fence) markers[fence] += 1
  }
  for (const fence of ['first', 'last']) {
    if (markers[fence] > 1) {
      warnings.push(
        `Task ${n} has ${markers[fence]} #@lock-${fence} markers; only one line can stay ${fence}`
      )
    }
    const lock = parsed.locks.find((l) => l.fence === fence)
    if (markers[fence] > 0 && !lock) {
      warnings.push(
        `Task ${n} has a #@lock-${fence} marker with no line after it; it locks nothing`
      )
    }
    const complete = puzzleCompleteCode(task)
    if (!lock || complete == null) continue
    const lines = complete.split('\n')
    const index = lines.findIndex((line) => line.trim() === lock.target)
    if (index < 0) continue
    const fenced = fence === 'last' ? lines.slice(index + 1) : lines.slice(0, index)
    if (fenced.some((line) => line.trim() !== '')) {
      warnings.push(
        `Task ${n} complete code has lines ${fence === 'last' ? 'after' : 'before'} its #@lock-${fence} line ("${lock.target}"), which students can't add`
      )
    }
  }
}

/**
 * Warnings for a Python or Turtle task's locked lines (#@lock markers and puzzle.onlyEdit) that
 * the complete code doesn't keep: a locked line missing from it (students can't remove one), or
 * one at a different indentation (students can't re-indent one).
 */
export function validateLockedLines(task, n, warnings) {
  const rawStarter = getStarterStage(task)?.stage?.code ?? task?.starterCode
  if (typeof rawStarter !== 'string') return
  const parsed = parseLineHints(rawStarter, 'python')
  validateEditZones(task, n, rawStarter, parsed, warnings)
  // Slots (#@slot) are editable: only the locked lines are checked here.
  const locks = parsed.locks.filter((lock) => typeof lock.target === 'string')
  const onlyEdit = Array.isArray(task?.puzzle?.onlyEdit) ? task.puzzle.onlyEdit : null
  if (onlyEdit) {
    for (const lock of onlyEditLocks(parsed.code, onlyEdit)) {
      if (!locks.some((existing) => existing.line === lock.line)) locks.push(lock)
    }
  }
  if (locks.length === 0) {
    if (rawStarter.split('\n').some((line) => isLockMarkerLine(line, 'python'))) {
      warnings.push(`Task ${n} has a #@lock marker with no line after it; it locks nothing`)
    }
    if (rawStarter.split('\n').some((line) => isLockValuesMarkerLine(line, 'python'))) {
      warnings.push(`Task ${n} has a #@lock-values marker with no line after it; it locks nothing`)
    }
    return
  }
  const starterLines = parsed.code.split('\n')
  // A #@lock-values line needs a value (a string or a number) for students to change.
  for (const lock of locks) {
    if (!lock.values) continue
    if (lineValueSpans(starterLines[lock.line - 1] ?? '').length === 0) {
      warnings.push(
        `Task ${n} has a #@lock-values line ${lock.line} with no string or number to change — it is fully locked`
      )
    }
  }
  const complete = puzzleCompleteCode(task)
  if (complete == null) return
  const completeLines = complete.split('\n')
  for (const lock of locks.sort((a, b) => a.line - b.line)) {
    const starterLine = starterLines[lock.line - 1] ?? ''
    const indent = /^\s*/.exec(starterLine)[0]
    const shown = starterLine.trim()
    const matches = completeLines.filter((line) =>
      lock.values
        ? line.trim() !== '' && valueSkeleton(line) === lock.target
        : line.trim() === lock.target
    )
    if (matches.length === 0) {
      warnings.push(
        `Task ${n} locked line ${lock.line} ("${shown}") is not in the complete code — students can't change or remove a locked line`
      )
    } else if (!matches.some((line) => /^\s*/.exec(line)[0] === indent)) {
      warnings.push(
        `Task ${n} locked line ${lock.line} ("${shown}") is indented differently in the complete code — students can't re-indent a locked line`
      )
    }
  }
}
