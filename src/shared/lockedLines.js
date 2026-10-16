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
//   `#@lock-values` marker (P6-22)  locks the next non-blank line EXCEPT its values: the text
//       between a plain string's quote marks (empty strings too) and its numbers. The name, `=`,
//       quote marks, brackets and the rest stay read-only (./lockedLinesEditor.js).
//
//   `#@lock-first` / `#@lock-last` markers (P6-30)  lock the next non-blank line like `#@lock` and
//       fence one side of it: nothing can be added before (first) or after (last) it. A lock is
//       then `{ line, target, fence: 'first' | 'last' }`.
//   `#@slot` marker (P6-30)  the next line (blank lines too) is a one-line slot: the student types
//       exactly one line there (`#@slot 2`: up to 2). Its entry in a lock list is
//       `{ line, slot, after, before }`, anchored by the lines either side of it (anchorSlots),
//       since its own text changes.
//   `puzzle.noNewLines: true` (P6-30)  no new lines anywhere: stripTaskLineHints adds a
//       `{ noNewLines: true }` entry to each of the task's code lock lists.
//
// A lock is `{ line, target }`: `line` is 1-based in the stripped code and `target` the line's
// trimmed text. A values lock is `{ line, target, values: true }`, its `target` the line's value
// skeleton (valueSkeleton: the values blanked out), since its values can change. A stripped task keeps its locks on the runtime-only `lockSets`
// (`[{ source, stageIndex, file, locks }]`, starter first), the way it keeps `lineHintSets`.
// The editor re-anchors a set on whatever code it shows (the student's saved code, a support
// stage, Reset's starter) by text — chooseLockedLines — and enforces it
// (./lockedLinesEditor.js). Since a student can't change a locked line, its text always anchors.

export const LOCK_MARKER = '#@lock'
export const LOCK_VALUES_MARKER = '#@lock-values'

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

// Whether a (raw) line is a values-lock marker line (`#@lock-values`), for a marker syntax.
export function isLockValuesMarkerLine(line, syntax) {
  if (!isLockSyntax(syntax)) return false
  return /^#@lock-values(\s|$)/.test(String(line ?? '').trim())
}

export const LOCK_FIRST_MARKER = '#@lock-first'
export const LOCK_LAST_MARKER = '#@lock-last'
export const SLOT_MARKER = '#@slot'
// The most lines a `#@slot N` can take.
export const MAX_SLOT_SIZE = 5

/** The fence of a (raw) `#@lock-first` / `#@lock-last` marker line: 'first', 'last' or null. */
export function lockFenceOfMarkerLine(line, syntax) {
  if (!isLockSyntax(syntax)) return null
  return /^#@lock-(first|last)(\s|$)/.exec(String(line ?? '').trim())?.[1] ?? null
}

/**
 * The size of a (raw) `#@slot` marker line (`#@slot` is 1, `#@slot 2` is 2, capped at
 * MAX_SLOT_SIZE), or null for a line that is not one.
 */
export function slotMarkerSize(line, syntax) {
  if (!isLockSyntax(syntax)) return null
  const match = /^#@slot(?:\s+(\S+))?(\s|$)/.exec(String(line ?? '').trim())
  if (!match) return null
  const size = match[1] == null ? 1 : Number(match[1])
  return Number.isInteger(size) && size >= 1 ? Math.min(size, MAX_SLOT_SIZE) : 1
}

// ─── Values (#@lock-values) ──────────────────────────────────────────────────

// Stands for a number in a value skeleton (never in real code).
const NUMBER_MARK = '\u0000'
const IDENTIFIER_CHAR = /[A-Za-z0-9_]/

/**
 * Reads one line of Python for its values: `{ skeleton, spans }`. `spans` are the editable
 * values, `[{ from, to, kind: 'string' | 'number' }]` (character offsets in `text`): a plain
 * string's contents between its quote marks (`from === to` for an empty string) and each
 * number. `skeleton` is the line with every string's contents removed and every number replaced
 * by one mark, so two lines that differ only in their values have the same skeleton. Prefixed
 * strings (f"…", r"…", b"…") and triple-quoted ones are not values (an f-string's {name} is
 * code); a comment ends the line.
 */
