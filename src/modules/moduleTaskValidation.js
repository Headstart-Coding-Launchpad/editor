// Pure building blocks for each module definition's `validateTask` (the rules shared by the
// Builder's validateLesson and the CLI's validateLessonForMcp). Node-safe: imported by
// src/modules/<type>/definition.js, which the CLI loads under plain ESM.
//
// Messages here are documented in docs/authoring/validation-errors.md
// (validationErrorsDoc.test.js scans this file).
import {
  checkAllowedForSubmit,
  checkRequiresRun,
  evaluateSingleCheck,
  getCheckDefinition,
  normalizeChecks,
  normalizeFeedbackChecks,
} from './checks.js'
import { normalizeHtmlCheck } from './html/checks.js'
import { normalizeSequenceItem, opcodeSpecOpcodes } from './scratch/checks.js'
import { VALUE_INPUT_DEFAULTS } from './scratch/blockInputs.js'
import { ELECTRONICS_CHECK_TYPES } from './electronics/circuit.js'
import { getStarterStage } from '../shared/taskStages.js'
import { stripLineHints } from '../shared/lineHints.js'
import { hasValue, labelCheckKind } from '../shared/checkAuthoringValidation.js'

// Feedback (incorrect-answer) checks as the Builder edits them; [] when the task has none.
export function collectFeedbackChecks(task) {
  if (task?.feedbackChecks == null && task?.incorrectChecks == null) return []
  return normalizeFeedbackChecks(task)
}

// Runs a check-field validator, `validate(checks, kind)`, over the completion check and then
// any feedback checks (kind 'completion' / 'feedback').
export function validateTaskChecks(task, validate) {
  if (task.check) validate(task.check, 'completion')
  const feedbackChecks = collectFeedbackChecks(task)
  if (feedbackChecks.length > 0) validate(feedbackChecks, 'feedback')
}

// Rules a check type declares itself: the registry definition's optional
// `validate(check, { n, kind, task, moduleDefinition })` returns complete messages (starting
// `Task ${n} `). `moduleDefinition` is the task's effective module (null when unknown), so a
// check type can reject modules that can't evaluate it. Runs for the completion check and any
// feedback checks of a task that uses a module.
export function validateRegisteredChecks(task, n, errors, { moduleDefinition = null } = {}) {
  validateTaskChecks(task, (checks, kind) => {
    for (const check of normalizeChecks(checks)) {
      const messages = getCheckDefinition(check?.type)?.validate?.(check, {
        n,
        kind,
        task,
        moduleDefinition,
      })
      if (Array.isArray(messages)) errors.push(...messages)
    }
  })
}

// Stage labels, plus (for modules whose stages hold state) the stage's state object.
export function validateStageStates(task, n, errors, { stateKey = null, stateLabel = '' } = {}) {
  if (!(task.codeStages?.length > 0)) return
  task.codeStages.forEach((stage, si) => {
    if (!stage?.label?.trim()) errors.push(`Task ${n} stage ${si + 1} is missing a label`)
    if (stateKey && (!stage?.[stateKey] || typeof stage[stateKey] !== 'object'))
      errors.push(`Task ${n} stage ${si + 1} has no ${stateLabel} state`)
  })
}

export function validateHtmlStarterFiles(task, n, errors) {
  if (!task.starterFiles || task.starterFiles.length === 0) {
    errors.push(`Task ${n} has no files`)
    return
  }
  const names = task.starterFiles.map((file) => file?.name)
  if (new Set(names).size !== names.length) errors.push(`Task ${n} has duplicate filenames`)
  if (!task.starterFiles.some((file) => file?.type === 'html' || file?.name?.endsWith?.('.html'))) {
    errors.push(`Task ${n} has no HTML file to use as entry point`)
  }
}

