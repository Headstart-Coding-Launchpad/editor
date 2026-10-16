// Line hints: short instructions an author attaches to a line of starter code (or a code stage)
// without putting them in the student's code. Pure and Node-safe so the lesson
// validator, the classroom and the CLI can all use it (its imports, ./lockedLines.js and
// ./taskStages.js, are pure too).
//
// Authoring syntax — a marker line gives its text to the next non-marker line:
//   'python' syntax (Python, Turtle)  a line whose trimmed text starts with `#>`
//                                     e.g. `#> Change the colour here`
//   'html' syntax (HTML)              a line whose trimmed text is `<!--> … -->`
//                                     e.g. `<!--> Add a heading -->`
// A module opts in by declaring its marker syntax as `capabilities.lineHints` in its definition
// (src/modules/<type>/definition.js); callers pass that syntax here, never a module type.
// Consecutive markers stack onto the same line. Markers with nothing after them get a new empty
// line at the end of the code — the place a "write your code here" hint points at. Marker lines
// are removed from the code before the student ever sees, saves, runs, checks, carries or
// mirrors it (stripLessonLineHints, applied where the classroom loads its lesson —
// prepareClassroomLesson in src/app/studentTaskContent.js); the editor shows the hints as a gutter icon plus faded ghost text (lineHintsExtension in
// ./codemirror.js).
//
// A hint is `{ line, text, target }`: `line` is 1-based in the stripped code, `target` is the
// trimmed text of that line, used to re-anchor the hint when the student's saved code (which
// may have moved lines around) is reloaded — see anchorLineHints.

//
// Peek marker (Python syntax only): a line whose trimmed text is `#@peek` (anything after it is
// ignored) marks the place a name-tag panel with `showVariables.at: marker` shows the variables
// — the first time the program is about to run the next line of code (the next non-blank,
// non-comment line). It is stripped like a hint marker; the task keeps its runtime-only
// `peekSets` (`[{ source, stageIndex, file, peek: { line, target } }]`, starter first), and
// getTaskPeekLine re-anchors it on the student's current code the way hints are re-anchored.
// Only the first peek marker of a piece of code counts.
//
// Count marker (Python syntax only, p6-26): a line whose trimmed text is `#@count` (anything
// after it is ignored) marks the next line of code (the next non-blank, non-comment line, as for
// a peek) whose runs are counted (a task's `runCounts`, ../runCounts.js). Stripped like a hint
// marker; the task keeps its runtime-only `countSets` (`[{ source, stageIndex, file, counts:
// [{ line, target }] }]`, starter first), re-anchored on the student's code by line text the way
// hints are (anchorCountMarks in ../runCounts.js). Every count marker counts (validation warns
// over 3; the classroom keeps the first 3). Several markers above one line mark it once.
//
// Lock marker (Python syntax only): a line whose trimmed text is `#@lock` locks the next
// non-blank line (see ./lockedLines.js). It is stripped like a hint marker; the task keeps its
// runtime-only `lockSets` (`[{ source, stageIndex, file, locks: [{ line, target }] }]`, starter
// first). A task's `puzzle.onlyEdit` adds locks to the starter's set.

import {
  isLockMarkerLine,
  isLockSyntax,
  isLockValuesMarkerLine,
  mergeLocks,
  onlyEditLocks,
  valueSkeleton,
} from './lockedLines.js'
import { getStarterStage } from './taskStages.js'

const HTML_MARKER = /^<!-->([\s\S]*?)-->$/

export const PEEK_MARKER = '#@peek'

// The marker syntaxes with a peek marker (Python's `#` comments).
const PEEK_SYNTAXES = Object.freeze({ python: true })

// Whether a (raw) line is a peek marker line, for a marker syntax.
export function isPeekMarkerLine(line, syntax) {
  if (!Object.hasOwn(PEEK_SYNTAXES, syntax ?? '')) return false
  const trimmed = String(line ?? '').trim()
  return trimmed === PEEK_MARKER || /^#@peek(\s|$)/.test(trimmed)
}

