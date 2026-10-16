// Name-tag panel (a task's `showVariables`, Python and Turtle): what the student's variables
// hold after a run, or at a `#@peek` line. Pure and Node-safe, so the lesson validator, the CLI,
// the classroom and the teacher views share one reading of the field and the captured data.
//
// The worker captures variables as value-node trees (src/modules/python/variableCapture.py.js
// lists the node kinds); this file turns them into labels and text, compares runs, matches
// target values, and builds the run state the panel and the teacher views read.
//
// RUN STATE (a run's panel state, kept by useVariablesPanel and synced to the tutor):
//   {
//     taskId, status: 'success' | 'error' | null, at: 'end' | 'marker',
//     snapshots: [{ vars: [{ n, v }], scope }],   // a sequence, so a step-by-step player
//     index,                                    // (slow-mo) can drive the same panel
//     peekLine, peekReached,                    // marker mode: whether the peek line ran
//     changed: [name],                          // tags whose value differs from the last run
//     changedItems: { name: [item key] },       // which items of those changed (changedItemKeys)
//   }
import { getTaskPeekLine } from '../lineHints.js'

export const SHOW_VARIABLES_MODES = Object.freeze(['view', 'predict', 'target'])
export const SHOW_VARIABLES_AT = Object.freeze(['end', 'marker'])
// How a list the Stage's grid() drew shows (showVariables.stageLists; see visuals.js).
export const STAGE_LISTS_OPTIONS = Object.freeze(['picture', 'tiles', 'size'])
export const DEFAULT_STAGE_LISTS = 'size'

// The task field, as python and turtle declare it in their definitions' taskFields.
export const SHOW_VARIABLES_TASK_FIELD = Object.freeze({
  name: 'showVariables',
  type: 'object',
  description:
    "Name-tag panel showing what is in the variables after Run (off unless set): { mode: view | predict | target, at: end | marker (the #@peek line), hide: [names], predict: [names, or { name, answer: boolean | number | text, choices: [values] }] (predict mode), predictType: [names, or { name, choices: [type labels] }] (predict mode: the student picks each one's type, not its value), target: { name: value } (target mode), visuals: true | false (lists and dicts drawn as swatches, bars, pictures and cards; default true), stageLists: picture | tiles | size (how a list drawn with grid() shows; default size), lockRun: true | false (predict mode: Run waits until every prediction is in, until the first Run; default true), link: true | false (each tag and its variable in the code share a colour and a number; default true) }.",
})

// Python names (identifiers), for author-given names.
export const VARIABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function nameList(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const out = []
  for (const item of value) {
    const name = typeof item === 'string' ? item.trim() : ''
    if (!name || seen.has(name)) continue
    seen.add(name)
    out.push(name)
  }
  return out
}

// The kinds of answer a predict tag takes (showVariables.predict entries, p6-27): text (a text
// box, the default), number (a number field) or boolean (True / False buttons).
export const PREDICT_ANSWER_KINDS = Object.freeze(['text', 'number', 'boolean'])
// The type labels a predictType tag offers (the panel's own labels, typeLabel below), in order.
export const PREDICT_TYPE_LABELS = Object.freeze(['text', 'number', 'true/false', 'list'])

// The name of a predict / predictType entry: a plain name, or `{ name, … }`.
export function predictEntryName(entry) {
  if (typeof entry === 'string') return entry.trim()
  return isPlainObject(entry) && typeof entry.name === 'string' ? entry.name.trim() : ''
}

// A choice (an author's YAML value) as the text the student picks and the check compares, the
// way the panel writes values: text in double quotes ("red"), True / False / None, numbers as
// written.
export function predictChoiceText(choice) {
  if (choice === null) return 'None'
  if (choice === true) return 'True'
  if (choice === false) return 'False'
  if (typeof choice === 'string') return JSON.stringify(choice)
  return String(choice)
}

export const isPredictChoiceValue = (value) =>
  value === null || ['string', 'number', 'boolean'].includes(typeof value)

