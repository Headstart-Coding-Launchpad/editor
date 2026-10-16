// Name-tag panel predictions and targets (showVariables predict / target modes): the forgiving
// comparison of a typed prediction with a captured value, target matching, the
// `variables_predicted` check, and the session-report fields. Pure and Node-safe.
//
// FORGIVING COMPARISON (decided by the real value's type, like a typed quiz answer — leading
// and trailing spaces never matter):
//   text      quotes optional: Sam, "Sam" and 'Sam' all match "Sam". Capitals and the spaces
//             inside the text do matter (the value is the text exactly).
//   number    5, 5.0 and 5.00 all match 5 (and 5.0); quotes make it text, so "5" does NOT match
//             the number 5 — that difference is what the panel teaches.
//   True / False / None   any capitals (true matches True).
//   list, tuple, set, dict   written as Python: [1, 2], ("a", 2), {"a": 1}; the same rules
//             apply to each item, so ['key', "map"] matches ["key", "map"]. Set order is ignored.
//
// TYPE PREDICTIONS (showVariables.predictType, p6-27): the student picks one of the panel's own
// type labels (text, number, true/false, list); it is right when it is the label the panel
// shows for the real value (typeLabel). Checked by `types_predicted`.
import {
  currentSnapshot,
  findVariable,
  getShowVariables,
  hiddenItemCount,
  nodeItems,
  nodeLength,
  readSyncedVariables,
  typeLabel,
} from './variablesPanel.js'
import { answerTextMatches } from '../quizAnswers.js'

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

const NUMBER_PATTERN = /^[+-]?(\d+(\.\d*)?|\.\d+)(e[+-]?\d+)?$/i

function numbersEqual(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return a === b
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))
}

function nodeNumber(node) {
  if (Number.isFinite(node?.v)) return node.v
  const parsed = Number(node?.r)
  return Number.isFinite(parsed) ? parsed : NaN
}

// ─── A small Python literal reader ───────────────────────────────────────────

class SetLiteral {
  constructor(items) {
    this.items = items
  }
}
class DictLiteral {
  constructor(entries) {
    this.entries = entries
  }
}
class TupleLiteral {
  constructor(items) {
    this.items = items
  }
}

/**
 * Reads a Python literal as typed by a student: strings in single or double quotes, numbers,
 * True/False/None (any capitals), lists, tuples, sets and dicts. Returns `{ ok, value }`;
 * strings come back as `{ str }` so a quoted "5" stays text. `ok` is false for anything else.
 */
export function parsePythonLiteral(text) {
  const src = String(text ?? '')
  let i = 0
  const skip = () => {
    while (i < src.length && /\s/.test(src[i])) i += 1
  }
  const fail = () => {
    throw new Error('not a literal')
  }
  function readString() {
    const quote = src[i]
    i += 1
    let out = ''
    while (i < src.length && src[i] !== quote) {
      if (src[i] === '\\' && i + 1 < src.length) {
        const next = src[i + 1]
        out += next === 'n' ? '\n' : next === 't' ? '\t' : next
        i += 2
        continue
      }
      out += src[i]
      i += 1
    }
    if (src[i] !== quote) fail()
    i += 1
    return { str: out }
  }
  function readList(close) {
    const items = []
    let trailingComma = false
    skip()
    while (src[i] !== close) {
      items.push(readValue())
      skip()
      trailingComma = false
      if (src[i] === ',') {
        i += 1
        trailingComma = true
        skip()
        continue
      }
      if (src[i] !== close) fail()
    }
    i += 1
    return { items, trailingComma }
  }
  function readBrace() {
    i += 1
    skip()
    if (src[i] === '}') {
      i += 1
      return new DictLiteral([])
    }
    const first = readValue()
    skip()
    if (src[i] === ':') {
      i += 1
      const entries = [[first, readValue()]]
      skip()
      while (src[i] === ',') {
        i += 1
        skip()
        if (src[i] === '}') break
        const key = readValue()
        skip()
        if (src[i] !== ':') fail()
        i += 1
        entries.push([key, readValue()])
        skip()
      }
      if (src[i] !== '}') fail()
      i += 1
      return new DictLiteral(entries)
    }
    const items = [first]
    while (src[i] === ',') {
      i += 1
      skip()
      if (src[i] === '}') break
      items.push(readValue())
      skip()
    }
    if (src[i] !== '}') fail()
    i += 1
    return new SetLiteral(items)
  }
  function readValue() {
    skip()
    const ch = src[i]
    if (ch === '"' || ch === "'") return readString()
    if (ch === '[') {
      i += 1
      return readList(']').items
    }
    if (ch === '(') {
      i += 1
      const { items, trailingComma } = readList(')')
      // (5) is just 5 in Python; (5,) is a tuple.
      if (items.length === 1 && !trailingComma) return items[0]
      return new TupleLiteral(items)
    }
    if (ch === '{') return readBrace()
    if (src.startsWith('set()', i)) {
      i += 5
      return new SetLiteral([])
    }
    const match = /^[^,:\])}\s]+/.exec(src.slice(i))
    if (!match) fail()
    const word = match[0]
    i += word.length
    const lower = word.toLowerCase()
    if (lower === 'true') return true
    if (lower === 'false') return false
    if (lower === 'none') return null
    if (NUMBER_PATTERN.test(word)) return Number(word)
    fail()
  }
  try {
    const value = readValue()
    skip()
    if (i !== src.length) return { ok: false, value: undefined }
    return { ok: true, value }
  } catch {
    return { ok: false, value: undefined }
  }
}