export const COUNT_MARKER = '#@count'

// Whether a (raw) line is a count marker line (`#@count`), for a marker syntax.
export function isCountMarkerLine(line, syntax) {
  if (!Object.hasOwn(PEEK_SYNTAXES, syntax ?? '')) return false
  return /^#@count(\s|$)/.test(String(line ?? '').trim())
}

// A line a peek (or a count) can stop at: code, not a blank line or a comment.
function isPeekTargetLine(line) {
  const trimmed = line.trim()
  return trimmed !== '' && !trimmed.startsWith('#')
}

// Marker syntax → the hint text of a trimmed marker line (possibly ''), or null for a line
// that is not a marker.
const MARKER_TEXT = Object.freeze({
  python: (trimmed) => (trimmed.startsWith('#>') ? trimmed.slice(2).trim() : null),
  html: (trimmed) => trimmed.match(HTML_MARKER)?.[1].trim() ?? null,
})

// The marker syntaxes a module can declare as `capabilities.lineHints`.
export const LINE_HINT_SYNTAXES = Object.freeze(Object.keys(MARKER_TEXT))

export function isLineHintSyntax(syntax) {
  return Object.hasOwn(MARKER_TEXT, syntax ?? '')
}

// The marker syntaxes whose code has triple-quoted strings (Python's).
const TRIPLE_QUOTE_SYNTAXES = Object.freeze({ python: true })

// Python: which triple-quoted string (`"""` or `'''`) is still open at the end of `line`, given
// the one open at its start (null for none). Single-quoted strings and `#` comments are skipped
// so quotes inside them don't count.
function tripleQuoteStateAfter(line, open) {
  let i = 0
  while (i < line.length) {
    if (open != null) {
      if (line[i] === '\\') i += 2
      else if (line.startsWith(open, i)) {
        i += 3
        open = null
      } else i += 1
      continue
    }
    const ch = line[i]
    if (ch === '#') break
    if (line.startsWith('"""', i) || line.startsWith("'''", i)) {
      open = line.slice(i, i + 3)
      i += 3
    } else if (ch === '"' || ch === "'") {
      i += 1
      while (i < line.length && line[i] !== ch) i += line[i] === '\\' ? 2 : 1
      i += 1
    } else i += 1
  }
  return open
}

function markerText(line, syntax) {
  return MARKER_TEXT[syntax](line.trim())
}

/**
 * Splits marker lines out of `code`. Returns `{ code, hints, trailingMarker, peek, locks,
 * counts, countMissed }` (`counts` the `#@count` markers' `[{ line, target }]`, in order, one per
 * marked line; `countMissed` how many count markers had no line of code after them;
 * `peek` the peek marker's `{ line, target }` or null, `locks` the `#@lock` markers'
 * `[{ line, target }]` and the `#@lock-values` markers' `[{ line, target, values: true }]`, the
 * target a value skeleton; see ./lockedLines.js): the code
 * without its marker lines (unchanged, byte for byte, when there are none), the hints in
 * document order, and whether any marker had no line after it (it then attaches to a new empty
 * last line, which takes the place of the code's final newline). `syntax` is a marker syntax
 * ('python' | 'html'); anything else (or non-string code) returns the code untouched with no
 * hints.
 */