/**
 * The entries of a predict-style list (`predict` or `predictType`), normalised: `[{ name,
 * answer, choices }]` in order, repeats and blank names dropped. `answer` is one of
 * PREDICT_ANSWER_KINDS, or null when the author didn't say (a plain name: today's free text box,
 * which takes any value), and `choices` the author's choice list (each a scalar), or null. For
 * predictType, `answer` is unused and `choices` (type labels) limits PREDICT_TYPE_LABELS.
 */
function predictEntries(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const out = []
  for (const item of value) {
    const name = predictEntryName(item)
    if (!name || seen.has(name)) continue
    seen.add(name)
    const answer =
      isPlainObject(item) && PREDICT_ANSWER_KINDS.includes(item.answer) ? item.answer : null
    const choices =
      isPlainObject(item) && Array.isArray(item.choices)
        ? item.choices.filter(isPredictChoiceValue)
        : []
    out.push({ name, answer, choices: choices.length > 0 ? choices : null })
  }
  return out
}

// The type labels one predictType tag offers: PREDICT_TYPE_LABELS, limited by its `choices`.
function typeChoicesOf(entry) {
  if (!entry.choices) return [...PREDICT_TYPE_LABELS]
  const wanted = new Set(entry.choices.map((choice) => String(choice).trim()))
  const limited = PREDICT_TYPE_LABELS.filter((label) => wanted.has(label))
  return limited.length > 0 ? limited : [...PREDICT_TYPE_LABELS]
}

/**
 * The task's `showVariables`, normalised: `{ mode, at, hide, predict, answers, predictType,
 * typeChoices, target, visuals, stageLists, lockRun, link }`, or null when the task has no panel
 * (the panel is off unless a task turns it on). `predict` (the names, in order), `answers`
 * (`{ name: { answer, choices } }`: what each predict tag takes, p6-27), `predictType` (the
 * names whose type is predicted) and `typeChoices` (`{ name: [type labels] }`) are only kept in
 * predict mode, and `target` only in target mode.
 * `visuals` is false only when the task says so; `stageLists` is picture | tiles | size (default
 * size). `lockRun` is true only in predict mode, unless the task turns it off. `link` (each tag
 * and its variable in the code share a colour and a number, ./links.js) is true unless the task
 * turns it off.
 */
export function getShowVariables(task) {
  const raw = task?.showVariables
  if (!isPlainObject(raw)) return null
  const mode = SHOW_VARIABLES_MODES.includes(raw.mode) ? raw.mode : 'view'
  const predicted = mode === 'predict' ? predictEntries(raw.predict) : []
  const typed = mode === 'predict' ? predictEntries(raw.predictType) : []
  return {
    mode,
    at: raw.at === 'marker' ? 'marker' : 'end',
    hide: nameList(raw.hide),
    predict: predicted.map((entry) => entry.name),
    answers: Object.fromEntries(
      predicted.map(({ name, answer, choices }) => [name, { answer, choices }])
    ),
    predictType: typed.map((entry) => entry.name),
    typeChoices: Object.fromEntries(typed.map((entry) => [entry.name, typeChoicesOf(entry)])),
    target: mode === 'target' && isPlainObject(raw.target) ? { ...raw.target } : {},
    visuals: raw.visuals !== false,
    stageLists: STAGE_LISTS_OPTIONS.includes(raw.stageLists) ? raw.stageLists : DEFAULT_STAGE_LISTS,
    lockRun: mode === 'predict' && raw.lockRun !== false,
    link: raw.link !== false,
  }
}

export const PREDICT_RUN_LOCK_MESSAGE = 'Fill in your predictions first'

/**
 * Predict mode's Run lock (`showVariables.lockRun`, on by default): until the student's first
 * Run of the task, Run, slow-mo and its steps wait for an answer in every predict tag and a type
 * picked in every predictType tag, so the prediction is made before the program shows the
 * values. `predictions` is the student's prediction state (`{ taskId, values, types, results,
 * typeResults, ran }`, useVariablesPanel). Returns `{ message, missing }` (the names still
 * blank; a type tag's as "name (type)") while locked, else null. The presenter is never locked;
 * useStudentCodeState leaves it out. Run-count boxes (task `runCounts: predict`) share this
 * lock: see getRunCountLock in ../runCounts.js.
 */
