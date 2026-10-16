// Builder editing of a task's `showVariables` (the name-tag panel, src/shared/variablesPanel/).
// Pure: each function takes a task and returns the updated task, keeping a
// `variables_predicted` completion check in step with the predict list.
import { formatTargetValue, parsePythonLiteral } from '../shared/variablesPanel/predictions.js'

const PREDICTED = 'variables_predicted'

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

// Turns the panel on (view mode, at the end of the run) or off. Off also drops any
// variables_predicted check, which can't pass without the panel.
export function setShowVariablesEnabled(task, enabled) {
  if (enabled) {
    if (task?.showVariables) return task
    return { ...task, showVariables: { mode: 'view', at: 'end' } }
  }
  const { showVariables: _removed, ...rest } = task ?? {}
  return hasPredictionCheck(rest)
    ? withChecks(
        rest,
        checkList(rest.check).filter((check) => check?.type !== PREDICTED)
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
  if (next.mode !== 'target') delete next.target
  if (Array.isArray(next.hide) && next.hide.length === 0) delete next.hide
  if (next.visuals !== false) delete next.visuals
  // link (linked tags and code) is only written to turn it off.
  if (next.link !== false) delete next.link
  if (next.stageLists == null || next.stageLists === 'size') delete next.stageLists
  // lockRun is only written to turn predict mode's Run lock off.
  if (next.mode !== 'predict' || next.lockRun !== false) delete next.lockRun
  let updated = { ...task, showVariables: next }
  if (hasPredictionCheck(updated)) {
    const checks = checkList(updated.check)
    updated =
      next.mode === 'predict'
        ? withChecks(
            updated,
            checks.map((check) =>
              check?.type === PREDICTED ? { ...check, names: [...(next.predict ?? [])] } : check
            )
          )
        : withChecks(
            updated,
            checks.filter((check) => check?.type !== PREDICTED)
          )
  }
  return updated
}

// Adds or removes the completion check "every prediction is right".
export function setPredictionCheck(task, enabled) {
  const checks = checkList(task?.check).filter((check) => check?.type !== PREDICTED)
  if (!enabled) return withChecks(task, checks)
  const names = [...(task?.showVariables?.predict ?? [])]
  return withChecks(task, [...checks, { type: PREDICTED, names }])
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
  return (Array.isArray(names) ? names : []).join(', ')
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
