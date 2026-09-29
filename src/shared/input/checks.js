// Input ("how was it done") check types, owner 'input'. They evaluate against `ctx.input`, the
// small serialisable summary from ./targetSummary.js, so any surface that records input (the
// Desktop today) can reuse them. A module opts in by listing them in its definition's
// `inheritsCheckTypes`; validate() rejects them on tasks whose module doesn't record input.
// Pure: Node-safe (registered in src/modules/checks.js, which the CLI imports).
//
// Messages here are documented in docs/authoring/validation-errors.md
// (validationErrorsDoc.test.js scans this file).

import { isReservedCombo, normalizeCombo } from './events.js'
import { TOUCH_EQUIVALENTS } from './gestures.js'
import { INPUT_TARGET_KINDS, isShortcutCombo } from './targetSummary.js'

export const INPUT_GESTURES = ['click', 'double_click', 'right_click', 'drag', 'scroll', 'hover']
export const INPUT_SHORTCUT_VIA = ['keyboard', 'menu', 'any']
export const INPUT_MODIFIERS = ['shift', 'caps_lock']

export const INPUT_CHECK_DEFINITIONS = {
  input_gesture: {
    subject: 'Mouse gesture used',
    operators: [],
    fields: ['gesture', 'targetKind', 'dropTargetKind', 'min', 'strict'],
    evaluate: 'on_change',
  },
  input_shortcut: {
    subject: 'Keyboard shortcut used',
    operators: [],
    fields: ['combo', 'via', 'min'],
    evaluate: 'on_change',
  },
  input_modifier: {
    subject: 'Shift / Caps Lock used',
    operators: [],
    fields: ['modifier', 'notCapsLock', 'min'],
    evaluate: 'on_change',
  },
}

export const INPUT_CHECK_TYPES = Object.keys(INPUT_CHECK_DEFINITIONS)

export function isInputCheck(check) {
  return INPUT_CHECK_TYPES.includes(check?.type)
}

// The minimum count a check asks for (default 1).
export function inputCheckMin(check) {
  const min = Number(check?.min ?? 1)
  return Number.isInteger(min) && min > 0 ? min : 1
}

function gestureCount(input, gesture, kind) {
  return input?.gestures?.[gesture]?.[kind ?? 'any'] ?? 0
}

export function evaluateInputGesture(check, input) {
  if (!input || !INPUT_GESTURES.includes(check.gesture)) return false
  const min = inputCheckMin(check)
  if (check.gesture === 'drag' && check.dropTargetKind) {
    return (input.drops?.[`${check.targetKind ?? 'any'}>${check.dropTargetKind}`] ?? 0) >= min
  }
  let count = gestureCount(input, check.gesture, check.targetKind)
  const touch = TOUCH_EQUIVALENTS[check.gesture]
  if (!check.strict && touch && touch !== check.gesture) {
    count += gestureCount(input, touch, check.targetKind)
  }
  return count >= min
}

export function evaluateInputShortcut(check, input) {
  if (!input || !check.combo) return false
  const counts = input.shortcuts?.[normalizeCombo(check.combo)] ?? {}
  const via = check.via ?? 'keyboard'
  const count = via === 'any' ? (counts.keyboard ?? 0) + (counts.menu ?? 0) : (counts[via] ?? 0)
  return count >= inputCheckMin(check)
}

export function evaluateInputModifier(check, input) {
  if (!input) return false
  const min = inputCheckMin(check)
  if (check.modifier === 'caps_lock') return (input.capsLockCapitals ?? 0) >= min
  if (check.modifier !== 'shift') return false
  if (check.notCapsLock && (input.capsLockCapitals ?? 0) > 0) return false
  return (input.shiftCapitals ?? 0) >= min
}

const EVALUATORS = {
  input_gesture: evaluateInputGesture,
  input_shortcut: evaluateInputShortcut,
  input_modifier: evaluateInputModifier,
}

function label(kind) {
  return kind === 'feedback' ? 'feedback check' : 'check'
}

// Rules shared by all three: only modules that record input can use them, and `min` (when
// given) is a positive whole number.
function validateCommon(check, { n, kind, moduleDefinition }) {
  const errors = []
  if (moduleDefinition && !moduleDefinition.inheritsCheckTypes?.includes(check.type)) {
    errors.push(
      `Task ${n} has an ${check.type} ${label(kind)}, but ${moduleDefinition.meta?.label ?? 'this'} tasks don't record input — input checks work in Desktop tasks`
    )
  }
  if (check.min != null) {
    const min = Number(check.min)
    if (!Number.isInteger(min) || min <= 0) {
      errors.push(
        `Task ${n} has an ${check.type} ${label(kind)} whose min is not a positive whole number`
      )
    }
  }
  return errors
}