// Field checks for generic code/output/variable/HTML-element checks (Python, HTML, Arcade).
export function validateCodeChecks(
  checks,
  n,
  errors,
  kind = 'completion',
  { html = false, interactionMode } = {}
) {
  const label = labelCheckKind(kind)
  const normalized = normalizeChecks(checks).map(normalizeHtmlCheck)
  if (interactionMode === 'submit' && normalized.some((check) => !checkAllowedForSubmit(check))) {
    errors.push(`Task ${n} uses submit mode but has a ${label} that requires running the code`)
  }
  if (
    normalized.some((check) => check.type?.startsWith('html_element') && !check.selector?.trim())
  ) {
    errors.push(`Task ${n} has an element ${label} but no CSS selector`)
  }
  if (
    normalized.some((check) => check.type === 'html_element_attribute' && !check.attribute?.trim())
  ) {
    errors.push(`Task ${n} has an element attribute ${label} but no attribute name`)
  }
  if (
    normalized.some(
      (check) => check.type === 'html_element_style_property' && !check.property?.trim()
    )
  ) {
    errors.push(`Task ${n} has an element style ${label} but no CSS property`)
  }
  if (normalized.some((check) => check.type?.startsWith('variable_') && !check.name?.trim())) {
    errors.push(`Task ${n} has a variable ${label} but no variable name`)
  }
  if (normalized.some((check) => check.type === 'variable_dict_key_value' && !check.key?.trim())) {
    errors.push(`Task ${n} has a dictionary key-value ${label} but no key`)
  }
  if (
    normalized.some(
      (check) =>
        check.type === 'variable_array_nth_item' &&
        (check.index == null || check.index === '' || Number(check.index) < 0)
    )
  ) {
    errors.push(`Task ${n} has an array N-th item ${label} but no valid index`)
  }
  const noValueTypes = [
    'code_no_error',
    'output_not_empty',
    'output_empty',
    'html_element',
    'variable_exists',
    // inner / outer instead of a value; its own validate() (python/checks.js) checks them.
    'code_structure',
  ]
  if (html) noValueTypes.push('html_element_attribute', 'html_element_style_property')
  if (normalized.some((check) => !noValueTypes.includes(check.type) && !hasValue(check.value))) {
    errors.push(`Task ${n} has a ${label} enabled but no check value`)
  }
}

const isPlainObject = (value) => !!value && typeof value === 'object' && !Array.isArray(value)

// Problem with a Scratch opcode spec — a check's or sequence item's `opcode`: one opcode
// name, or a non-empty list of alternatives, each an opcode name or { opcode, fieldValues? }.
// Returns 'missing', 'empty_list', 'invalid' or null.
function opcodeSpecProblem(spec) {
  if (spec == null || spec === '') return 'missing'
  if (typeof spec === 'string') return spec.trim() ? null : 'missing'
  if (!Array.isArray(spec)) return 'invalid'
  if (spec.length === 0) return 'empty_list'
  const validAlternative = (alt) =>
    typeof alt === 'string'
      ? !!alt.trim()
      : isPlainObject(alt) &&
        typeof alt.opcode === 'string' &&
        !!alt.opcode.trim() &&
        (alt.fieldValues == null || isPlainObject(alt.fieldValues))
  return spec.every(validAlternative) ? null : 'invalid'
}

// Shared fieldValues keys that are a known value input of one alternative but not of another
// (VALUE_INPUT_DEFAULTS lists value inputs only; alternatives it doesn't know, and dropdown
// fields, are skipped rather than guessed).
function sharedFieldValueKeysMissingFromAlternatives(spec, fieldValues) {
  if (!Array.isArray(spec) || !isPlainObject(fieldValues)) return []
  const opcodes = opcodeSpecOpcodes(spec)
  const known = opcodes.filter((opcode) => Object.hasOwn(VALUE_INPUT_DEFAULTS, opcode))
  const hasInput = (opcode, key) => Object.hasOwn(VALUE_INPUT_DEFAULTS[opcode], key)
  return Object.keys(fieldValues).filter(
    (key) =>
      known.some((opcode) => hasInput(opcode, key)) &&
      known.some((opcode) => !hasInput(opcode, key))
  )
}

