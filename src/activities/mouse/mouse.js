// Pure logic for the Mouse activity: a stage of positioned targets and a list of actions
// (click, double-click, right-click, drag, scroll, hover). The student view recognises gestures
// with src/shared/input and stores, per item, which gesture completed it. Node-safe.

import { TOUCH_EQUIVALENTS, gestureSatisfies } from '../../shared/input/index.js'

export const MOUSE_ACTIONS = ['click', 'double_click', 'right_click', 'drag', 'scroll', 'hover']
export const TARGET_SIZES = ['large', 'medium', 'small']
// On a touch screen: accept the touch equivalent, skip items with no equivalent (hover), or
// block the activity with a "needs a mouse" notice.
export const TOUCH_POLICIES = ['equivalent', 'skip', 'block']

const ACTION_WORDS = {
  click: 'Click',
  double_click: 'Double-click',
  right_click: 'Right-click',
  drag: 'Drag',
  scroll: 'Scroll to',
  hover: 'Hover over',
}

const inUnitRange = (value) => typeof value === 'number' && value >= 0 && value <= 1

export function validateMouseTask(task, n) {
  const errors = []
  const warnings = []
  const where = `Task ${n}`
  const targets = Array.isArray(task?.targets) ? task.targets : []
  const targetIds = new Set()
  if (targets.length === 0) errors.push(`${where}: mouse task needs at least one target.`)
  targets.forEach((target, i) => {
    const label = `${where} target ${i + 1}`
    if (!target?.id) errors.push(`${label}: needs an id.`)
    else if (targetIds.has(target.id))
      errors.push(`${label}: id "${target.id}" is used more than once.`)
    targetIds.add(target?.id)
    if (!inUnitRange(target?.x) || !inUnitRange(target?.y)) {
      errors.push(`${label}: x and y must be between 0 and 1 (fractions of the stage).`)
    }
    if (target?.size != null && !TARGET_SIZES.includes(target.size)) {
      errors.push(`${label}: size must be one of ${TARGET_SIZES.join(', ')}.`)
    }
  })
  if (task?.touch != null && !TOUCH_POLICIES.includes(task.touch)) {
    errors.push(`${where}: touch must be one of ${TOUCH_POLICIES.join(', ')}.`)
  }
  const items = Array.isArray(task?.items) ? task.items : []
  if (items.length === 0) errors.push(`${where}: mouse task needs at least one item.`)
  const itemIds = new Set()
  items.forEach((item, i) => {
    const label = `${where} item ${i + 1}`
    if (!item?.id) errors.push(`${label}: needs an id.`)
    else if (itemIds.has(item.id)) errors.push(`${label}: id "${item.id}" is used more than once.`)
    itemIds.add(item?.id)
    if (!MOUSE_ACTIONS.includes(item?.action)) {
      errors.push(`${label}: action must be one of ${MOUSE_ACTIONS.join(', ')}.`)
      return
    }
    if (!targetIds.has(item.target))
      errors.push(`${label}: target "${item.target ?? ''}" is not on the stage.`)
    if (item.action === 'drag' && !targetIds.has(item.to)) {
      errors.push(`${label}: a drag needs a "to" target that is on the stage.`)
    }
    if (item.action === 'hover' && (task.touch ?? 'equivalent') === 'equivalent') {
      warnings.push(
        `${label}: touch screens can't hover, so this item is skipped on touch devices.`
      )
    }
  })
  return { errors, warnings }
}

export function describeMouseItem(task, item) {
  const name = (id) => task?.targets?.find((t) => t.id === id)?.label ?? id
  const verb = ACTION_WORDS[item.action] ?? item.action
  return item.action === 'drag'
    ? `${verb} the ${name(item.target)} to the ${name(item.to)}`
    : `${verb} the ${name(item.target)}`
}

// Items that apply on this device: on touch screens, hover has no equivalent and is skipped
// unless the task blocks touch devices altogether.
export function activeMouseItems(task, { touch = false } = {}) {
  const items = task?.items ?? []
  if (!touch || (task.touch ?? 'equivalent') === 'block') return items
  return items.filter((item) => TOUCH_EQUIVALENTS[item.action] != null)
}

// result: { via } — the gesture that completed the item (e.g. 'double_tap').
export function gradeMouseItem(task, item, result = {}) {
  if (!result.via) return { correct: false, hint: `${describeMouseItem(task, item)}.` }
  const allowTouch = (task.touch ?? 'equivalent') !== 'block'
  if (gestureSatisfies(item.action, result.via, { allowTouchEquivalent: allowTouch })) {
    return { correct: true, hint: null }
  }
  return {
    correct: false,
    hint: `That was a ${result.via.replace('_', ' ')}. ${describeMouseItem(task, item)}.`,
  }
}

export function gradeMouseTask(task, state = {}, device = {}) {
  const items = activeMouseItems(task, device)
  const results = items.map((item) => gradeMouseItem(task, item, state.items?.[item.id]))
  const correct = results.filter((r) => r.correct).length
  return {
    total: items.length,
    correct,
    done: items.length > 0 && correct === items.length,
    hint: results.find((r) => !r.correct)?.hint ?? null,
  }
}
