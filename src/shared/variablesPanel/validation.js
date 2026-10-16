// Lesson validation for the name-tag panel: the `showVariables` field shape and the
// `variables_predicted` check. Shared by the Builder and the CLI (through the python and turtle
// module definitions' validateTask and the check registry). Messages are documented in
// docs/authoring/validation-errors.md.
import {
  SHOW_VARIABLES_AT,
  SHOW_VARIABLES_MODES,
  STAGE_LISTS_OPTIONS,
  VARIABLE_NAME_PATTERN,
  getShowVariables,
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
  for (const field of ['hide', 'predict']) {
    if (raw[field] == null) continue
    if (!Array.isArray(raw[field])) {
      errors.push(`Task ${n} has showVariables ${field} that is not a list of variable names`)
      continue
    }
    const bad = badNames(raw[field])
    if (bad.length > 0) {
      errors.push(
        `Task ${n} has showVariables ${field} with names that are not Python variable names: ${bad.map(String).join(', ')}`
      )
    }
  }
  const mode = raw.mode ?? 'view'
  if (mode === 'predict' && (!Array.isArray(raw.predict) || raw.predict.length === 0)) {
    errors.push(`Task ${n} has showVariables mode: predict but no predict list of variable names`)
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
    if (check?.type !== 'variables_predicted') continue
    if (config?.mode !== 'predict') {
      errors.push(`Task ${n} has a variables_predicted check but showVariables mode is not predict`)
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

// The registry `validate` of the variables_predicted check (src/modules/python/checks.js).
export function validateVariablesPredictedCheck(check, { n, kind, moduleDefinition } = {}) {
  const label = kind === 'feedback' ? 'feedback check' : 'check'
  const errors = []
  // Only modules with the name-tag panel (the showVariables task field) can evaluate it.
  if (
    moduleDefinition &&
    !moduleDefinition.taskFields?.some((field) => field.name === 'showVariables')
  ) {
    errors.push(
      `Task ${n} has a variables_predicted ${label}, but it only works in Python and Turtle tasks`
    )
  }
  if (check.names != null) {
    if (!Array.isArray(check.names) || check.names.length === 0) {
      errors.push(
        `Task ${n} has a variables_predicted ${label} whose names is not a list of variable names`
      )
    } else if (badNames(check.names).length > 0) {
      errors.push(
        `Task ${n} has a variables_predicted ${label} with names that are not Python variable names`
      )
    }
  }
  return errors
}