// ─── Matching a value node ───────────────────────────────────────────────────

// Whether a parsed literal (or, for targets, a plain JS value from the lesson: strings are
// text, objects are dicts, arrays are lists) matches a captured value node. Collections whose
// items weren't all read never match.
function literalMatchesNode(literal, node, { plainStrings }) {
  if (!node || typeof node !== 'object') return false
  const isText = (value) =>
    plainStrings ? typeof value === 'string' : isPlainObject(value) && 'str' in value
  const textOf = (value) => (plainStrings ? value : value.str)
  const recurse = (lit, child) => literalMatchesNode(lit, child, { plainStrings })
  switch (node.t) {
    case 'str':
      return isText(literal) && !(node.more > 0) && textOf(literal) === (node.v ?? '')
    case 'int':
    case 'float':
      return typeof literal === 'number' && numbersEqual(literal, nodeNumber(node))
    case 'bool':
      return typeof literal === 'boolean' && literal === !!node.v
    case 'none':
      return literal === null
    case 'list':
    case 'tuple': {
      const items =
        literal instanceof TupleLiteral ? literal.items : Array.isArray(literal) ? literal : null
      if (!items || hiddenItemCount(node) > 0 || items.length !== nodeLength(node)) return false
      return items.every((item, index) => recurse(item, nodeItems(node)[index]))
    }
    case 'set': {
      const items =
        literal instanceof SetLiteral ? literal.items : Array.isArray(literal) ? literal : null
      if (!items || hiddenItemCount(node) > 0 || items.length !== nodeLength(node)) return false
      const remaining = [...nodeItems(node)]
      return items.every((item) => {
        const at = remaining.findIndex((child) => recurse(item, child))
        if (at < 0) return false
        remaining.splice(at, 1)
        return true
      })
    }
    case 'dict': {
      let entries = null
      if (literal instanceof DictLiteral) entries = literal.entries
      else if (plainStrings && isPlainObject(literal)) entries = Object.entries(literal)
      if (!entries || hiddenItemCount(node) > 0 || entries.length !== nodeLength(node)) {
        return false
      }
      return entries.every(([key, value]) => {
        const entry = nodeItems(node).find((candidate) =>
          plainStrings && typeof key === 'string'
            ? dictKeyMatches(key, candidate?.k)
            : recurse(key, candidate?.k)
        )
        return !!entry && recurse(value, entry.v)
      })
    }
    case 'obj':
      return isText(literal) && textOf(literal).trim() === String(node.r ?? '').trim()
    default:
      return false
  }
}

// A lesson's target dict keys are always strings (YAML / JSON object keys): "1" matches the
// key 1 as well as the key "1".
function dictKeyMatches(key, keyNode) {
  if (keyNode?.t === 'str') return keyNode.v === key
  if (keyNode?.t === 'int' || keyNode?.t === 'float') {
    return NUMBER_PATTERN.test(key) && numbersEqual(Number(key), nodeNumber(keyNode))
  }
  return false
}

