// Lesson validation for the name-tag panel: the `showVariables` field shape and the
// `variables_predicted` check. Shared by the Builder and the CLI (through the python and turtle
// module definitions' validateTask and the check registry). Messages are documented in
// docs/authoring/validation-errors.md.
import {
  PREDICT_ANSWER_KINDS,
  PREDICT_TYPE_LABELS,
  SHOW_VARIABLES_AT,
  SHOW_VARIABLES_MODES,
  STAGE_LISTS_OPTIONS,
  VARIABLE_NAME_PATTERN,
  getShowVariables,
  isPredictChoiceValue,
  predictEntryName,
} from './variablesPanel.js'
import { PEEK_MARKER } from '../lineHints.js'

// A task's check list (as normalizeChecks in src/modules/checks.js, which this file can't import:
// the check registry imports this file).
function normalizeChecks(check) {
  if (!check) return []
  return Array.isArray(check) ? check.filter((c) => c?.type) : [check]
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function badNames(list) {
  return (Array.isArray(list) ? list : []).filter(
    (name) => typeof name !== 'string' || !VARIABLE_NAME_PATTERN.test(name.trim())
  )
}

// The entries of a predict / predictType list whose name isn't a Python name (an entry may be
// a plain name or `{ name, … }`), as text for the message.
function badEntryNames(list) {
  return (Array.isArray(list) ? list : [])
    .filter((entry) => !VARIABLE_NAME_PATTERN.test(predictEntryName(entry)))
    .map((entry) =>
      typeof entry === 'string' ? entry : isPlainObject(entry) ? String(entry.name) : String(entry)
    )
}

// p6-27: the `{ name, answer, choices }` entries of `predict`, and the `{ name, choices }`
// entries of `predictType`.
function validatePredictEntries(raw, n, errors, warnings) {
  for (const entry of Array.isArray(raw.predict) ? raw.predict : []) {
    if (!isPlainObject(entry)) continue
    const name = predictEntryName(entry) || '?'
    if (entry.answer != null && !PREDICT_ANSWER_KINDS.includes(entry.answer)) {
      errors.push(
        `Task ${n} has showVariables predict ${name} with answer "${entry.answer}" — use one of: ${PREDICT_ANSWER_KINDS.join(', ')}`
      )
    }
    if (entry.choices != null) {
      if (
        !Array.isArray(entry.choices) ||
        entry.choices.length < 2 ||
        !entry.choices.every(isPredictChoiceValue)
      ) {
        errors.push(
          `Task ${n} has showVariables predict ${name} with choices that are not a list of at least two values (text, numbers, true/false)`
        )
      } else if (entry.answer != null) {
        warnings.push(
          `Task ${n} has showVariables predict ${name} with both answer and choices — the choices show as buttons, so answer is ignored`
        )
      }
    }
  }
  for (const entry of Array.isArray(raw.predictType) ? raw.predictType : []) {
    if (!isPlainObject(entry) || entry.choices == null) continue
    const name = predictEntryName(entry) || '?'
    const choices = Array.isArray(entry.choices) ? entry.choices : null
    if (!choices || choices.length < 2 || !choices.every((c) => PREDICT_TYPE_LABELS.includes(c))) {
      errors.push(
        `Task ${n} has showVariables predictType ${name} with choices that are not at least two of: ${PREDICT_TYPE_LABELS.join(', ')}`
      )
    }
  }
  const predictNames = (Array.isArray(raw.predict) ? raw.predict : []).map(predictEntryName)
  const both = (Array.isArray(raw.predictType) ? raw.predictType : [])
    .map(predictEntryName)
    .filter((name) => name && predictNames.includes(name))
  if (both.length > 0) {
    warnings.push(
      `Task ${n} has showVariables predict and predictType both naming ${both.join(', ')} — students predict its value and its type`
    )
  }
}

// Whether any of the task's authored code holds a `#@peek` marker line.
function taskHasPeekMarker(task) {
  const sources = [
    task?.starterCode,
    task?.completeCode,
    ...(Array.isArray(task?.codeStages) ? task.codeStages.map((stage) => stage?.code) : []),
  ]
  return sources.some(
    (code) =>
      typeof code === 'string' && code.split('\n').some((line) => /^#@peek(\s|$)/.test(line.trim()))
  )
}

export function validateShowVariables(task, n, errors, warnings = []) {
  const raw = task?.showVariables
  if (raw == null) {
    if (normalizeChecks(task?.check).some((check) => check?.type === 'variables_predicted')) {
      errors.push(
        `Task ${n} has a variables_predicted check but no showVariables with mode: predict`
      )
    }
    if (normalizeChecks(task?.check).some((check) => check?.type === 'types_predicted')) {
      errors.push(
        `Task ${n} has a types_predicted check but no showVariables predictType list (mode: predict)`
      )
    }
    return
  }
  if (!isPlainObject(raw)) {
    errors.push(`Task ${n} has a showVariables that is not an object — use { mode, at, … }`)
    return
  }
  if (raw.mode != null && !SHOW_VARIABLES_MODES.includes(raw.mode)) {
    errors.push(
      `Task ${n} has showVariables mode "${raw.mode}" — use one of: ${SHOW_VARIABLES_MODES.join(', ')}`
    )
  }
  if (raw.at != null && !SHOW_VARIABLES_AT.includes(raw.at)) {
    errors.push(
      `Task ${n} has showVariables at "${raw.at}" — use one of: ${SHOW_VARIABLES_AT.join(', ')}`
    )
  }
  if (raw.visuals != null && typeof raw.visuals !== 'boolean') {
    errors.push(`Task ${n} has showVariables visuals that is not true or false`)
  }
  if (raw.link != null && typeof raw.link !== 'boolean') {
    errors.push(`Task ${n} has showVariables link that is not true or false`)
  }
  if (raw.lockRun != null && typeof raw.lockRun !== 'boolean') {
    errors.push(`Task ${n} has showVariables lockRun that is not true or false`)
  }
  if (raw.lockRun != null && raw.mode !== 'predict') {
    warnings.push(
      `Task ${n} has showVariables lockRun but its mode is not predict — only predict mode locks Run, so it is ignored`
    )
  }
  if (raw.stageLists != null && !STAGE_LISTS_OPTIONS.includes(raw.stageLists)) {
    errors.push(
      `Task ${n} has showVariables stageLists "${raw.stageLists}" — use one of: ${STAGE_LISTS_OPTIONS.join(', ')}`
    )
  }
  if (raw.visuals === false && raw.stageLists != null) {
    warnings.push(
      `Task ${n} has showVariables stageLists but visuals is false — every tag is plain, so it is ignored`
    )
  }
  for (const field of ['hide', 'predict', 'predictType']) {
    if (raw[field] == null) continue
    if (!Array.isArray(raw[field])) {
      errors.push(`Task ${n} has showVariables ${field} that is not a list of variable names`)
      continue
    }
    const bad = field === 'hide' ? badNames(raw[field]).map(String) : badEntryNames(raw[field])
    if (bad.length > 0) {
      errors.push(
        `Task ${n} has showVariables ${field} with names that are not Python variable names: ${bad.join(', ')}`
      )
    }
  }
  validatePredictEntries(raw, n, errors, warnings)
  const mode = raw.mode ?? 'view'
  const listed = (field) => Array.isArray(raw[field]) && raw[field].length > 0
  if (mode === 'predict' && !listed('predict') && !listed('predictType')) {
    errors.push(
      `Task ${n} has showVariables mode: predict but no predict or predictType list of variable names`
    )
  }
  if (mode === 'target') {
    if (!isPlainObject(raw.target) || Object.keys(raw.target).length === 0) {
      errors.push(
        `Task ${n} has showVariables mode: target but no target values (target: { name: value })`
      )
    } else {
      const bad = badNames(Object.keys(raw.target))
      if (bad.length > 0) {
        errors.push(
          `Task ${n} has showVariables target names that are not Python variable names: ${bad.join(', ')}`
        )
      }
    }
  }
  if (mode !== 'predict' && raw.predict != null) {
    warnings.push(`Task ${n} has showVariables predict but mode is not predict — it is ignored`)
  }
  if (mode !== 'predict' && raw.predictType != null) {
    warnings.push(`Task ${n} has showVariables predictType but mode is not predict — it is ignored`)
  }
  if (mode !== 'target' && raw.target != null) {
    warnings.push(`Task ${n} has showVariables target but mode is not target — it is ignored`)
  }
  if (raw.at === 'marker' && !taskHasPeekMarker(task)) {
    warnings.push(
      `Task ${n} has showVariables at: marker but no ${PEEK_MARKER} line in its code — the panel shows the end of the run`
    )
  }

  const config = getShowVariables(task)
  for (const check of normalizeChecks(task?.check)) {
    if (check?.type === 'types_predicted') {
      if (config?.mode !== 'predict' || config.predictType.length === 0) {
        errors.push(
          `Task ${n} has a types_predicted check but no showVariables predictType list (mode: predict)`
        )
        continue
      }
      const names = Array.isArray(check.names) ? check.names : []
      const unknown = names.filter((name) => !config.predictType.includes(name))
      if (unknown.length > 0) {
        errors.push(
          `Task ${n} has a types_predicted check naming ${unknown.join(', ')}, which showVariables predictType does not list`
        )
      }
      continue
    }
    if (check?.type !== 'variables_predicted') continue
    if (config?.mode !== 'predict') {
      errors.push(`Task ${n} has a variables_predicted check but showVariables mode is not predict`)
      continue
    }
    if (config.predict.length === 0) {
      errors.push(
        `Task ${n} has a variables_predicted check but no showVariables predict list — use types_predicted for predictType`
      )
      continue
    }
    const names = Array.isArray(check.names) ? check.names : []
    const unknown = names.filter((name) => !config.predict.includes(name))
    if (unknown.length > 0) {
      errors.push(
        `Task ${n} has a variables_predicted check naming ${unknown.join(', ')}, which showVariables predict does not list`
      )
    }
  }
}

// The registry `validate` of the variables_predicted and types_predicted checks
// (src/modules/python/checks.js): the same rules, named by the check's type.
function validatePredictionCheckShape(check, { n, kind, moduleDefinition } = {}) {
  const label = kind === 'feedback' ? 'feedback check' : 'check'
  const type = check?.type === 'types_predicted' ? 'types_predicted' : 'variables_predicted'
  const errors = []
  // Only modules with the name-tag panel (the showVariables task field) can evaluate it.
  if (
    moduleDefinition &&
    !moduleDefinition.taskFields?.some((field) => field.name === 'showVariables')
  ) {
    errors.push(`Task ${n} has a ${type} ${label}, but it only works in Python and Turtle tasks`)
  }
  if (check.names != null) {
    if (!Array.isArray(check.names) || check.names.length === 0) {
      errors.push(`Task ${n} has a ${type} ${label} whose names is not a list of variable names`)
    } else if (badNames(check.names).length > 0) {
      errors.push(`Task ${n} has a ${type} ${label} with names that are not Python variable names`)
    }
  }
  return errors
}

export function validateVariablesPredictedCheck(check, options = {}) {
  return validatePredictionCheckShape({ ...check, type: 'variables_predicted' }, options)
}

export function validateTypesPredictedCheck(check, options = {}) {
  return validatePredictionCheckShape({ ...check, type: 'types_predicted' }, options)
}
