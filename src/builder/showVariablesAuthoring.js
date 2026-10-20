// Builder editing of a task's `showVariables` (the name-tag panel, src/shared/variablesPanel/).
// Pure: each function takes a task and returns the updated task, keeping a
// `variables_predicted` completion check in step with the predict list.
import { formatTargetValue, parsePythonLiteral } from '../shared/variablesPanel/predictions.js'
import { predictEntryName } from '../shared/variablesPanel/variablesPanel.js'

const PREDICTED = 'variables_predicted'
const TYPES_PREDICTED = 'types_predicted'

// The names of a predict / predictType list (entries may be `{ name, answer, choices }`).
export function predictNames(entries) {
  return (Array.isArray(entries) ? entries : []).map(predictEntryName).filter(Boolean)
}

/**
 * A predict list edited as names (the Builder's "Students predict" box): each name keeps its
 * existing entry, so an `{ name, answer, choices }` written in YAML survives the edit; new names
 * are plain.
 */
export function mergePredictEntries(entries, names) {
  const byName = new Map(
    (Array.isArray(entries) ? entries : []).map((entry) => [predictEntryName(entry), entry])
  )
  return names.map((name) => byName.get(name) ?? name)
}

function checkList(check) {
  if (!check) return []
  return Array.isArray(check) ? check : [check]
}

function withChecks(task, checks) {
  const next = { ...task }
  if (checks.length === 0) next.check = null
  else next.check = checks
  return next
}

export function hasPredictionCheck(task) {
  return checkList(task?.check).some((check) => check?.type === PREDICTED)
}

export function hasTypePredictionCheck(task) {
  return checkList(task?.check).some((check) => check?.type === TYPES_PREDICTED)
}

// Turns the panel on (view mode, at the end of the run) or off. Off also drops any
// variables_predicted / types_predicted check, which can't pass without the panel.
export function setShowVariablesEnabled(task, enabled) {
  if (enabled) {
    if (task?.showVariables) return task
    return { ...task, showVariables: { mode: 'view', at: 'end' } }
  }
  const { showVariables: _removed, ...rest } = task ?? {}
  return hasPredictionCheck(rest) || hasTypePredictionCheck(rest)
    ? withChecks(
        rest,
        checkList(rest.check).filter(
          (check) => check?.type !== PREDICTED && check?.type !== TYPES_PREDICTED
        )
      )
    : rest
}

/**
 * Merges `patch` into showVariables, dropping fields the mode doesn't use (predict outside
 * predict mode, target outside target mode, an empty hide list) and the defaults (visuals:
 * true, stageLists: size, link: true), and keeping the variables_predicted check's names equal to the
 * predict list (or removing the check when the mode is no longer predict).
 */
export function updateShowVariables(task, patch) {
  const current = task?.showVariables ?? { mode: 'view', at: 'end' }
  const next = { ...current, ...patch }
  if (next.mode !== 'predict') delete next.predict
  if (next.mode !== 'predict' || (Array.isArray(next.predictType) && !next.predictType.length)) {
    delete next.predictType
  }
  if (next.mode !== 'target') delete next.target
  if (Array.isArray(next.hide) && next.hide.length === 0) delete next.hide
  if (next.visuals !== false) delete next.visuals
  // link (linked tags and code) is only written to turn it off.
  if (next.link !== false) delete next.link
  if (next.stageLists == null || next.stageLists === 'size') delete next.stageLists
  // lockRun is only written to turn predict mode's Run lock off.
  if (next.mode !== 'predict' || next.lockRun !== false) delete next.lockRun
  // placement is only written to move predict tags above the code.
  if (next.mode !== 'predict' || next.placement !== 'above') delete next.placement
  let updated = { ...task, showVariables: next }
  // Each prediction check's names follow its list; outside predict mode the checks go.
  for (const [type, field] of [
    [PREDICTED, 'predict'],
    [TYPES_PREDICTED, 'predictType'],
  ]) {
    if (!checkList(updated.check).some((check) => check?.type === type)) continue
    const checks = checkList(updated.check)
    const names = predictNames(next[field])
    updated =
      next.mode === 'predict'
        ? withChecks(
            updated,
            checks.map((check) => (check?.type === type ? { ...check, names } : check))
          )
        : withChecks(
            updated,
            checks.filter((check) => check?.type !== type)
          )
  }
  return updated
}

// Adds or removes the completion check "every prediction is right".
export function setPredictionCheck(task, enabled) {
  const checks = checkList(task?.check).filter((check) => check?.type !== PREDICTED)
  if (!enabled) return withChecks(task, checks)
  const names = predictNames(task?.showVariables?.predict)
  return withChecks(task, [...checks, { type: PREDICTED, names }])
}

// Adds or removes the completion check "every type prediction is right" (types_predicted).
export function setTypePredictionCheck(task, enabled) {
  const checks = checkList(task?.check).filter((check) => check?.type !== TYPES_PREDICTED)
  if (!enabled) return withChecks(task, checks)
  const names = predictNames(task?.showVariables?.predictType)
  return withChecks(task, [...checks, { type: TYPES_PREDICTED, names }])
}

/** "score, lives" → ['score', 'lives'] (blank and repeated names dropped). */
export function parseNameList(text) {
  const seen = new Set()
  return String(text ?? '')
    .split(/[,\s]+/)
    .map((name) => name.trim())
    .filter((name) => name && !seen.has(name) && seen.add(name))
}

export function formatNameList(names) {
  return predictNames(names).join(', ')
}

// A target value written as Python (or JSON): 10, "Sam", ['key', 'map'], {"a": 1}, True.
// Anything that isn't a literal is kept as text.
export function parseTargetValue(text) {
  const trimmed = String(text ?? '').trim()
  const parsed = parsePythonLiteral(trimmed)
  if (!parsed.ok) return trimmed
  return toPlainValue(parsed.value)
}

function toPlainValue(value) {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) return value.map(toPlainValue)
  if ('str' in value && Object.keys(value).length === 1) return value.str
  if (Array.isArray(value.items)) return value.items.map(toPlainValue)
  if (Array.isArray(value.entries)) {
    return Object.fromEntries(
      value.entries.map(([key, item]) => [String(toPlainValue(key)), toPlainValue(item)])
    )
  }
  return value
}

/** { score: 10, name: "Sam" } → 'score = 10\nname = "Sam"' */
export function formatTargetLines(target) {
  if (!target || typeof target !== 'object') return ''
  return Object.entries(target)
    .map(([name, value]) => `${name} = ${formatTargetValue(value)}`)
    .join('\n')
}

/** 'score = 10\nname = "Sam"' → { score: 10, name: 'Sam' } (lines without "=" are skipped). */
export function parseTargetLines(text) {
  const target = {}
  for (const line of String(text ?? '').split('\n')) {
    const at = line.indexOf('=')
    if (at < 0) continue
    const name = line.slice(0, at).trim()
    if (!name) continue
    target[name] = parseTargetValue(line.slice(at + 1))
  }
  return target
}