export function scanLineValues(text) {
  const line = String(text ?? '')
  const spans = []
  let skeleton = ''
  let i = 0
  while (i < line.length) {
    const ch = line[i]
    if (ch === '#') {
      skeleton += line.slice(i)
      break
    }
    if (ch === '"' || ch === "'") {
      const prev = i > 0 ? line[i - 1] : ''
      const prefixed = IDENTIFIER_CHAR.test(prev)
      const triple = line.startsWith(ch.repeat(3), i)
      // Find the closing quote (a backslash escapes the next character).
      const open = triple ? 3 : 1
      let j = i + open
      let close = -1
      while (j < line.length) {
        if (line[j] === '\\') {
          j += 2
          continue
        }
        if (line.startsWith(ch.repeat(open), j)) {
          close = j
          break
        }
        j += 1
      }
      if (close < 0) {
        // An unclosed string runs to the end of the line: not a value.
        skeleton += line.slice(i)
        break
      }
      const end = close + open
      if (prefixed || triple) {
        skeleton += line.slice(i, end)
      } else {
        spans.push({ from: i + 1, to: close, kind: 'string' })
        skeleton += ch + ch
      }
      i = end
      continue
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(line[i + 1] ?? ''))) {
      const prev = i > 0 ? line[i - 1] : ''
      if (IDENTIFIER_CHAR.test(prev) || prev === '.') {
        // Part of a name (x2) or an attribute: copy the run as it is.
        let j = i + 1
        while (j < line.length && IDENTIFIER_CHAR.test(line[j])) j += 1
        skeleton += line.slice(i, j)
        i = j
        continue
      }
      const match = /^(?:\d[\d_]*(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(line.slice(i))
      const length = match ? match[0].length : 1
      spans.push({ from: i, to: i + length, kind: 'number' })
      skeleton += NUMBER_MARK
      i += length
      continue
    }
    if (IDENTIFIER_CHAR.test(ch)) {
      let j = i
      while (j < line.length && IDENTIFIER_CHAR.test(line[j])) j += 1
      skeleton += line.slice(i, j)
      i = j
      continue
    }
    skeleton += ch
    i += 1
  }
  return { skeleton, spans }
}

/** A line's value skeleton (scanLineValues), trimmed: a values lock's `target`. */
export function valueSkeleton(text) {
  return scanLineValues(String(text ?? '').trim()).skeleton
}

/** The editable value spans of a line (scanLineValues). */
export function lineValueSpans(text) {
  return scanLineValues(text).spans
}

// The text a lock compares with each line: the trimmed line, or its value skeleton.
function lockKey(lock, trimmedLine) {
  return lock?.values ? valueSkeleton(trimmedLine) : trimmedLine
}

// A line a lock can hold: anything but a blank line.
export function isLockableLine(line) {
  return String(line ?? '').trim() !== ''
}

/**
 * Places locks on the lines of `code` (a string or an array of lines), in order: each lock goes
 * on its own line when that line still reads the same (trimmed; a values lock compares value
 * skeletons) and comes after the previous lock's line, else on the first later line that reads
 * the same. A lock with no such line is dropped. Returns `[{ line, values }]` (1-based,
 * ascending, no repeats).
 */
export function anchorLocks(code, locks) {
  const lines = Array.isArray(code) ? code : String(code ?? '').split('\n')
  const trimmed = lines.map((line) => line.trim())
  const anchored = []
  let after = 0 // the lowest line number (1-based) the next lock may take
  for (const lock of locks ?? []) {
    const target = typeof lock?.target === 'string' ? lock.target : null
    if (!target) continue
    let line = null
    if (
      Number.isInteger(lock.line) &&
      lock.line > after &&
      trimmed[lock.line - 1] != null &&
      lockKey(lock, trimmed[lock.line - 1]) === target
    ) {
      line = lock.line
    } else {
      for (let i = after; i < trimmed.length; i += 1) {
        if (trimmed[i] !== '' && lockKey(lock, trimmed[i]) === target) {
          line = i + 1
          break
        }
      }
    }
    if (line == null) continue
    anchored.push({ line, values: !!lock.values, ...(lock.fence ? { fence: lock.fence } : {}) })
    after = line
  }
  return anchored
}

/**
 * Places the slots of a lock list (`{ line, slot, after, before }` entries; others are skipped)
 * on the lines of `code`: on its own line when the line before it still reads `after` (or it is
 * the first line and `after` is null), else on the one line that follows a line reading `after`,
 * else on its own line number. Each slot runs on while the next line isn't `before`, up to its
 * size. Returns `[{ line, size, lines }]` (1-based; `lines` the slot's current line count).
 */
export function anchorSlots(code, entries) {
  const lines = Array.isArray(code) ? code : String(code ?? '').split('\n')
  const trimmed = lines.map((line) => line.trim())
  const follows = (index, after) => (after == null ? index === 0 : trimmed[index - 1] === after)
  const anchored = []
  let from = 0 // the lowest index the next slot may take
  for (const entry of entries ?? []) {
    if (!Number.isInteger(entry?.slot) || !Number.isInteger(entry.line)) continue
    const after = typeof entry.after === 'string' ? entry.after : null
    let index = entry.line - 1
    if (!(index >= from && index < lines.length && follows(index, after))) {
      const matches = []
      for (let i = from; i < lines.length; i += 1) if (follows(i, after)) matches.push(i)
      if (matches.length === 1) index = matches[0]
      else if (!(index >= from && index < lines.length)) continue
    }
    const before = typeof entry.before === 'string' ? entry.before : null
    let count = 1
    while (
      count < entry.slot &&
      index + count < lines.length &&
      (before == null || trimmed[index + count] !== before)
    ) {
      count += 1
    }
    // With no line after it, a slot runs to the end of the code (its last line may be empty).
    anchored.push({ line: index + 1, size: entry.slot, lines: count })
    from = index + count
  }
  return anchored
}

/**
 * What the editor enforces on `code` from the task's lock lists (getTaskLockSets): the list that
 * fits best (the most locks and slots that anchor, the earliest on a tie) as `{ locks, slots,
 * noNewLines }` — `locks` from anchorLocks (with `fence`), `slots` from anchorSlots, and
 * `noNewLines` from puzzle.noNewLines.
 */
export function chooseZones(code, lockSets) {
  const lines = String(code ?? '').split('\n')
  let best = { locks: [], slots: [], noNewLines: false }
  let bestCount = -1
  for (const entries of lockSets ?? []) {
    if (!Array.isArray(entries)) continue
    const locks = anchorLocks(lines, entries)
    const slots = anchorSlots(lines, entries)
    const count = locks.length + slots.length
    if (count > bestCount) {
      best = { locks, slots, noNewLines: entries.some((entry) => entry?.noNewLines === true) }
      bestCount = count
    }
  }
  return best
}

/** anchorLocks as line numbers only. */
export function anchorLockedLines(code, locks) {
  return anchorLocks(code, locks).map((lock) => lock.line)
}

/**
 * The lock set that best fits `code` — the one with the most locks that anchor, the earliest on
 * a tie — as `[{ line, values }]`. `lockSets` is an array of lock arrays. [] when none anchor.
 */
export function chooseLocks(code, lockSets) {
  const lines = String(code ?? '').split('\n')
  let best = []
  for (const locks of lockSets ?? []) {
    if (!Array.isArray(locks)) continue
    const anchored = anchorLocks(lines, locks)
    if (anchored.length > best.length) best = anchored
  }
  return best
}

/** chooseLocks as locked line numbers (values locks included). */
export function chooseLockedLines(code, lockSets) {
  return chooseLocks(code, lockSets).map((lock) => lock.line)
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

// Whether a stripped task has a values lock (#@lock-values) on its code.
export function taskHasValueLocks(task) {
  return getTaskLockSets(task).some((locks) => locks.some((lock) => lock?.values === true))
}

/**
 * The locked line numbers of `code` for a stripped task (what the editor would lock), e.g. for a
 * read-only stage reference. [] without locks.
 */
export function getTaskLockedLines(task, code) {
  return chooseLockedLines(code, getTaskLockSets(task))
}