export function getPredictRunLock(task, predictions) {
  const config = getShowVariables(task)
  if (!config?.lockRun || config.predict.length + config.predictType.length === 0) return null
  const own = predictions && String(predictions.taskId) === String(task?.id) ? predictions : null
  if (own?.ran) return null
  const values = own?.values ?? {}
  const types = own?.types ?? {}
  const missing = [
    ...config.predict.filter((name) => !String(values[name] ?? '').trim()),
    ...config.predictType
      .filter((name) => !String(types[name] ?? '').trim())
      .map((name) => `${name} (type)`),
  ]
  return missing.length > 0 ? { message: PREDICT_RUN_LOCK_MESSAGE, missing } : null
}

/** The visual options of a normalised config (chooseVisual in visuals.js reads them). */
export function visualOptions(config) {
  return {
    visuals: config?.visuals !== false,
    stageLists: STAGE_LISTS_OPTIONS.includes(config?.stageLists)
      ? config.stageLists
      : DEFAULT_STAGE_LISTS,
  }
}

export function taskShowsVariables(task) {
  return getShowVariables(task) != null
}

/**
 * What the worker should capture for a run of `code` (the student's code, before any runtime
 * prefix): `{ panel: true, peekLine, hide }`, or null when the task has no panel. `lineOffset`
 * is how many lines the runtime puts before the code (Turtle's shim, TURTLE_LINE_OFFSET), so the
 * peek line matches the line numbers the worker sees.
 */
export function variableCaptureOptions(task, code, { lineOffset = 0 } = {}) {
  const config = getShowVariables(task)
  if (!config) return null
  const peek = config.at === 'marker' ? getTaskPeekLine(task, code) : null
  return { panel: true, peekLine: peek == null ? null : peek + lineOffset, hide: config.hide }
}

/**
 * The line (1-based, as the student sees it in `code`) a task's `at: marker` panel shows the
 * values just before: its `#@peek` line re-anchored on the code (getTaskPeekLine). Null for a
 * task without the panel, with `at: end`, or whose peek no longer anchors.
 */
export function getPanelPeekLine(task, code) {
  if (getShowVariables(task)?.at !== 'marker') return null
  return getTaskPeekLine(task, code)
}

/**
 * The editor's "stopped here" band for a task (src/shared/peekBandEditor.js): `{ line, missed }`
 * or null (see getPanelPeekLine). `run` is the panel's run state for this task (null before
 * any run); `missed` is true when that run never reached the marked line.
 */
export function getPeekBand(task, code, run = null) {
  const line = getPanelPeekLine(task, code)
  if (line == null) return null
  return { line, missed: !!run && run.at === 'marker' && !run.peekReached }
}

/**
 * The run state a task's panel shows (null before any run of this task): the synced copy's
 * (a tutor's view, a Go Live broadcast) when `synced` is given, else the student's own
 * (`panel`, useVariablesPanel). Task ids can be numbers or strings, so they compare as text.
 */
export function panelRunForTask(task, { panel = null, synced = undefined } = {}) {
  const isThisTask = (value) => value?.taskId != null && String(value.taskId) === String(task?.id)
  if (synced !== undefined) {
    const { run } = readSyncedVariables(synced)
    return run && (run.taskId == null || isThisTask(run)) ? run : null
  }
  return isThisTask(panel?.run) ? panel.run : null
}

// ─── Value nodes ─────────────────────────────────────────────────────────────

const TYPE_LABELS = Object.freeze({
  str: 'text',
  int: 'number',
  float: 'number',
  bool: 'true/false',
  none: 'None',
  list: 'list',
  dict: 'dict',
  tuple: 'tuple',
  set: 'set',
})

// The small type label on a tag: text, number, true/false, list, dict, None (tuple, set, or
// the Python type name for anything else).
export function typeLabel(node) {
  if (!node || typeof node !== 'object') return 'value'
  return TYPE_LABELS[node.t] ?? (typeof node.type === 'string' && node.type ? node.type : 'value')
}