export function validateScratchChecks(checks, n, errors, kind = 'completion', warnings = []) {
  const label = labelCheckKind(kind)
  // `what` is the check label, e.g. "check" or "block-order check".
  const warnSharedFieldValues = (spec, fieldValues, what) => {
    for (const key of sharedFieldValueKeysMissingFromAlternatives(spec, fieldValues)) {
      warnings.push(
        `Task ${n} has a Scratch ${what} whose shared fieldValues key ${key} is not an input of every alternative opcode — give each alternative its own fieldValues`
      )
    }
  }
  for (const check of normalizeChecks(checks)) {
    if (check.type === 'block_used' || check.type === 'block_run' || check.type === 'block_count') {
      const problem = opcodeSpecProblem(check.opcode)
      if (problem === 'missing') {
        errors.push(`Task ${n} has a Scratch ${label} but no block opcode`)
      } else if (problem === 'empty_list') {
        errors.push(`Task ${n} has a Scratch ${label} with an empty list of block opcodes`)
      } else if (problem === 'invalid') {
        errors.push(
          `Task ${n} has a Scratch ${label} with an invalid block opcode — use an opcode name or a list of opcode names or { opcode, fieldValues } entries`
        )
      } else if (check.type === 'block_count') {
        if (Array.isArray(check.opcode) && check.opcode.some((alt) => alt?.fieldValues)) {
          warnings.push(
            `Task ${n} has a Scratch block-count ${label} with fieldValues on an alternative — block_count counts by opcode only and ignores them`
          )
        }
      } else {
        warnSharedFieldValues(check.opcode, check.fieldValues, label)
      }
    }
    if (check.type === 'blocks_in_order') {
      if (!Array.isArray(check.sequence) || check.sequence.length === 0) {
        errors.push(`Task ${n} has a Scratch block-order ${label} but no block sequence`)
      } else {
        // A bare list item ([a, b]) would be a list inside a list, which Firestore can't store.
        if (check.sequence.some((item) => Array.isArray(item))) {
          errors.push(
            `Task ${n} has a Scratch block-order ${label} with a list as a sequence item — write alternatives as opcode: [...] inside the item`
          )
        }
        const items = check.sequence.map((item) => normalizeSequenceItem(item))
        const problems = items.map((item, i) =>
          Array.isArray(check.sequence[i]) ? 'bare_list' : opcodeSpecProblem(item.opcode)
        )
        if (problems.includes('missing')) {
          errors.push(`Task ${n} has a Scratch block-order ${label} with an empty block opcode`)
        }
        if (problems.includes('empty_list')) {
          errors.push(
            `Task ${n} has a Scratch block-order ${label} with an empty list of block opcodes`
          )
        }
        if (problems.includes('invalid')) {
          errors.push(
            `Task ${n} has a Scratch block-order ${label} with an invalid block opcode — use an opcode name or a list of opcode names or { opcode, fieldValues } entries`
          )
        }
        items.forEach((item, i) => {
          if (!problems[i]) {
            warnSharedFieldValues(item.opcode, item.fieldValues, `block-order ${label}`)
          }
        })
      }
    }
    if (
      (check.type === 'sprite_property' || check.type === 'sprite_property_delta') &&
      (!check.property || !check.operator || !hasValue(check.value))
    ) {
      errors.push(
        `Task ${n} has a Scratch sprite-property ${label} with missing property, operator, or value`
      )
    }
    if (check.type === 'sprite_property_changed' && !check.property) {
      errors.push(`Task ${n} has a Scratch sprite-changed ${label} but no property`)
    }
    if (
      (check.type === 'variable_equals' || check.type === 'variable_compare') &&
      !(check.variableName ?? check.name)?.trim?.()
    ) {
      errors.push(`Task ${n} has a Scratch variable ${label} but no variable name`)
    }
    if (
      (check.type === 'variable_equals' || check.type === 'variable_compare') &&
      !hasValue(check.value)
    ) {
      errors.push(`Task ${n} has a Scratch variable ${label} but no expected value`)
    }
    if (check.type === 'variable_compare' && !check.operator) {
      errors.push(`Task ${n} has a Scratch variable ${label} but no operator`)
    }
    if (check.type === 'costume_is' && !hasValue(check.value)) {
      errors.push(`Task ${n} has a Scratch costume ${label} but no costume name`)
    }
  }
}

// Python test cases (inputs substituted into the check).
export function validatePythonTests(task, n, errors, warnings) {
  if (!(task.tests?.length > 0)) return
  task.tests.forEach((test, ti) => {
    const tn = ti + 1
    if (!test.inputs?.length) {
      warnings.push(`Task ${n} test ${tn} has no inputs — consider adding at least one input`)
    } else if (test.inputs.some((inp) => !inp.name?.trim())) {
      warnings.push(
        `Task ${n} test ${tn} has an input with no name — it can still run, but {placeholder} substitution won't work`
      )
    }
    if (!test.check) {
      errors.push(`Task ${n} test ${tn} has no check — add an output check for this test case`)
    }
  })
}

// ── Starter content (the "no starter code" warning) ──────────────────────────
export function codeStarterPresent(task) {
  return !!(getStarterStage(task)?.stage?.code ?? task.starterCode)
}

export function filesStarterPresent(task) {
  return !!task.starterFiles?.some((file) => file?.content?.trim?.())
}

