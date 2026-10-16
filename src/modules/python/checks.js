import {
  getVariableEntry,
  parseCheckValue,
  valueEquals,
  isPlainObject,
  normalizeTypeName,
  CODE_STRUCTURE_OPERATORS,
  evaluateCodeStructureCheck,
} from '../../shared/checkHelpers.js'
import {
  evaluateTypesPredictedCheck,
  evaluateVariablesPredictedCheck,
} from '../../shared/variablesPanel/predictions.js'
import {
  validateTypesPredictedCheck,
  validateVariablesPredictedCheck,
} from '../../shared/variablesPanel/validation.js'
import {
  RUN_COUNT_CHECK_OPERATORS,
  evaluateLineRunCountCheck,
  evaluateRunsPredictedCheck,
} from '../../shared/runCounts.js'
import {
  validateLineRunCountCheck,
  validateRunsPredictedCheck,
} from '../../shared/runCountsValidation.js'

// Every module with run counts (the runCounts task field): python and turtle.
const hasRunCounts = (moduleDefinition) =>
  !!moduleDefinition?.taskFields?.some((field) => field.name === 'runCounts')
import {
  STAGE_CHECK_TYPES,
  evaluateStageCheck,
  validateStageCheck,
} from '../../shared/stage/checks.js'
import { evaluateMaxLinesCheck, MAX_LINES_CHECK_TYPE } from '../../shared/puzzle/puzzle.js'

// Messages from validateCodeStructureCheck are documented in
// docs/authoring/validation-errors.md (validationErrorsDoc.test.js scans this file).

export const PYTHON_CHECK_TYPES = [
  'variable_exists',
  'variable_type',
  'variable_equals',
  'variable_not_equals',
  'variable_dict_contains',
  'variable_dict_equals',
  'variable_dict_key_value',
  'variable_array_contains',
  'variable_array_equals',
  'variable_array_nth_item',
]

export function evaluatePythonCheck(check, output, context = {}) {
  if (check.type === 'variable_exists') {
    return getVariableEntry(context.variables, check.name)?.exists === true
  }

  if (check.value == null) return false

  if (check.type === 'variable_type') {
    const variable = getVariableEntry(context.variables, check.name)
    return variable.exists && normalizeTypeName(variable.type) === normalizeTypeName(check.value)
  }

  if (check.type === 'variable_equals') {
    const variable = getVariableEntry(context.variables, check.name)
    return variable.exists && valueEquals(variable.value, parseCheckValue(check.value))
  }

  if (check.type === 'variable_not_equals') {
    const variable = getVariableEntry(context.variables, check.name)
    return variable.exists && !valueEquals(variable.value, parseCheckValue(check.value))
  }

  if (check.type === 'variable_dict_contains') {
    const variable = getVariableEntry(context.variables, check.name)
    if (!variable.exists || !isPlainObject(variable.value)) return false
    const expected = parseCheckValue(check.value)
    return Object.values(variable.value).some((value) => valueEquals(value, expected))
  }

  if (check.type === 'variable_dict_equals') {
    const variable = getVariableEntry(context.variables, check.name)
    return (
      variable.exists &&
      isPlainObject(variable.value) &&
      valueEquals(variable.value, parseCheckValue(check.value))
    )
  }

  if (check.type === 'variable_dict_key_value') {
    const variable = getVariableEntry(context.variables, check.name)
    if (!variable.exists || !isPlainObject(variable.value) || check.key == null) return false
    return valueEquals(variable.value[String(check.key)], parseCheckValue(check.value))
  }

  if (check.type === 'variable_array_contains') {
    const variable = getVariableEntry(context.variables, check.name)
    if (!variable.exists || !Array.isArray(variable.value)) return false
    const expected = parseCheckValue(check.value)
    return variable.value.some((item) => valueEquals(item, expected))
  }

  if (check.type === 'variable_array_equals') {
    const variable = getVariableEntry(context.variables, check.name)
    return (
      variable.exists &&
      Array.isArray(variable.value) &&
      valueEquals(variable.value, parseCheckValue(check.value))
    )
  }

  if (check.type === 'variable_array_nth_item') {
    const variable = getVariableEntry(context.variables, check.name)
    if (!variable.exists || !Array.isArray(variable.value)) return false
    const index = Number(check.index)
    if (!Number.isInteger(index) || index < 0 || index >= variable.value.length) return false
    return valueEquals(variable.value[index], parseCheckValue(check.value))
  }

  return false
}

const STAGE_CHECK_FIELDS = {
  stage_matches_target: ['tolerance'],
  stage_shape_count: ['kind', 'sides', 'min', 'max'],
  stage_colour_used: ['colour'],
  stage_pixel: ['x', 'y', 'row', 'col', 'index', 'colour'],
  stage_text_shown: ['text', 'operator'],
}