export const isCollectionNode = (node) => ['list', 'tuple', 'set', 'dict'].includes(node?.t)

// A node's items, tolerating the realtime database dropping empty arrays.
export function nodeItems(node) {
  return Array.isArray(node?.items) ? node.items : []
}

// How many items a collection really has (its `len`), even when only some were read.
export function nodeLength(node) {
  return Number.isFinite(node?.len) ? node.len : nodeItems(node).length
}

// How many of a collection's items were not read (too many, too deep, or over budget).
export function hiddenItemCount(node) {
  return Math.max(0, nodeLength(node) - nodeItems(node).length)
}

function quoteText(text) {
  return `"${String(text).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t')}"`
}

function truncate(text, maxChars) {
  if (!Number.isFinite(maxChars) || text.length <= maxChars) return text
  return `${text.slice(0, Math.max(1, maxChars - 1))}…`
}

/**
 * A value node as Python-like text: text in double quotes ("5" and 5 read differently), True /
 * False / None, floats as Python prints them (5.0), and collections in their brackets. Items
 * that were never read show as "…". `maxChars` cuts the result with an ellipsis.
 */
export function formatValue(node, { maxChars = Infinity } = {}) {
  return truncate(formatNode(node), maxChars)
}

function formatNode(node) {
  if (!node || typeof node !== 'object') return '?'
  switch (node.t) {
    case 'str':
      return quoteText(node.v ?? '') + (node.more > 0 ? '…' : '')
    case 'int':
      return node.v != null ? String(node.v) : String(node.r ?? '?')
    case 'float':
      return node.r != null ? String(node.r) : String(node.v ?? '?')
    case 'bool':
      return node.v ? 'True' : 'False'
    case 'none':
      return 'None'
    case 'list':
    case 'tuple':
    case 'set':
    case 'dict': {
      const [open, close] =
        node.t === 'list' ? ['[', ']'] : node.t === 'tuple' ? ['(', ')'] : ['{', '}']
      const parts =
        node.t === 'dict'
          ? nodeItems(node).map((entry) => `${formatNode(entry?.k)}: ${formatNode(entry?.v)}`)
          : nodeItems(node).map(formatNode)
      if (hiddenItemCount(node) > 0) parts.push('…')
      const body = parts.join(', ')
      if (node.t === 'tuple' && nodeLength(node) === 1 && !hiddenItemCount(node)) {
        return `(${body},)`
      }
      if (node.t === 'set' && nodeLength(node) === 0) return 'set()'
      return `${open}${body}${close}`
    }
    case 'obj':
      return String(node.r ?? `<${node.type ?? 'object'}>`)
    default:
      return '?'
  }
}

/**
 * The screen-reader text for one tag, e.g. "score: number 10", "name: text "Sam"",
 * "bag: list of 2, "key", "map"".
 */
export function describeVariable(name, node) {
  const label = typeLabel(node)
  if (isCollectionNode(node)) {
    const count = nodeLength(node)
    const noun =
      node.t === 'dict' ? (count === 1 ? 'entry' : 'entries') : count === 1 ? 'item' : 'items'
    return `${name}: ${label} of ${count} ${noun}, ${formatValue(node, { maxChars: 200 })}`
  }
  return `${name}: ${label} ${formatValue(node, { maxChars: 200 })}`
}

// ─── Snapshots ───────────────────────────────────────────────────────────────

// A snapshot's variables, tolerating missing fields (synced data loses empty arrays).
export function snapshotVars(snapshot) {
  return (Array.isArray(snapshot?.vars) ? snapshot.vars : []).filter(
    (entry) => typeof entry?.n === 'string' && entry.n && entry.v && typeof entry.v === 'object'
  )
}

export function findVariable(snapshot, name) {
  return snapshotVars(snapshot).find((entry) => entry.n === name)?.v ?? null
}

// A snapshot with the author's hidden names removed (the worker already hides them; this
// covers snapshots read back from older data or another source).
export function visibleVars(snapshot, hide = []) {
  const hidden = new Set(hide)
  return snapshotVars(snapshot).filter(
    (entry) => !hidden.has(entry.n) && !entry.n.startsWith('__') && !entry.n.startsWith('_hs')
  )
}