// ── Complete-solution warnings ───────────────────────────────────────────────
// The static checks the authored complete code/files fail, plus a reminder to run the
// complete solution when there are run-time checks the validator can't evaluate. Line-hint
// markers are stripped first, as they are for students (src/shared/lineHints.js).
export function warnCompleteCode(task, n, warnings) {
  if (!task.check || task.completeCode == null) return
  const allChecks = normalizeChecks(task.check)
  const staticChecks = allChecks.filter((c) => checkAllowedForSubmit(c))
  const dynamicChecks = allChecks.filter((c) => checkRequiresRun(c))
  const code = stripLineHints(task.completeCode, 'python')
  if (staticChecks.length > 0 && staticChecks.some((c) => !evaluateSingleCheck(c, '', { code }))) {
    warnings.push(`Task ${n} complete solution fails a code check — review the complete code`)
  }
  if (dynamicChecks.length > 0 && !task._checkTested) {
    warnings.push(
      `Task ${n} has output checks — open the Complete tab and run to verify the complete solution`
    )
  }
}

export function warnCompleteFiles(task, n, warnings) {
  if (!task.check || !(task.completeFiles?.length > 0)) return
  const allChecks = normalizeChecks(task.check)
  const staticChecks = allChecks.filter((c) => checkAllowedForSubmit(c))
  const dynamicChecks = allChecks.filter((c) => checkRequiresRun(c))
  if (staticChecks.length > 0) {
    const codeStr = task.completeFiles
      .map((f) => stripLineHints(f?.content ?? '', 'html'))
      .join('\n')
    if (staticChecks.some((c) => !evaluateSingleCheck(c, '', { code: codeStr }))) {
      warnings.push(`Task ${n} complete solution fails a code check — review the complete files`)
    }
  }
  if (dynamicChecks.length > 0 && !task._checkTested) {
    warnings.push(
      `Task ${n} has element/output checks — open the Complete tab and run to verify the complete solution`
    )
  }
}

function isStateFsCheck(c) {
  return c.type?.startsWith('fs_') && c.type !== 'fs_dir_opened' && c.type !== 'fs_file_opened'
}

export function warnCompleteFs(task, n, warnings) {
  if (!task.check || !task.completeFs || typeof task.completeFs !== 'object') return
  const fsChecks = normalizeChecks(task.check).filter(isStateFsCheck)
  if (fsChecks.some((c) => !evaluateSingleCheck(c, '', { fs: task.completeFs }))) {
    warnings.push(
      `Task ${n} complete filesystem does not satisfy a check — review the complete filesystem`
    )
  }
}

// Window rules only: the complete-desktop editor sets files and windows, never browser history,
// so browser_visited / search_query checks could never pass against it. A `resized` window_state
// compares against the size the student's window started at, which a complete state can't show.
const DESKTOP_STATE_CHECK_TYPES = ['window_state', 'windows_arranged_side_by_side']
const isCompleteDesktopCheck = (c) =>
  DESKTOP_STATE_CHECK_TYPES.includes(c.type) &&
  !(c.type === 'window_state' && c.operator === 'resized')

export function warnCompleteDesktop(task, n, warnings) {
  if (!task.check || !task.completeDesktop || typeof task.completeDesktop !== 'object') return
  const context = { fs: task.completeDesktop.fs, desktop: task.completeDesktop }
  const desktopChecks = normalizeChecks(task.check).filter(
    (c) => isStateFsCheck(c) || isCompleteDesktopCheck(c)
  )
  if (desktopChecks.some((c) => !evaluateSingleCheck(c, '', context))) {
    warnings.push(
      `Task ${n} complete desktop does not satisfy a check — review the complete desktop`
    )
  }
}

export function warnCompleteCircuit(task, n, warnings) {
  if (!task.check || !task.completeCircuit) return
  const circuitChecks = normalizeChecks(task.check).filter((c) =>
    ELECTRONICS_CHECK_TYPES.includes(c.type)
  )
  if (circuitChecks.some((c) => !evaluateSingleCheck(c, '', { circuit: task.completeCircuit }))) {
    warnings.push(
      `Task ${n} complete breadboard does not satisfy a check — review the complete circuit`
    )
  }
}

// ── "Has a check worth testing" (Builder's untested-check reminder) ──────────
const NO_VALUE_CODE_CHECK_TYPES = [
  'code_no_error',
  'output_not_empty',
  'output_empty',
  'element_exists',
  'element_attribute',
  'element_style_property',
  'variable_exists',
  'code_structure',
]

export function codeCheckHasValue(task) {
  return normalizeChecks(task.check).some(
    (check) => NO_VALUE_CODE_CHECK_TYPES.includes(check.type) || check.value
  )
}

export function anyCheckHasValue(task) {
  return !!task.check
}