// Check-type registry definitions (see ../checkRegistry.js). Evaluated against the
// variables captured after a run (`context.variables`).
export const CHECKS = [
  ...PYTHON_CHECK_TYPES.map((type) => ({
    type,
    owner: 'module:python',
    timing: 'on_run',
    requiresRun: true,
    submitAllowed: false,
    contextKey: 'variables',
    evaluate: evaluatePythonCheck,
  })),
  {
    type: 'code_structure',
    owner: 'module:python',
    subject: 'Code structure (nesting)',
    operators: CODE_STRUCTURE_OPERATORS,
    fields: ['operator', 'inner', 'outer'],
    timing: 'on_change',
    requiresRun: false,
    submitAllowed: true,
    contextKey: 'code',
    evaluate: (check, _output, context = {}) => evaluateCodeStructureCheck(check, context?.code),
    validate: validateCodeStructureCheck,
  },
  // The name-tag panel's predict mode (showVariables, src/shared/variablesPanel/): every listed
  // prediction matched the value the panel showed after Run, compared like a typed quiz answer.
  // Reads the predictions and snapshot the run hands over (`context.variablePredictions`), so
  // `lessons test-checks` reports it as needing a run. Python and Turtle tasks.
  {
    type: 'variables_predicted',
    owner: 'module:python',
    subject: 'Variable predictions',
    fields: ['names'],
    timing: 'on_run',
    requiresRun: true,
    submitAllowed: false,
    contextKey: 'variablePredictions',
    // Every module with the name-tag panel (the showVariables task field): python and turtle.
    appliesTo: (moduleDefinition) =>
      !!moduleDefinition?.taskFields?.some((field) => field.name === 'showVariables'),
    evaluate: evaluateVariablesPredictedCheck,
    validate: validateVariablesPredictedCheck,
  },
  // Predict mode's type predictions (showVariables.predictType, p6-27): every listed name's
  // picked type label is the one the panel showed after Run. Like variables_predicted it reads
  // `context.variablePredictions`, so it needs a real run. Python and Turtle tasks.
  {
    type: 'types_predicted',
    owner: 'module:python',
    subject: 'Type predictions',
    fields: ['names'],
    timing: 'on_run',
    requiresRun: true,
    submitAllowed: false,
    contextKey: 'variablePredictions',
    appliesTo: (moduleDefinition) =>
      !!moduleDefinition?.taskFields?.some((field) => field.name === 'showVariables'),
    evaluate: evaluateTypesPredictedCheck,
    validate: validateTypesPredictedCheck,
  },
  // Run counts (task runCounts / #@count, src/shared/runCounts.js, p6-26): every marked line's
  // "how many times?" prediction (or those `lines` names) matched its real count. Reads
  // `context.runCounts` from the run. Python and Turtle tasks.
  {
    type: 'runs_predicted',
    owner: 'module:python',
    subject: 'Run-count predictions',
    fields: ['lines'],
    timing: 'on_run',
    requiresRun: true,
    submitAllowed: false,
    contextKey: 'runCounts',
    appliesTo: hasRunCounts,
    evaluate: evaluateRunsPredictedCheck,
    validate: validateRunsPredictedCheck,
  },
  // A counted line ran `value` times (equals, min, max): `line` (a starter line) or the first
  // #@count line. Reads `context.runCounts`. Python and Turtle tasks.
  {
    type: 'line_run_count',
    owner: 'module:python',
    subject: 'How many times a line ran',
    operators: RUN_COUNT_CHECK_OPERATORS,
    fields: ['line', 'operator', 'value'],
    timing: 'on_run',
    requiresRun: true,
    submitAllowed: false,
    contextKey: 'runCounts',
    appliesTo: hasRunCounts,
    evaluate: evaluateLineRunCountCheck,
    validate: validateLineRunCountCheck,
  },
  // Puzzle rules (task `puzzle`, src/shared/puzzle/puzzle.js): the student's code has at most
  // `value` lines of code (blank and comment lines don't count; `value` defaults to
  // puzzle.maxLines). No run needed. Python and Turtle tasks.
  {
    type: MAX_LINES_CHECK_TYPE,
    owner: 'module:python',
    subject: 'Lines of code',
    fields: ['value'],
    timing: 'on_change',
    requiresRun: false,
    submitAllowed: true,
    contextKey: 'code',
    // Every module with puzzle rules (the puzzle task field): python and turtle.
    appliesTo: (moduleDefinition) =>
      !!moduleDefinition?.taskFields?.some((field) => field.name === 'puzzle'),
    evaluate: (check, _output, context = {}) => evaluateMaxLinesCheck(check, context),
  },
  // The Python Stage (src/shared/stage/): checks on the run's drawing (`context.stage`:
  // { commands, target }). They need a run, so `lessons test-checks` reports them as needing
  // one. Fields are per type (see docs/authoring/python.md "Stage").
  ...STAGE_CHECK_TYPES.map((type) => ({
    type,
    owner: 'module:python',
    subject: 'Stage drawing',
    fields: STAGE_CHECK_FIELDS[type],
    timing: 'on_run',
    requiresRun: true,
    submitAllowed: false,
    contextKey: 'stage',
    evaluate: (check, _output, context = {}) => evaluateStageCheck(check, context),
    validate: validateStageCheck,
  })),
]

// `code_structure` reads Python indentation, so it only works in Python tasks (including
// code_arrange tasks hosted by Python). The operator is required — there is no default.
export function validateCodeStructureCheck(check, { n, kind, moduleDefinition } = {}) {
  const label = kind === 'feedback' ? 'feedback check' : 'check'
  const errors = []
  if (moduleDefinition && moduleDefinition.type !== 'python') {
    errors.push(
      `Task ${n} has a code_structure ${label}, but code_structure checks only work in Python tasks`
    )
  }
  if (!CODE_STRUCTURE_OPERATORS.includes(check.operator)) {
    errors.push(
      `Task ${n} has a code_structure ${label} with operator "${check.operator ?? ''}" — use one of: ${CODE_STRUCTURE_OPERATORS.join(', ')}`
    )
  }
  if (typeof check.inner !== 'string' || !check.inner.trim()) {
    errors.push(`Task ${n} has a code_structure ${label} but no inner line`)
  }
  if (typeof check.outer !== 'string' || !check.outer.trim()) {
    errors.push(`Task ${n} has a code_structure ${label} but no outer line`)
  }
  return errors
}