export function parseLineHints(code, syntax) {
  const none = { hints: [], trailingMarker: false, peek: null, locks: [], counts: [] }
  if (typeof code !== 'string' || !isLineHintSyntax(syntax)) {
    return { code, ...none, countMissed: 0 }
  }
  const lines = code.split('\n')
  if (
    !lines.some(
      (line) =>
        markerText(line, syntax) != null ||
        isPeekMarkerLine(line, syntax) ||
        isCountMarkerLine(line, syntax) ||
        isLockMarkerLine(line, syntax) ||
        isLockValuesMarkerLine(line, syntax)
    )
  ) {
    return { code, ...none, countMissed: 0 }
  }

  // A final newline ends the last line rather than starting an empty one: set it aside, so a
  // marker just before it counts as trailing.
  const endsWithNewline = lines.length > 1 && lines[lines.length - 1] === ''
  const body = endsWithNewline ? lines.slice(0, -1) : lines
  const kept = []
  const hints = []
  let pending = []
  // Peek: 'none' → 'pending' (marker seen) → the index of the line it stops at.
  let peekState = 'none'
  let peekIndex = null
  // Lock: a `#@lock` waiting for the next non-blank line; the indexes of the locked lines.
  // `values`: a `#@lock-values` marker (only the line's values stay editable).
  let lockPending = null
  const lockIndexes = []
  // Count: how many `#@count` markers wait for the next line of code; the marked lines' indexes.
  let countPending = 0
  const countIndexes = []
  // Python syntax: the closing quotes of the triple-quoted string a line is inside, or null.
  // Lines inside one (e.g. a `turtle.course_map("""…""")` maze row like `#>..G#`) are text,
  // never markers.
  let openString = null
  for (const line of body) {
    if (openString != null) {
      kept.push(line)
      openString = tripleQuoteStateAfter(line, openString)
      continue
    }
    if (isPeekMarkerLine(line, syntax)) {
      if (peekState === 'none') peekState = 'pending'
      continue
    }
    if (isCountMarkerLine(line, syntax)) {
      countPending += 1
      continue
    }
    if (isLockMarkerLine(line, syntax)) {
      lockPending = { values: false }
      continue
    }
    if (isLockValuesMarkerLine(line, syntax)) {
      lockPending = { values: true }
      continue
    }
    const text = markerText(line, syntax)
    if (text != null) {
      pending.push(text)
      continue
    }
    kept.push(line)
    if (Object.hasOwn(TRIPLE_QUOTE_SYNTAXES, syntax)) openString = tripleQuoteStateAfter(line, null)
    if (lockPending && line.trim() !== '') {
      lockIndexes.push({ index: kept.length - 1, values: lockPending.values })
      lockPending = null
    }
    if (peekState === 'pending' && isPeekTargetLine(line)) {
      peekIndex = kept.length - 1
      peekState = 'placed'
    }
    if (countPending > 0 && isPeekTargetLine(line)) {
      countIndexes.push(kept.length - 1)
      countPending = 0
    }
    for (const hintText of pending) hints.push({ index: kept.length - 1, text: hintText })
    pending = []
  }
  // Trailing markers point at a new empty last line: the code ends in a newline either way, so
  // the editor's final (empty) line is the one they describe.
  const trailingMarker = pending.length > 0
  if (trailingMarker) {
    kept.push('')
    for (const hintText of pending) hints.push({ index: kept.length - 1, text: hintText })
  }
  return {
    code: kept.join('\n') + (endsWithNewline && !trailingMarker ? '\n' : ''),
    hints: hints
      .filter((hint) => hint.text !== '')
      .map(({ index, text }) => ({ line: index + 1, text, target: kept[index].trim() })),
    trailingMarker,
    // A peek marker with no code line after it stops nowhere (the panel shows the end).
    peek: peekIndex == null ? null : { line: peekIndex + 1, target: kept[peekIndex].trim() },
    // A lock marker with no non-blank line after it locks nothing.
    locks: lockIndexes.map(({ index, values }) =>
      values
        ? { line: index + 1, target: valueSkeleton(kept[index]), values: true }
        : { line: index + 1, target: kept[index].trim() }
    ),
    // A count marker with no code line after it counts nothing (validation warns).
    counts: countIndexes.map((index) => ({ line: index + 1, target: kept[index].trim() })),
    countMissed: countPending > 0 ? 1 : 0,
  }
}

