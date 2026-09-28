import { describe, expect, it } from 'vitest'
import { normalizeKeyEvent, normalizePointerEvent } from '../events.js'
import { recognizeGestures } from '../gestures.js'
import {
  createInputTally,
  isShortcutCombo,
  mergeInputSummaries,
  summarizeTargetedInput,
} from '../targetSummary.js'
import {
  CHECKS,
  INPUT_CHECK_TYPES,
  evaluateInputGesture,
  evaluateInputModifier,
  evaluateInputShortcut,
  inputChecksOf,
  inputSummaryCapFor,
} from '../checks.js'
import { evaluateSingleCheck, getCheckDefinition } from '../../../modules/checks.js'
import { getModuleDefinition } from '../../../modules/definitions.js'

let clock = 0
const pointer = (type, extra = {}) =>
  normalizePointerEvent(
    {
      type,
      pointerType: extra.pointerType ?? 'mouse',
      button: extra.button ?? 0,
      clientX: extra.x ?? 0,
      clientY: extra.y ?? 0,
      targetId: extra.target ?? null,
      targetKind: extra.kind ?? null,
    },
    null,
    extra.t ?? (clock += 10)
  )
const key = (k, extra = {}) =>
  normalizeKeyEvent(
    {
      type: 'keydown',
      key: k,
      code: extra.code ?? (k.length === 1 ? `Key${k.toUpperCase()}` : k),
      shiftKey: extra.shift,
      ctrlKey: extra.ctrl,
      altKey: extra.alt,
      getModifierState: (name) => name === 'CapsLock' && !!extra.caps,
    },
    (clock += 10)
  )
const command = (combo, via = 'menu') => ({ t: (clock += 10), kind: 'command', combo, via })

const file = { target: '/notes.txt', kind: 'file' }
const folder = { target: '/Homework/', kind: 'folder' }

describe('semantic target kinds', () => {
  it('reads data-input-kind from the nearest data-input-id element', () => {
    const item = document.createElement('div')
    item.setAttribute('data-input-id', '/notes.txt')
    item.setAttribute('data-input-kind', 'file')
    const label = document.createElement('span')
    item.appendChild(label)
    const event = normalizePointerEvent({ type: 'dblclick', target: label })
    expect(event).toMatchObject({ targetId: '/notes.txt', targetKind: 'file' })
  })

  it('counts an HTML5 drag-and-drop (which cancels the pointer stream) as a drag', () => {
    const gestures = recognizeGestures([
      pointer('pointerdown', { ...file, x: 0, y: 0, t: 0 }),
      pointer('dragstart', { ...file, t: 20 }),
      pointer('pointercancel', { t: 21 }),
      pointer('drop', { ...folder, t: 300 }),
      pointer('dragend', { ...file, t: 301 }),
    ])
    expect(gestures).toEqual([
      {
        gesture: 'drag',
        targetId: '/notes.txt',
        targetKind: 'file',
        toTargetId: '/Homework/',
        toTargetKind: 'folder',
        at: 300,
      },
    ])
  })

  it('counts a drag dropped outside any drop zone once, on dragend', () => {
    const gestures = recognizeGestures([
      pointer('dragstart', { ...file, t: 0 }),
      pointer('dragend', { ...file, t: 100 }),
    ])
    expect(gestures.map((g) => [g.gesture, g.toTargetId])).toEqual([['drag', null]])
  })
})

describe('summarizeTargetedInput', () => {
  it('counts gestures per target kind, and double-clicking a file', () => {
    const summary = summarizeTargetedInput([
      pointer('click', file),
      pointer('click', file),
      pointer('dblclick', file),
      pointer('dblclick', folder),
      pointer('contextmenu', { ...file, button: 2 }),
    ])
    expect(summary.gestures).toEqual({
      click: { any: 2, file: 2 },
      double_click: { any: 2, file: 1, folder: 1 },
      right_click: { any: 1, file: 1 },
    })
  })

  it('records a file dragged onto a folder as a drop', () => {
    const summary = summarizeTargetedInput([
      pointer('dragstart', file),
      pointer('drop', folder),
      pointer('dragend', file),
    ])
    expect(summary.gestures.drag).toEqual({ any: 1, file: 1 })
    expect(summary.drops).toEqual({ 'any>folder': 1, 'file>folder': 1 })
  })

  it('tells Ctrl+C / Ctrl+V from the context-menu Copy / Paste', () => {
    const keyboard = summarizeTargetedInput([
      key('Control', { ctrl: true }),
      key('c', { ctrl: true }),
      key('v', { ctrl: true }),
    ])
    expect(keyboard.shortcuts).toEqual({ 'mod+c': { keyboard: 1 }, 'mod+v': { keyboard: 1 } })
    const menu = summarizeTargetedInput([command('mod+c'), command('mod+v')])
    expect(menu.shortcuts).toEqual({ 'mod+c': { menu: 1 }, 'mod+v': { menu: 1 } })
  })

  it('counts Shift and Caps Lock capitals but not plain typing as shortcuts', () => {
    const summary = summarizeTargetedInput([
      key('H', { shift: true }),
      key('i'),
      key('B', { caps: true }),
      key('F2', { code: 'F2' }),
      key('Enter', { code: 'Enter' }),
    ])
    expect(summary).toMatchObject({ shiftCapitals: 1, capsLockCapitals: 1 })
    expect(summary.shortcuts).toEqual({ f2: { keyboard: 1 } })
  })

  it('caps every count so the summary stops changing', () => {
    const clicks = Array.from({ length: 20 }, () => pointer('click', file))
    expect(summarizeTargetedInput(clicks, { cap: 3 }).gestures.click).toEqual({ any: 3, file: 3 })
    const merged = mergeInputSummaries(
      { gestures: { click: { any: 2 } }, shiftCapitals: 2 },
      { gestures: { click: { any: 2 } }, shiftCapitals: 2 },
      { cap: 3 }
    )
    expect(merged).toMatchObject({ gestures: { click: { any: 3 } }, shiftCapitals: 3 })
  })

  it('treats ctrl/alt combos, F-keys and Delete as shortcuts', () => {
    expect(isShortcutCombo('mod+c')).toBe(true)
    expect(isShortcutCombo('alt+f4')).toBe(true)
    expect(isShortcutCombo('delete')).toBe(true)
    expect(isShortcutCombo('f12')).toBe(true)
    expect(isShortcutCombo('shift+a')).toBe(false)
    expect(isShortcutCombo('enter')).toBe(false)
  })
})

