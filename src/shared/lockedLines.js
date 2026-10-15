// Locked lines: lines of starter code a student can see but not change (docs/authoring/python.md
// "Locked lines"). Pure and Node-safe (no imports), so the lesson validator, the classroom, the
// editor and the CLI share one reading.
//
// Authoring — two ways, chosen per task:
//   `#@lock` marker (Python syntax: Python and Turtle)  a line whose trimmed text is `#@lock`
//       (anything after it is ignored) locks the next non-blank line. Marker lines are stripped
//       with the `#>` hint markers (parseLineHints in ./lineHints.js), so students never see them.
//   `puzzle.onlyEdit: [lineNums]`  locks every non-blank line of the starter code except the
//       listed ones (1-based, in the starter as the student sees it: marker lines don't count).
//
// A lock is `{ line, target }`: `line` is 1-based in the stripped code and `target` the line's
// trimmed text. A stripped task keeps its locks on the runtime-only `lockSets`
// (`[{ source, stageIndex, file, locks }]`, starter first), the way it keeps `lineHintSets`.
// The editor re-anchors a set on whatever code it shows (the student's saved code, a support
// stage, Reset's starter) by text — chooseLockedLines — and enforces it
// (./lockedLinesEditor.js). Since a student can't change a locked line, its text always anchors.

export const LOCK_MARKER = '#@lock'

// The marker syntaxes with a lock marker (Python's `#` comments: python and turtle).
const LOCK_SYNTAXES = Object.freeze({ python: true })

// Whether a marker syntax has locks (#@lock and puzzle.onlyEdit).
export function isLockSyntax(syntax) {
  return Object.hasOwn(LOCK_SYNTAXES, syntax ?? '')
}

// Whether a (raw) line is a lock marker line, for a marker syntax.
export function isLockMarkerLine(line, syntax) {
  if (!isLockSyntax(syntax)) return false
  const trimmed = String(line ?? '').trim()
  return trimmed === LOCK_MARKER || /^#@lock(\s|$)/.test(trimmed)
}

// A line a lock can hold: anything but a blank line.
export function isLockableLine(line) {
  return String(line ?? '').trim() !== ''
}

/**
 * Places locks on the lines of `code` (a string or an array of lines), in order: each lock goes
 * on its own line when that line still reads the same (trimmed) and comes after the previous
 * lock's line, else on the first later line that reads the same. A lock with no such line is
 * dropped. Returns the locked line numbers (1-based, ascending, no repeats).
 */
export function anchorLockedLines(code, locks) {
  const lines = Array.isArray(code) ? code : String(code ?? '').split('\n')
  const trimmed = lines.map((line) => line.trim())
  const anchored = []
  let after = 0 // the lowest line number (1-based) the next lock may take
  for (const lock of locks ?? []) {
    const target = typeof lock?.target === 'string' ? lock.target : null
    if (!target) continue
    let line = null
    if (Number.isInteger(lock.line) && lock.line > after && trimmed[lock.line - 1] === target) {
      line = lock.line
    } else {
      for (let i = after; i < trimmed.length; i += 1) {
        if (trimmed[i] === target) {
          line = i + 1
          break
        }
      }
    }
    if (line == null) continue
    anchored.push(line)
    after = line
  }
  return anchored
}

/**
 * The lock set that best fits `code` — the one with the most locks that anchor, the earliest on
 * a tie — as locked line numbers. `lockSets` is an array of lock arrays. [] when none anchor.
 */
export function chooseLockedLines(code, lockSets) {
  const lines = String(code ?? '').split('\n')
  let best = []
  for (const locks of lockSets ?? []) {
    if (!Array.isArray(locks)) continue
    const anchored = anchorLockedLines(lines, locks)
    if (anchored.length > best.length) best = anchored
  }
  return best
}

/**
 * The locks `puzzle.onlyEdit` gives a (stripped) starter: every non-blank line except the listed
 * line numbers. [] when `onlyEdit` is not a list.
 */
export function onlyEditLocks(code, onlyEdit) {
  if (typeof code !== 'string' || !Array.isArray(onlyEdit)) return []
  const editable = new Set(onlyEdit.filter((line) => Number.isInteger(line)))
  const locks = []
  code.split('\n').forEach((text, index) => {
    if (!isLockableLine(text) || editable.has(index + 1)) return
    locks.push({ line: index + 1, target: text.trim() })
  })
  // A final newline leaves an empty last line, which is never locked.
  return locks
}

// Two lock lists as one, in line order, one lock per line.
export function mergeLocks(a, b) {
  const byLine = new Map()
  for (const lock of [...(a ?? []), ...(b ?? [])]) {
    if (Number.isInteger(lock?.line) && !byLine.has(lock.line)) byLine.set(lock.line, lock)
  }
  return [...byLine.values()].sort((x, y) => x.line - y.line)
}

/**
 * The lock sets for what a student editor shows: the code (`file` null) of a stripped task,
 * starter first — pass them to the CodeEditor's `lockedLines`, which picks the set that fits the
 * loaded content (chooseLockedLines).
 */
export function getTaskLockSets(task, file = null) {
  return (Array.isArray(task?.lockSets) ? task.lockSets : [])
    .filter((set) => (set?.file ?? null) === (file ?? null) && Array.isArray(set.locks))
    .map((set) => set.locks)
}

// Whether a stripped task has any locks on its code.
export function taskHasLocks(task) {
  return getTaskLockSets(task).some((locks) => locks.length > 0)
}

/**
 * The locked line numbers of `code` for a stripped task (what the editor would lock), e.g. for a
 * read-only stage reference. [] without locks.
 */
export function getTaskLockedLines(task, code) {
  return chooseLockedLines(code, getTaskLockSets(task))
}