/**
 * The line (1-based, in `code`) where the task's peek marker stops, re-anchored on the student's
 * current code the way hints are (anchorLineHints): the starter's peek first, then the other
 * stages'. Null when the task has no peek, or it no longer anchors (its line was deleted or
 * duplicated).
 */
export function getTaskPeekLine(task, code) {
  const lines = String(code ?? '').split('\n')
  for (const set of task?.peekSets ?? []) {
    if ((set?.file ?? null) !== null || !set?.peek) continue
    const [anchored] = anchorLineHints(lines, [{ ...set.peek, text: PEEK_MARKER }])
    if (anchored) return anchored.line
  }
  return null
}

// `code` without its marker lines.
export function stripLineHints(code, syntax) {
  return parseLineHints(code, syntax).code
}

/**
 * Places hints on the lines of `code` (a string or an array of lines). Each hint goes on its
 * own line when that line still reads the same (trimmed), else on the one line whose trimmed
 * text equals the hint's target; a hint with no line, or several candidate lines, is dropped.
 * Returns `[{ line, text }]`.
 */
export function anchorLineHints(code, hints) {
  const lines = Array.isArray(code) ? code : String(code ?? '').split('\n')
  const trimmed = lines.map((line) => line.trim())
  const anchored = []
  for (const hint of hints ?? []) {
    if (!hint || typeof hint.text !== 'string' || !hint.text) continue
    const target = hint.target ?? trimmed[hint.line - 1]
    if (trimmed[hint.line - 1] === target) {
      anchored.push({ line: hint.line, text: hint.text })
      continue
    }
    let match = -1
    let count = 0
    trimmed.forEach((line, index) => {
      if (line !== target) return
      count += 1
      match = index
    })
    if (count === 1) anchored.push({ line: match + 1, text: hint.text })
  }
  return anchored
}

/**
 * Picks the hint set (e.g. the starter's, or a stage's) that best fits `code` — the one with the
 * most hints that anchor, the earliest on a tie — and returns its anchored hints. `hintSets` is
 * an array of hint arrays. Returns [] when none anchor.
 */
export function chooseLineHints(code, hintSets) {
  const lines = String(code ?? '').split('\n')
  let best = []
  for (const hints of hintSets ?? []) {
    const anchored = anchorLineHints(lines, hints)
    if (anchored.length > best.length) best = anchored
  }
  return best
}

// ─── Lessons ────────────────────────────────────────────────────────────────

function stripFiles(files, syntax, onHints) {
  if (!Array.isArray(files)) return files
  let changed = false
  const next = files.map((file) => {
    if (typeof file?.content !== 'string') return file
    const parsed = parseLineHints(file.content, syntax)
    if (parsed.code === file.content) return file
    changed = true
    onHints(file.name ?? null, parsed.hints)
    return { ...file, content: parsed.code }
  })
  return changed ? next : files
}

// Where a task's code can hold markers, in the order its hint sets are listed: the starter
// stage(s) and legacy starter fields first, then the other stages, then the legacy complete
// fields. Each is `{ field }` (a legacy field pair) or `{ stageIndex, source }`.
function taskHintSources(task) {
  const stages = (Array.isArray(task?.codeStages) ? task.codeStages : []).map(
    (stage, stageIndex) => ({ stageIndex, source: stage?.role === 'starter' ? 'starter' : 'stage' })
  )
  return [
    ...stages.filter(({ source }) => source === 'starter'),
    { field: 'starter' },
    ...stages.filter(({ source }) => source !== 'starter'),
    { field: 'complete' },
  ]
}

/**
 * Returns the task with the marker lines stripped from its starter code/files, complete
 * code/files and every code stage, plus a runtime-only `lineHintSets` list
 * (`[{ source, stageIndex, file, hints }]`, starter first) the student editors read through
 * getTaskLineHintSets. The same task object comes back when it has no markers (so running it
 * twice is safe: an already-stripped task keeps its `lineHintSets`). `#@peek` and `#@count`
 * markers give it runtime-only `peekSets` / `countSets`. `#@lock` markers and
 * `puzzle.onlyEdit` give it a runtime-only `lockSets` list too (see ./lockedLines.js). `syntax` is the task's
 * marker syntax (its module's `capabilities.lineHints`); without one the task comes back
 * untouched.
 */