/** Whether a typed prediction matches a captured value node (the forgiving rules above). */
export function predictionMatches(text, node) {
  if (text == null || !node || typeof node !== 'object') return false
  const typed = String(text).trim()
  if (!typed) return false
  switch (node.t) {
    case 'str': {
      if (node.more > 0) return false
      const quoted = /^(["'])([\s\S]*)\1$/.exec(typed)
      if (quoted) {
        const parsed = parsePythonLiteral(typed)
        return parsed.ok && isPlainObject(parsed.value) && parsed.value.str === (node.v ?? '')
      }
      return typed === (node.v ?? '').trim() && typed.length > 0
    }
    case 'int':
    case 'float':
      return NUMBER_PATTERN.test(typed) && numbersEqual(Number(typed), nodeNumber(node))
    case 'bool':
      return answerTextMatches(typed, node.v ? 'True' : 'False')
    case 'none':
      return answerTextMatches(typed, 'None')
    case 'obj':
      return typed === String(node.r ?? '').trim()
    default: {
      const parsed = parsePythonLiteral(typed)
      return parsed.ok && literalMatchesNode(parsed.value, node, { plainStrings: false })
    }
  }
}

/**
 * Whether a captured value matches a target value written in the lesson (target mode): numbers
 * match whatever their decimal places (10 matches 10.0), strings are text, arrays lists (or
 * tuples, or sets in any order), objects dicts, booleans and null True/False/None.
 */
export function targetMatches(node, target) {
  if (!node) return false
  return literalMatchesNode(target, node, { plainStrings: true })
}

// A target value as the panel shows it (Python-like), e.g. "Sam" → "Sam", ['a'] → ["a"].
export function formatTargetValue(value) {
  if (value === null) return 'None'
  if (value === true) return 'True'
  if (value === false) return 'False'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) return `[${value.map(formatTargetValue).join(', ')}]`
  if (isPlainObject(value)) {
    return `{${Object.entries(value)
      .map(([key, item]) => `${JSON.stringify(key)}: ${formatTargetValue(item)}`)
      .join(', ')}}`
  }
  return String(value)
}

// ─── Predictions ─────────────────────────────────────────────────────────────

/**
 * Marks each prediction against a snapshot (the values the panel shows): `{ results: { name:
 * true | false }, entries: [{ name, value, correct }], allCorrect }`, in `names` order. A name
 * the program never made, or left blank, is wrong.
 */
export function evaluatePredictions(names, predictions, snapshot) {
  const values = isPlainObject(predictions) ? predictions : {}
  const entries = (names ?? []).map((name) => {
    const value = typeof values[name] === 'string' ? values[name] : ''
    const node = findVariable(snapshot, name)
    return { name, value, correct: !!node && predictionMatches(value, node) }
  })
  return {
    results: Object.fromEntries(entries.map((entry) => [entry.name, entry.correct])),
    entries,
    allCorrect: entries.length > 0 && entries.every((entry) => entry.correct),
  }
}

/**
 * The `variables_predicted` check: every listed name (or, without `names`, every prediction the
 * task asks for) was predicted right. Reads `context.variablePredictions` — `{ names, values,
 * snapshot }` from the name-tag panel at Run — so it can't pass without a real run.
 */
export function evaluateVariablesPredictedCheck(check, _output, context = {}) {
  const state = context?.variablePredictions
  if (!state || !state.snapshot) return false
  const names = Array.isArray(check?.names) && check.names.length > 0 ? check.names : state.names
  if (!Array.isArray(names) || names.length === 0) return false
  return evaluatePredictions(names, state.values, state.snapshot).allCorrect
}

/** Whether a picked type label is the one the panel shows for the real value (p6-27). */
export function typePredictionMatches(label, node) {
  if (!node || typeof node !== 'object') return false
  const picked = String(label ?? '').trim()
  return !!picked && picked === typeLabel(node)
}

/**
 * Marks each type prediction (showVariables.predictType) against a snapshot, as
 * evaluatePredictions does values: `{ results, entries: [{ name, value, correct }], allCorrect }`
 * with `value` the picked type label. A name the program never made, or left unpicked, is wrong.
 */
export function evaluateTypePredictions(names, types, snapshot) {
  const picked = isPlainObject(types) ? types : {}
  const entries = (names ?? []).map((name) => {
    const value = typeof picked[name] === 'string' ? picked[name] : ''
    const node = findVariable(snapshot, name)
    return { name, value, correct: !!node && typePredictionMatches(value, node) }
  })
  return {
    results: Object.fromEntries(entries.map((entry) => [entry.name, entry.correct])),
    entries,
    allCorrect: entries.length > 0 && entries.every((entry) => entry.correct),
  }
}

/**
 * The `types_predicted` check: every listed name (or, without `names`, every predictType name)
 * had its type predicted right. Reads `context.variablePredictions` (`{ typeNames, types,
 * snapshot }`, from the name-tag panel at Run), so it can't pass without a real run.
 */
export function evaluateTypesPredictedCheck(check, _output, context = {}) {
  const state = context?.variablePredictions
  if (!state || !state.snapshot) return false
  const names =
    Array.isArray(check?.names) && check.names.length > 0 ? check.names : state.typeNames
  if (!Array.isArray(names) || names.length === 0) return false
  return evaluateTypePredictions(names, state.types, state.snapshot).allCorrect
}

// ─── Tutor card ──────────────────────────────────────────────────────────────

/**
 * A predict-mode task's predictions as the tutor's chip counts them: `[{ label, value, result }]`
 * (`result` true / false once revealed, else null), the value tags first, then the type tags
 * (labelled "name (type)"). `predictions` is readSyncedVariables' prediction part.
 */
export function predictionItems(config, predictions) {
  const values = predictions?.values ?? {}
  const results = predictions?.results ?? null
  const types = predictions?.types ?? {}
  const typeResults = predictions?.typeResults ?? null
  const resultOf = (map, name) => (map && name in map ? map[name] === true : null)
  return [
    ...(config?.predict ?? []).map((name) => ({
      label: name,
      value: String(values[name] ?? ''),
      result: resultOf(results, name),
    })),
    ...(config?.predictType ?? []).map((name) => ({
      label: `${name} (type)`,
      value: String(types[name] ?? ''),
      result: resultOf(typeResults, name),
    })),
  ]
}

/**
 * The tutor chip for a list of prediction items (predictionItems, or run-count boxes):
 * "n/m right" once any is revealed, "Predicted n/m" while they type, null before anything.
 */
export function predictionChipSummary(items) {
  if (!Array.isArray(items) || items.length === 0) return null
  if (items.some((item) => item.result !== null)) {
    const right = items.filter((item) => item.result === true).length
    return {
      label: `${right}/${items.length} right`,
      title: `Predictions: ${items
        .map((item) => `${item.label} = ${item.value || '(blank)'} ${item.result ? '✓' : '✗'}`)
        .join(', ')}`,
    }
  }
  const typed = items.filter((item) => item.value.trim()).length
  if (typed === 0) return null
  return {
    label: `Predicted ${typed}/${items.length}`,
    title: `Predictions so far (not run yet): ${items
      .map((item) => `${item.label} = ${item.value || '(blank)'}`)
      .join(', ')}`,
  }
}

/**
 * The tutor card's one-line summary of a student's name-tag panel (`synced`: their
 * students/{id}/currentVariables) on a predict or target task: `{ label, title }`, or null
 * when there is nothing to say (no panel, view mode, another task, nothing typed or run yet).
 */
export function variablesCardSummary(task, synced) {
  const config = getShowVariables(task)
  if (!config || config.mode === 'view' || !isPlainObject(synced)) return null
  if (synced.taskId != null && String(synced.taskId) !== String(task?.id)) return null
  const { run, predictions } = readSyncedVariables(synced)
  if (config.mode === 'predict') {
    return predictionChipSummary(predictionItems(config, predictions))
  }
  const snapshot = run ? currentSnapshot(run) : null
  if (!snapshot) return null
  const names = Object.keys(config.target)
  const hit = names.filter((name) =>
    targetMatches(findVariable(snapshot, name), config.target[name])
  ).length
  return {
    label: `${hit}/${names.length} on target`,
    title: `Targets after their last Run: ${hit} of ${names.length} variables match`,
  }
}

// ─── Session report ──────────────────────────────────────────────────────────

// Most prediction reveals kept per student per task (students/{id}/predictionLog/{taskId}).
export const MAX_PREDICTION_LOG_ENTRIES = 30

const logEntries = (evaluation) =>
  Object.fromEntries(
    (evaluation?.entries ?? []).map((entry) => [
      entry.name,
      { value: String(entry.value ?? '').slice(0, 200), correct: !!entry.correct },
    ])
  )

/**
 * One reveal as stored in students/{id}/predictionLog/{taskId}/{pushId}:
 * `{ at, allCorrect, entries: { name: { value, correct } }, types? }` — `types` (the same shape,
 * the picked type labels) only when the task predicts types (`typeEvaluation`,
 * evaluateTypePredictions). `allCorrect` covers both.
 */
export function buildPredictionLogEntry(evaluation, at, { typeEvaluation = null } = {}) {
  const typeEntries = typeEvaluation?.entries ?? []
  const all = [...(evaluation?.entries ?? []), ...typeEntries]
  return {
    at,
    allCorrect: all.length > 0 && all.every((entry) => entry.correct),
    entries: logEntries(evaluation),
    ...(typeEntries.length > 0 ? { types: logEntries(typeEvaluation) } : {}),
  }
}

function logEntryList(map, order, kind = null) {
  if (!isPlainObject(map)) return []
  return (order.length > 0 ? order : Object.keys(map))
    .filter((name) => isPlainObject(map[name]))
    .map((name) => ({
      name,
      value: String(map[name].value ?? ''),
      correct: map[name].correct === true,
      ...(kind ? { kind } : {}),
    }))
}

function normalizeLogEntry(raw, names, typeNames = []) {
  if (!isPlainObject(raw) || (!isPlainObject(raw.entries) && !isPlainObject(raw.types))) {
    return null
  }
  // Type predictions (predictType) are marked `kind: 'type'`; value predictions have no kind.
  const entries = [
    ...logEntryList(raw.entries, names),
    ...logEntryList(raw.types, typeNames, 'type'),
  ]
  if (entries.length === 0) return null
  return {
    at: typeof raw.at === 'number' ? raw.at : null,
    entries,
    allCorrect: entries.every((entry) => entry.correct),
  }
}

/**
 * The per-student report fields of a predict-mode task: `{ predictions: { reveals, first, last,
 * firstAllCorrect, lastAllCorrect } }` (`first` / `last` are `[{ name, value, correct }]`), or
 * `{}` when the student never revealed a prediction. `names` orders the entries (the task's
 * showVariables.predict); `typeNames` (its predictType) orders the type predictions, which come
 * after the values marked `kind: 'type'`.
 */
export function variablePredictionReportFields(task, studentNode, names = [], typeNames = []) {
  const raw = studentNode?.predictionLog?.[task?.id]
  if (!isPlainObject(raw)) return {}
  const reveals = Object.values(raw)
    .map((entry) => normalizeLogEntry(entry, names, typeNames))
    .filter(Boolean)
    .sort((a, b) => (a.at ?? 0) - (b.at ?? 0))
  if (reveals.length === 0) return {}
  const first = reveals[0]
  const last = reveals[reveals.length - 1]
  return {
    predictions: {
      reveals: reveals.length,
      first: first.entries,
      last: last.entries,
      firstAllCorrect: first.allCorrect,
      lastAllCorrect: last.allCorrect,
    },
  }
}

/**
 * The task-summary fields over every student's `predictions`: how many predicted, how many were
 * all right first time, and per name how many first predictions were right. `{}` when nobody
 * predicted.
 */
export function summarizeVariablePredictions(perStudent) {
  const predicted = (perStudent ?? []).filter((task) => task?.predictions)
  if (predicted.length === 0) return {}
  const byName = new Map()
  for (const task of predicted) {
    for (const entry of task.predictions.first ?? []) {
      // A type prediction tallies apart from a value prediction of the same name.
      const key = entry.kind === 'type' ? `type:${entry.name}` : entry.name
      const tally = byName.get(key) ?? {
        name: entry.name,
        ...(entry.kind === 'type' ? { kind: 'type' } : {}),
        correct: 0,
        total: 0,
      }
      tally.total += 1
      if (entry.correct) tally.correct += 1
      byName.set(key, tally)
    }
  }
  return {
    predictionStudentCount: predicted.length,
    predictionFirstAllCorrectCount: predicted.filter((task) => task.predictions.firstAllCorrect)
      .length,
    predictionFirstByName: [...byName.values()],
  }
}