describe('createInputTally', () => {
  it('keeps gestures after the raw buffer rolls over', () => {
    const tally = createInputTally({ maxEvents: 5 })
    tally.record(pointer('dblclick', file))
    for (let i = 0; i < 30; i += 1) tally.record(key('a'))
    expect(tally.summary().gestures.double_click).toEqual({ any: 1, file: 1 })
  })

  it('does not split a drag in progress, and measures a hover across commits', () => {
    const tally = createInputTally()
    tally.record(pointer('pointerdown', { ...file, x: 0, y: 0, t: 1000 }))
    tally.record(pointer('pointermove', { x: 40, y: 0, t: 1010 }))
    tally.record(key('a', {}))
    tally.record(pointer('pointerup', { ...folder, x: 80, y: 0, t: 1020 }))
    expect(tally.summary().drops).toEqual({ 'any>folder': 1, 'file>folder': 1 })

    tally.record(pointer('pointerenter', { target: 'icon:paint', kind: 'icon', t: 2000 }))
    tally.record(pointer('click', { target: 'x', t: 2100 }))
    tally.record(pointer('pointerleave', { target: 'icon:paint', kind: 'icon', t: 3000 }))
    expect(tally.summary().gestures.hover).toEqual({ any: 1, icon: 1 })
  })

  it('reset() forgets everything', () => {
    const tally = createInputTally()
    tally.record(pointer('dblclick', file))
    tally.reset()
    expect(tally.summary().gestures).toEqual({})
  })
})

describe('input check evaluation', () => {
  const input = {
    gestures: {
      double_click: { any: 1, file: 1 },
      double_tap: { any: 1, folder: 1 },
      drag: { any: 2, file: 2 },
    },
    drops: { 'any>folder': 1, 'file>folder': 1 },
    shortcuts: { 'mod+c': { keyboard: 1 }, 'mod+v': { menu: 1 } },
    shiftCapitals: 2,
    capsLockCapitals: 0,
  }

  it('input_gesture: gesture, target kind, drop target, min and touch equivalents', () => {
    expect(evaluateInputGesture({ gesture: 'double_click' }, input)).toBe(true)
    expect(evaluateInputGesture({ gesture: 'double_click', targetKind: 'file' }, input)).toBe(true)
    expect(evaluateInputGesture({ gesture: 'double_click', targetKind: 'window' }, input)).toBe(
      false
    )
    // A double-tap on a folder counts as a double-click unless strict.
    expect(evaluateInputGesture({ gesture: 'double_click', targetKind: 'folder' }, input)).toBe(
      true
    )
    expect(
      evaluateInputGesture({ gesture: 'double_click', targetKind: 'folder', strict: true }, input)
    ).toBe(false)
    expect(evaluateInputGesture({ gesture: 'double_click', min: 2 }, input)).toBe(true)
    expect(evaluateInputGesture({ gesture: 'double_click', min: 3 }, input)).toBe(false)
    expect(
      evaluateInputGesture({ gesture: 'drag', targetKind: 'file', dropTargetKind: 'folder' }, input)
    ).toBe(true)
    expect(
      evaluateInputGesture(
        { gesture: 'drag', targetKind: 'folder', dropTargetKind: 'folder' },
        input
      )
    ).toBe(false)
    expect(evaluateInputGesture({ gesture: 'right_click' }, input)).toBe(false)
    expect(evaluateInputGesture({ gesture: 'double_click' }, null)).toBe(false)
  })

  it('input_shortcut: keyboard, menu or either', () => {
    expect(evaluateInputShortcut({ combo: 'ctrl+c' }, input)).toBe(true)
    expect(evaluateInputShortcut({ combo: 'Ctrl+V' }, input)).toBe(false)
    expect(evaluateInputShortcut({ combo: 'ctrl+v', via: 'menu' }, input)).toBe(true)
    expect(evaluateInputShortcut({ combo: 'cmd+v', via: 'any' }, input)).toBe(true)
    expect(evaluateInputShortcut({ combo: 'ctrl+x', via: 'any' }, input)).toBe(false)
  })

  it('input_modifier: Shift capitals, optionally without Caps Lock', () => {
    expect(evaluateInputModifier({ modifier: 'shift', notCapsLock: true }, input)).toBe(true)
    expect(
      evaluateInputModifier(
        { modifier: 'shift', notCapsLock: true },
        { ...input, capsLockCapitals: 1 }
      )
    ).toBe(false)
    expect(evaluateInputModifier({ modifier: 'shift', min: 3 }, input)).toBe(false)
    expect(evaluateInputModifier({ modifier: 'caps_lock' }, input)).toBe(false)
  })

  it('dispatches through the shared check registry against ctx.input', () => {
    expect(getCheckDefinition('input_gesture').owner).toBe('input')
    expect(
      evaluateSingleCheck({ type: 'input_gesture', gesture: 'double_click' }, '', { input })
    ).toBe(true)
    expect(evaluateSingleCheck({ type: 'input_gesture', gesture: 'double_click' }, '', {})).toBe(
      false
    )
    expect(CHECKS.map((def) => def.type)).toEqual(INPUT_CHECK_TYPES)
  })

  it('finds a task’s input checks and the largest min they need', () => {
    const task = {
      check: [
        { type: 'fs_path', operator: 'exists', path: '/a/' },
        { type: 'input_gesture', gesture: 'drag', min: 2 },
      ],
      feedbackChecks: [{ type: 'input_shortcut', combo: 'ctrl+c', min: 4 }],
    }
    expect(inputChecksOf(task)).toHaveLength(2)
    expect(inputSummaryCapFor(task)).toBe(4)
    expect(inputSummaryCapFor({ check: { type: 'fs_path' } })).toBe(1)
  })
})