/** Names whose value differs between two snapshots (new names count as changed). */
export function changedNames(previous, next) {
  if (!previous) return []
  const before = new Map(snapshotVars(previous).map((entry) => [entry.n, formatNode(entry.v)]))
  return snapshotVars(next)
    .filter((entry) => before.get(entry.n) !== formatNode(entry.v))
    .map((entry) => entry.n)
}

// The most item keys one variable's change marks keep (a 32 × 32 picture all changed is 1,024).
export const MAX_CHANGED_ITEMS = 400

const isListNode = (node) => node?.t === 'list' || node?.t === 'tuple'

/**
 * Which items of a value changed between two runs (or two slow-mo steps), for the per-item
 * marks on a visual: list items as their index ('3'), 2D cells as 'row,col' ('2,1') and dict
 * entries as 'k:' plus the key as Python text ('k:"Sam"'). New items count as changed. Empty
 * when either value isn't a collection, or they are different kinds (the whole tag is marked).
 */
export function changedItemKeys(previous, next) {
  if (!previous || !next) return []
  const keys = []
  const push = (key) => {
    if (keys.length < MAX_CHANGED_ITEMS) keys.push(key)
  }
  if (previous.t === 'dict' && next.t === 'dict') {
    const before = new Map(
      nodeItems(previous).map((entry) => [formatNode(entry?.k), formatNode(entry?.v)])
    )
    for (const entry of nodeItems(next)) {
      const key = formatNode(entry?.k)
      if (before.get(key) !== formatNode(entry?.v)) push(`k:${key}`)
    }
    return keys
  }
  if (!isListNode(previous) || !isListNode(next)) return []
  const before = nodeItems(previous)
  nodeItems(next).forEach((item, row) => {
    const old = before[row]
    if (isListNode(item) && (old === undefined || isListNode(old))) {
      const oldCells = nodeItems(old)
      nodeItems(item).forEach((cell, col) => {
        if (col >= oldCells.length || formatNode(oldCells[col]) !== formatNode(cell)) {
          push(`${row},${col}`)
        }
      })
    } else if (old === undefined || formatNode(old) !== formatNode(item)) {
      push(String(row))
    }
  })
  return keys
}

/** `{ name: [item keys] }` for the changed names that are collections with changed items. */
export function changedItemsMap(previous, next, names) {
  const out = {}
  for (const name of names) {
    const keys = changedItemKeys(findVariable(previous, name), findVariable(next, name))
    if (keys.length > 0) out[name] = keys
  }
  return out
}

/**
 * The run state for a finished run (see RUN STATE above). `capture` is the worker's
 * `variablesPanel` ({ end, peek, peekLine, peekReached }, null when the code never ran, e.g. a
 * syntax error); `previous` is the last run state of the same task (for `changed`).
 */
export function buildVariablesRun({ taskId, status = null, capture = null, config, previous }) {
  const at = config?.at === 'marker' ? 'marker' : 'end'
  const peekReached = !!capture?.peekReached
  const shown = at === 'marker' && peekReached ? capture?.peek : capture?.end
  const snapshot = shown ? { vars: snapshotVars(shown), scope: shown.scope ?? null } : null
  const prevShown =
    previous?.taskId != null && String(previous.taskId) === String(taskId)
      ? currentSnapshot(previous)
      : null
  const changed = snapshot && prevShown ? changedNames(prevShown, snapshot) : []
  return {
    taskId: taskId ?? null,
    status: status === 'success' || status === 'error' ? status : null,
    at,
    snapshots: snapshot ? [snapshot] : [],
    index: 0,
    peekLine: Number.isInteger(capture?.peekLine) ? capture.peekLine : null,
    peekReached,
    changed,
    changedItems: changed.length > 0 ? changedItemsMap(prevShown, snapshot, changed) : {},
  }
}

// A run state's per-item change marks for one name, as a Set (tolerating synced data).
export function changedItemSet(run, name) {
  const keys = isPlainObject(run?.changedItems) ? run.changedItems[name] : null
  return new Set(Array.isArray(keys) ? keys.filter((key) => typeof key === 'string') : [])
}