export function stripTaskLineHints(task, syntax) {
  if (!task || typeof task !== 'object' || !isLineHintSyntax(syntax)) return task
  const sets = []
  const peekSets = []
  const lockSets = []
  const countSets = []
  const next = { ...task }
  let changed = false
  const add = (source, stageIndex, file, hints) => {
    if (hints.length > 0) sets.push({ source, stageIndex, file, hints })
  }

  const stripCode = (value, source, stageIndex) => {
    const parsed = parseLineHints(value, syntax)
    if (parsed.code === value) return value
    changed = true
    add(source, stageIndex, null, parsed.hints)
    if (parsed.peek) peekSets.push({ source, stageIndex, file: null, peek: parsed.peek })
    if (parsed.counts.length > 0) {
      countSets.push({ source, stageIndex, file: null, counts: parsed.counts })
    }
    if (parsed.locks.length > 0) {
      lockSets.push({ source, stageIndex, file: null, locks: parsed.locks })
    }
    return parsed.code
  }
  const stripFileList = (files, source, stageIndex) => {
    const result = stripFiles(files, syntax, (file, hints) => add(source, stageIndex, file, hints))
    if (result !== files) changed = true
    return result
  }

  const stages = Array.isArray(task.codeStages) ? [...task.codeStages] : null
  for (const { field, stageIndex, source } of taskHintSources(task)) {
    if (field === 'starter') {
      next.starterCode = stripCode(task.starterCode, 'starter', null)
      next.starterFiles = stripFileList(task.starterFiles, 'starter', null)
    } else if (field === 'complete') {
      next.completeCode = stripCode(task.completeCode, 'complete', null)
      next.completeFiles = stripFileList(task.completeFiles, 'complete', null)
    } else if (stages?.[stageIndex] && typeof stages[stageIndex] === 'object') {
      const stage = stages[stageIndex]
      const code = stripCode(stage.code, source, stageIndex)
      const files = stripFileList(stage.files, source, stageIndex)
      if (code !== stage.code || files !== stage.files) {
        stages[stageIndex] = {
          ...stage,
          ...(stage.code !== undefined ? { code } : {}),
          ...(stage.files !== undefined ? { files } : {}),
        }
      }
    }
  }
  if (stages) next.codeStages = stages
  const puzzleLocks = onlyEditStarterLocks(task, next, syntax)
  if (!changed && !puzzleLocks) return task
  for (const field of ['starterCode', 'starterFiles', 'completeCode', 'completeFiles']) {
    if (task[field] === undefined) delete next[field]
  }
  if (changed) next.lineHintSets = [...(task.lineHintSets ?? []), ...sets]
  if (peekSets.length > 0) next.peekSets = [...(task.peekSets ?? []), ...peekSets]
  if (countSets.length > 0) next.countSets = [...(task.countSets ?? []), ...countSets]
  const allLockSets = [...(task.lockSets ?? []), ...lockSets]
  if (puzzleLocks) {
    // puzzle.onlyEdit's locks join the starter's own #@lock set (the editor shows one set).
    const starterIndex = allLockSets.findIndex(
      (set) => set.source === 'starter' && (set.file ?? null) === null
    )
    if (starterIndex >= 0) {
      const set = allLockSets[starterIndex]
      allLockSets[starterIndex] = {
        ...set,
        locks: mergeLocks(set.locks, puzzleLocks),
        onlyEdit: true,
      }
    } else {
      allLockSets.unshift({
        source: 'starter',
        stageIndex: null,
        file: null,
        locks: puzzleLocks,
        onlyEdit: true,
      })
    }
  }
  if (allLockSets.length > 0) next.lockSets = allLockSets
  return next
}