function validateGesture(check, ctx) {
  const { n, kind } = ctx
  const errors = validateCommon(check, ctx)
  if (!INPUT_GESTURES.includes(check.gesture)) {
    errors.push(
      `Task ${n} has an input_gesture ${label(kind)} with gesture "${check.gesture ?? ''}" — use one of: ${INPUT_GESTURES.join(', ')}`
    )
  }
  for (const field of ['targetKind', 'dropTargetKind']) {
    if (check[field] != null && !INPUT_TARGET_KINDS.includes(check[field])) {
      errors.push(
        `Task ${n} has an input_gesture ${label(kind)} with ${field} "${check[field]}" — use one of: ${INPUT_TARGET_KINDS.join(', ')}`
      )
    }
  }
  if (check.dropTargetKind != null && check.gesture !== 'drag') {
    errors.push(
      `Task ${n} has an input_gesture ${label(kind)} with a dropTargetKind but its gesture is not drag`
    )
  }
  return errors
}

function validateShortcut(check, ctx) {
  const { n, kind } = ctx
  const errors = validateCommon(check, ctx)
  const combo = normalizeCombo(check.combo)
  if (!combo) {
    errors.push(`Task ${n} has an input_shortcut ${label(kind)} but no combo (e.g. ctrl+c)`)
  } else if (isReservedCombo(combo)) {
    errors.push(
      `Task ${n} has an input_shortcut ${label(kind)} for "${check.combo}", which the browser keeps for itself — students can't perform it in a lesson (teach it with a quiz instead)`
    )
  } else if (!isShortcutCombo(combo)) {
    errors.push(
      `Task ${n} has an input_shortcut ${label(kind)} for "${check.combo}" — a shortcut needs ctrl/cmd or alt (or is F1–F12 or Delete)`
    )
  }
  if (check.via != null && !INPUT_SHORTCUT_VIA.includes(check.via)) {
    errors.push(
      `Task ${n} has an input_shortcut ${label(kind)} with via "${check.via}" — use one of: ${INPUT_SHORTCUT_VIA.join(', ')}`
    )
  }
  return errors
}

function validateModifier(check, ctx) {
  const { n, kind } = ctx
  const errors = validateCommon(check, ctx)
  if (!INPUT_MODIFIERS.includes(check.modifier)) {
    errors.push(
      `Task ${n} has an input_modifier ${label(kind)} with modifier "${check.modifier ?? ''}" — use one of: ${INPUT_MODIFIERS.join(', ')}`
    )
  }
  if (check.notCapsLock && check.modifier === 'caps_lock') {
    errors.push(
      `Task ${n} has an input_modifier ${label(kind)} that requires Caps Lock and forbids it (notCapsLock)`
    )
  }
  return errors
}

const VALIDATORS = {
  input_gesture: validateGesture,
  input_shortcut: validateShortcut,
  input_modifier: validateModifier,
}

// Check-type registry definitions (see src/modules/checkRegistry.js).
export const CHECKS = INPUT_CHECK_TYPES.map((type) => {
  const def = INPUT_CHECK_DEFINITIONS[type]
  return {
    type,
    owner: 'input',
    subject: def.subject,
    operators: def.operators,
    fields: def.fields,
    timing: def.evaluate,
    requiresRun: false,
    submitAllowed: false,
    contextKey: 'input',
    evaluate: (check, _output, context) => EVALUATORS[type](check, context?.input),
    validate: VALIDATORS[type],
  }
})

// Whether a task's completion or feedback checks use any input_* check, and the largest count
// they ask for (so a recorder can cap its summary there).
export function inputChecksOf(task) {
  const list = (value) => (Array.isArray(value) ? value : value ? [value] : [])
  return [...list(task?.check), ...list(task?.feedbackChecks ?? task?.incorrectChecks)].filter(
    isInputCheck
  )
}

export function inputSummaryCapFor(task) {
  return inputChecksOf(task).reduce((cap, check) => Math.max(cap, inputCheckMin(check)), 1)
}