// The snapshot a run state is showing (its `index`), or null.
export function currentSnapshot(run) {
  const snapshots = Array.isArray(run?.snapshots) ? run.snapshots : []
  if (snapshots.length === 0) return null
  const index = Number.isInteger(run.index) ? run.index : snapshots.length - 1
  return snapshots[Math.min(Math.max(index, 0), snapshots.length - 1)] ?? null
}

// ─── Sync (student → tutor card, Go Live) ────────────────────────────────────

function stripUndefined(value) {
  if (Array.isArray(value)) return value.map(stripUndefined)
  if (!isPlainObject(value)) return value
  const out = {}
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) continue
    out[key] = stripUndefined(item)
  }
  return out
}

/**
 * The panel state as the tutor sees it (students/{id}/currentVariables, teacherLive.variablesPanel):
 * the run state with only the shown snapshot, plus the student's predictions
 * (`{ name: text }`) and, once revealed, `results` (`{ name: true | false }`), and their type
 * predictions (predictType: `typePredictions: { name: type label }`, `typeResults`). Null when
 * there is nothing to show (no run and no predictions). Never undefined values (Firebase refuses
 * them).
 */
export function compactVariablesForSync(run, predictionState = null) {
  const predictions = isPlainObject(predictionState?.values) ? predictionState.values : null
  const hasPredictions = predictions && Object.values(predictions).some((v) => String(v ?? ''))
  const types = isPlainObject(predictionState?.types) ? predictionState.types : null
  const hasTypes = types && Object.values(types).some((v) => String(v ?? ''))
  if (!run && !hasPredictions && !hasTypes) return null
  const snapshot = run ? currentSnapshot(run) : null
  return stripUndefined({
    taskId: run?.taskId ?? predictionState?.taskId ?? null,
    status: run?.status ?? null,
    at: run?.at ?? 'end',
    snapshots: snapshot ? [snapshot] : [],
    index: 0,
    peekLine: run?.peekLine ?? null,
    peekReached: !!run?.peekReached,
    changed: run?.changed ?? [],
    changedItems: isPlainObject(run?.changedItems) ? run.changedItems : {},
    ran: !!run,
    predictions: hasPredictions ? { ...predictions } : null,
    results: isPlainObject(predictionState?.results) ? { ...predictionState.results } : null,
    // Only on a task with type predictions, so other tasks keep their shape.
    ...(hasTypes ? { typePredictions: { ...types } } : {}),
    ...(isPlainObject(predictionState?.typeResults)
      ? { typeResults: { ...predictionState.typeResults } }
      : {}),
  })
}

/** Reads a synced panel state back (tutor views): the run part and the prediction part. */
export function readSyncedVariables(synced) {
  if (!isPlainObject(synced)) return { run: null, predictions: null }
  const run = synced.ran
    ? {
        taskId: synced.taskId ?? null,
        status: synced.status ?? null,
        at: synced.at === 'marker' ? 'marker' : 'end',
        snapshots: Array.isArray(synced.snapshots) ? synced.snapshots : [],
        index: 0,
        peekLine: synced.peekLine ?? null,
        peekReached: !!synced.peekReached,
        changed: Array.isArray(synced.changed) ? synced.changed : [],
        changedItems: isPlainObject(synced.changedItems) ? synced.changedItems : {},
      }
    : null
  const predictions =
    isPlainObject(synced.predictions) ||
    isPlainObject(synced.results) ||
    isPlainObject(synced.typePredictions) ||
    isPlainObject(synced.typeResults)
      ? {
          taskId: synced.taskId ?? null,
          values: isPlainObject(synced.predictions) ? synced.predictions : {},
          results: isPlainObject(synced.results) ? synced.results : null,
          // Type predictions (predictType), only when the student has made some.
          ...(isPlainObject(synced.typePredictions) ? { types: synced.typePredictions } : {}),
          ...(isPlainObject(synced.typeResults) ? { typeResults: synced.typeResults } : {}),
        }
      : null
  return { run, predictions }
}