// The starter code of a (stripped) task: its first starter stage's code, else starterCode.
function strippedStarterCode(task) {
  const code = getStarterStage(task)?.stage?.code
  if (typeof code === 'string') return code
  return typeof task?.starterCode === 'string' ? task.starterCode : null
}

// The locks a task's `puzzle.onlyEdit` adds to its stripped starter (`next`), or null when it
// has none — or they were added already (stripping twice is safe).
function onlyEditStarterLocks(task, next, syntax) {
  if (!isLockSyntax(syntax) || !Array.isArray(task?.puzzle?.onlyEdit)) return null
  if ((task.lockSets ?? []).some((set) => set?.onlyEdit)) return null
  const locks = onlyEditLocks(strippedStarterCode(next), task.puzzle.onlyEdit)
  return locks.length > 0 ? locks : null
}

function stripTaskList(tasks, getTaskSyntax) {
  if (!Array.isArray(tasks)) return tasks
  let changed = false
  const next = tasks.map((task) => {
    let result = task
    if (task?.type === 'group' && Array.isArray(task.subtasks)) {
      const subtasks = stripTaskList(task.subtasks, getTaskSyntax)
      result = subtasks === task.subtasks ? task : { ...task, subtasks }
    } else {
      result = stripTaskLineHints(task, getTaskSyntax(task))
    }
    if (result !== task) changed = true
    return result
  })
  return changed ? next : tasks
}

/**
 * The classroom copy of a lesson: each task's markers stripped (stripTaskLineHints) with the
 * syntax `getTaskSyntax(task)` gives (null for a task that is not student code, or whose module
 * has no line hints), and the lesson's sandbox starter stripped with `sandboxSyntax`. Returns
 * the same lesson when nothing changed. Never save the result — it is what students see, not
 * what authors wrote.
 */
export function stripLessonLineHints(lesson, getTaskSyntax, sandboxSyntax = null) {
  if (!lesson || typeof lesson !== 'object') return lesson
  const tasks = stripTaskList(lesson.tasks, getTaskSyntax)
  const sandboxStarter = parseLineHints(lesson.sandboxStarter, sandboxSyntax).code
  const sandboxStarterFiles = isLineHintSyntax(sandboxSyntax)
    ? stripFiles(lesson.sandboxStarterFiles, sandboxSyntax, () => {})
    : lesson.sandboxStarterFiles
  if (
    tasks === lesson.tasks &&
    sandboxStarter === lesson.sandboxStarter &&
    sandboxStarterFiles === lesson.sandboxStarterFiles
  ) {
    return lesson
  }
  const next = { ...lesson, tasks }
  if (lesson.sandboxStarter !== undefined) next.sandboxStarter = sandboxStarter
  if (lesson.sandboxStarterFiles !== undefined) next.sandboxStarterFiles = sandboxStarterFiles
  return next
}

/**
 * The hint sets for what a student editor shows: the code (`file` null) or one file of a
 * stripped task, starter first — pass them to the CodeEditor's `lineHints`, which picks the
 * set that fits the loaded content (chooseLineHints).
 */
export function getTaskLineHintSets(task, file = null) {
  return (task?.lineHintSets ?? [])
    .filter((set) => (set.file ?? null) === (file ?? null))
    .map((set) => set.hints)
}

// The hints of one code stage of a stripped task (read-only stage references): `stageIndex` is
// the stage's index, or 'complete' for the legacy completeCode / completeFiles; `file` picks one
// file (null: the stage's code).
export function getStageLineHints(task, stageIndex, file = null) {
  const matches = (set) =>
    stageIndex === 'complete'
      ? set.source === 'complete' && set.stageIndex == null
      : set.stageIndex === stageIndex
  return (task?.lineHintSets ?? [])
    .filter((set) => matches(set) && (set.file ?? null) === (file ?? null))
    .flatMap((set) => set.hints)
}
