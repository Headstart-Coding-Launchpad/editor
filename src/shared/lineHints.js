// Line hints: short instructions an author attaches to a line of starter code (or a code stage)
// without putting them in the student's code. Pure and Node-safe (no imports) so the lesson
// validator, the classroom and the CLI can all use it.
//
// Authoring syntax — a marker line gives its text to the next non-marker line:
//   'python' syntax (Python, Turtle)  a line whose trimmed text starts with `#>`
//                                     e.g. `#> Change the colour here`
//   'html' syntax (HTML)              a line whose trimmed text is `<!--> … -->`
//                                     e.g. `<!--> Add a heading -->`
// A module opts in by declaring its marker syntax as `capabilities.lineHints` in its definition
// (src/modules/<type>/definition.js); callers pass that syntax here, never a module type.
// Consecutive markers stack onto the same line. A marker with nothing after it attaches to the
// last line (the validator warns). Marker lines are removed from the code before the student
// ever sees, saves, runs, checks, carries or mirrors it (stripLessonLineHints, applied where the
// classroom loads its lesson — prepareClassroomLesson in src/app/studentTaskContent.js); the
// editor shows the hints as a gutter icon plus faded ghost text (lineHintsExtension in
// ./codemirror.js).
//
// A hint is `{ line, text, target }`: `line` is 1-based in the stripped code, `target` is the
// trimmed text of that line, used to re-anchor the hint when the student's saved code (which
// may have moved lines around) is reloaded — see anchorLineHints.

const HTML_MARKER = /^<!-->([\s\S]*?)-->$/

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

function markerText(line, syntax) {
  return MARKER_TEXT[syntax](line.trim())
}

/**
 * Splits marker lines out of `code`. Returns `{ code, hints, trailingMarker }`: the code
 * without its marker lines (unchanged, byte for byte, when there are none), the hints in
 * document order, and whether any marker had no line after it (it then attaches to the last
 * line). `syntax` is a marker syntax ('python' | 'html'); anything else (or non-string code)
 * returns the code untouched with no hints.
 */
export function parseLineHints(code, syntax) {
  if (typeof code !== 'string' || !isLineHintSyntax(syntax)) {
    return { code, hints: [], trailingMarker: false }
  }
  const lines = code.split('\n')
  if (!lines.some((line) => markerText(line, syntax) != null)) {
    return { code, hints: [], trailingMarker: false }
  }

  // A final newline ends the last line rather than starting an empty one: set it aside, so a
  // marker just before it counts as trailing.
  const endsWithNewline = lines.length > 1 && lines[lines.length - 1] === ''
  const body = endsWithNewline ? lines.slice(0, -1) : lines
  const kept = []
  const hints = []
  let pending = []
  for (const line of body) {
    const text = markerText(line, syntax)
    if (text != null) {
      pending.push(text)
      continue
    }
    kept.push(line)
    for (const hintText of pending) hints.push({ index: kept.length - 1, text: hintText })
    pending = []
  }
  const trailingMarker = pending.length > 0
  if (trailingMarker) {
    if (kept.length === 0) kept.push('')
    for (const hintText of pending) hints.push({ index: kept.length - 1, text: hintText })
  }
  return {
    code: kept.join('\n') + (endsWithNewline ? '\n' : ''),
    hints: hints
      .filter((hint) => hint.text !== '')
      .map(({ index, text }) => ({ line: index + 1, text, target: kept[index].trim() })),
    trailingMarker,
  }
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
 * twice is safe: an already-stripped task keeps its `lineHintSets`). `syntax` is the task's
 * marker syntax (its module's `capabilities.lineHints`); without one the task comes back
 * untouched.
 */
export function stripTaskLineHints(task, syntax) {
  if (!task || typeof task !== 'object' || !isLineHintSyntax(syntax)) return task
  const sets = []
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
  if (!changed) return task
  for (const field of ['starterCode', 'starterFiles', 'completeCode', 'completeFiles']) {
    if (task[field] === undefined) delete next[field]
  }
  if (stages) next.codeStages = stages
  next.lineHintSets = [...(task.lineHintSets ?? []), ...sets]
  return next
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

/**
 * Where a task's code has a marker with no line after it — for the validator's warning. Returns
 * labels such as 'starter code', 'stage 2' or 'starter file index.html'.
 */
export function findTrailingLineHintMarkers(task, syntax) {
  if (!task || !isLineHintSyntax(syntax)) return []
  const found = []
  const check = (code, label) => {
    if (parseLineHints(code, syntax).trailingMarker) found.push(label)
  }
  const checkFiles = (files, label) => {
    for (const file of Array.isArray(files) ? files : []) {
      check(file?.content, `${label} ${file?.name ?? ''}`.trim())
    }
  }
  check(task.starterCode, 'starter code')
  checkFiles(task.starterFiles, 'starter file')
  check(task.completeCode, 'complete code')
  checkFiles(task.completeFiles, 'complete file')
  ;(Array.isArray(task.codeStages) ? task.codeStages : []).forEach((stage, index) => {
    check(stage?.code, `stage ${index + 1}`)
    checkFiles(stage?.files, `stage ${index + 1} file`)
  })
  return found
}