describe('input check validation', () => {
  const desktop = getModuleDefinition('desktop')
  const python = getModuleDefinition('python')
  const validate = (check, moduleDefinition = desktop) =>
    getCheckDefinition(check.type).validate(check, { n: 1, kind: 'completion', moduleDefinition })

  it('accepts well-formed checks on Desktop', () => {
    expect(
      validate({ type: 'input_gesture', gesture: 'double_click', targetKind: 'file' })
    ).toEqual([])
    expect(
      validate({
        type: 'input_gesture',
        gesture: 'drag',
        targetKind: 'file',
        dropTargetKind: 'folder',
      })
    ).toEqual([])
    expect(validate({ type: 'input_shortcut', combo: 'ctrl+c', via: 'any' })).toEqual([])
    expect(validate({ type: 'input_shortcut', combo: 'F2' })).toEqual([])
    expect(validate({ type: 'input_modifier', modifier: 'shift', notCapsLock: true })).toEqual([])
  })

  it('rejects modules that do not record input', () => {
    expect(validate({ type: 'input_gesture', gesture: 'click' }, python)).toEqual([
      "Task 1 has an input_gesture check, but Python tasks don't record input — input checks work in Desktop tasks",
    ])
  })

  it('explains bad gestures, kinds, reserved combos and min', () => {
    expect(validate({ type: 'input_gesture', gesture: 'wiggle' })[0]).toMatch(
      /gesture "wiggle" — use one of: click, double_click/
    )
    expect(validate({ type: 'input_gesture', gesture: 'click', targetKind: 'desk' })[0]).toMatch(
      /targetKind "desk"/
    )
    expect(
      validate({ type: 'input_gesture', gesture: 'click', dropTargetKind: 'folder' })
    ).toContain(
      'Task 1 has an input_gesture check with a dropTargetKind but its gesture is not drag'
    )
    expect(validate({ type: 'input_shortcut', combo: 'ctrl+w' })[0]).toMatch(
      /which the browser keeps for itself/
    )
    expect(validate({ type: 'input_shortcut', combo: '' })).toContain(
      'Task 1 has an input_shortcut check but no combo (e.g. ctrl+c)'
    )
    expect(validate({ type: 'input_shortcut', combo: 'shift+a' })[0]).toMatch(/needs ctrl\/cmd/)
    expect(validate({ type: 'input_shortcut', combo: 'ctrl+c', via: 'mouse' })[0]).toMatch(
      /via "mouse"/
    )
    expect(validate({ type: 'input_modifier', modifier: 'ctrl' })[0]).toMatch(/modifier "ctrl"/)
    expect(
      validate({ type: 'input_modifier', modifier: 'caps_lock', notCapsLock: true })
    ).toContain(
      'Task 1 has an input_modifier check that requires Caps Lock and forbids it (notCapsLock)'
    )
    expect(validate({ type: 'input_gesture', gesture: 'click', min: 0 })).toContain(
      'Task 1 has an input_gesture check whose min is not a positive whole number'
    )
  })
})
