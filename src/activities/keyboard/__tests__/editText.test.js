// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  applyEditKey,
  editSolution,
  gradeEditItem,
  initialEditModel,
  keptShare,
  lcsLength,
} from '../editText.js'
import keyboard from '../definition.js'

const key = (k, mods = {}) => ({ key: k, mods })

function run(model, keys) {
  let used = []
  for (const k of keys) {
    const applied = applyEditKey(model, typeof k === 'string' ? key(k) : k)
    if (!applied) continue
    model = applied.model
    if (applied.used) used = [...new Set([...used, applied.used])]
  }
  return { ...model, used }
}

const typeText = (text) => [...text]

describe('edit_text model', () => {
  it('starts with the whole line original and the cursor at the end', () => {
    expect(initialEditModel({ start: 'teh' })).toEqual({
      text: 'teh',
      orig: '111',
      caret: 3,
      anchor: null,
    })
  })

  it('moves, deletes left and right, and inserts typed letters as new', () => {
    // "teh" → "the": left, Backspace the e... ; do it as: caret after "te", Backspace, End, type
    let m = run(initialEditModel({ start: 'teh' }), ['ArrowLeft', 'Backspace'])
    expect(m).toMatchObject({ text: 'th', orig: '11', caret: 1 })
    m = run(m, ['End', 'e'])
    expect(m).toMatchObject({ text: 'the', orig: '110', caret: 3 })
    m = run(m, ['Home', 'Delete'])
    expect(m).toMatchObject({ text: 'he', orig: '10', caret: 0 })
  })

  it('selects with Shift and replaces or deletes the selection', () => {
    let m = run(initialEditModel({ start: 'noon noon' }), [
      key('ArrowLeft', { shift: true }),
      key('ArrowLeft', { shift: true }),
      key('ArrowLeft', { shift: true }),
      key('ArrowLeft', { shift: true }),
      key('ArrowLeft', { shift: true }),
    ])
    expect(m).toMatchObject({ caret: 4, anchor: 9 })
    expect(m.used).toEqual(['select'])
    m = run(m, ['Backspace'])
    expect(m).toMatchObject({ text: 'noon', caret: 4, anchor: null })
    m = run({ ...m, anchor: 0 }, ['x'])
    expect(m).toMatchObject({ text: 'x', orig: '0' })
  })

  it('an arrow without Shift collapses a selection to its edge', () => {
    const m = run({ text: 'abcd', orig: '1111', caret: 3, anchor: 1 }, ['ArrowLeft'])
    expect(m).toMatchObject({ caret: 1, anchor: null })
  })

  it('Ctrl+A selects everything; unrelated keys are left to the browser', () => {
    const all = applyEditKey(initialEditModel({ start: 'abc' }), key('a', { mod: true }))
    expect(all.model).toMatchObject({ anchor: 0, caret: 3 })
    expect(all.used).toBe('select')
    expect(applyEditKey(initialEditModel({ start: 'abc' }), key('Tab'))).toBeNull()
    expect(applyEditKey(initialEditModel({ start: 'abc' }), key('v', { mod: true }))).toBeNull()
  })

  it('keeps Backspace at the start and Delete at the end harmless', () => {
    const start = { text: 'ab', orig: '11', caret: 0, anchor: null }
    expect(applyEditKey(start, key('Backspace')).model).toEqual(start)
    const end = { ...start, caret: 2 }
    expect(applyEditKey(end, key('Delete')).model).toEqual(end)
  })
})

describe('edit_text marking', () => {
  const item = {
    id: 'a',
    start: 'the rocket is redy to lanch',
    target: 'The rocket is ready to launch.',
  }
  const task = { mode: 'edit_text', items: [item] }

  it('measures kept characters against the longest common subsequence', () => {
    expect(lcsLength('noon noon', 'noon')).toBe(4)
    expect(lcsLength('', 'abc')).toBe(0)
    expect(keptShare({ start: 'abc', target: 'xyz' }, { orig: '000' })).toBe(1)
    expect(keptShare({ start: 'noon noon', target: 'noon' }, { orig: '1111' })).toBe(1)
  })

  it('passes an in-place edit and the solution state', () => {
    const edited = run(initialEditModel(item), [
      'Home',
      'Delete',
      'T',
      ...Array(15).fill('ArrowRight'),
      'a',
      ...Array(8).fill('ArrowRight'),
      'u',
      'End',
      '.',
    ])
    expect(edited.text).toBe(item.target)
    expect(gradeEditItem(task, item, edited)).toEqual({ correct: true, hint: null })
    expect(gradeEditItem(task, item, editSolution(item)).correct).toBe(true)
    expect(keyboard.grade(task, keyboard.solutionState(task)).passed).toBe(true)
  })

  it('fails a retyped line, with the retyped hint', () => {
    const retyped = run(initialEditModel(item), [key('a', { mod: true }), ...typeText(item.target)])
    expect(retyped.text).toBe(item.target)
    expect(gradeEditItem(task, item, retyped)).toEqual({
      correct: false,
      retyped: true,
      hint: 'You typed it all again. Try moving the cursor to the mistake with the arrow keys.',
    })
    // minKept can be lowered.
    expect(
      gradeEditItem({ ...task, minKept: 0.01 }, item, {
        ...retyped,
        orig: '1' + retyped.orig.slice(1),
      }).correct
    ).toBe(true)
  })

  it('asks for a required key that was not used', () => {
    const spaced = { id: 'b', start: 'Ada  says', target: 'Ada says', requireKeys: ['Delete'] }
    const withBackspace = run(initialEditModel(spaced), [
      ...Array(5).fill('ArrowLeft'),
      'Backspace',
    ])
    expect(withBackspace.text).toBe('Ada says')
    expect(gradeEditItem(task, spaced, withBackspace).hint).toBe(
      'Put the cursor just before the extra letter and press Delete. Backspace deletes to the left, Delete deletes to the right.'
    )
    const withDelete = run(initialEditModel(spaced), [...Array(6).fill('ArrowLeft'), 'Delete'])
    expect(gradeEditItem(task, spaced, withDelete).correct).toBe(true)
  })

  it('does not pass an unfinished line or one fixed on the on-screen keyboard', () => {
    expect(gradeEditItem(task, item, {}).hint).toBe('Keep going: make the line match exactly.')
    expect(gradeEditItem(task, item, { ...editSolution(item), source: 'virtual' }).correct).toBe(
      false
    )
  })

  it('counts retyped lines in the teacher summary', () => {
    const retyped = run(initialEditModel(item), [key('a', { mod: true }), ...typeText(item.target)])
    const state = { v: 1, items: { a: { ...retyped, done: true } } }
    expect(keyboard.summarize(task, state).text).toBe('0/1 done · 1 retyped')
  })
})

describe('edit_text validation', () => {
  const validate = (items, extra = {}) =>
    keyboard.validateTask({ mode: 'edit_text', items, ...extra }, { n: 3 }).errors

  it('accepts a valid task', () => {
    expect(
      validate([{ id: 'a', start: 'teh', target: 'the', requireKeys: ['Delete', 'select'] }])
    ).toEqual([])
  })

  it('reports each problem', () => {
    expect(validate([{ id: 'a', target: 'the' }])).toEqual(['Task 3 item 1: start is required.'])
    expect(validate([{ id: 'a', start: 'teh' }])).toEqual(['Task 3 item 1: target is required.'])
    expect(validate([{ id: 'a', start: 'x'.repeat(201), target: 'y' }])).toEqual([
      'Task 3 item 1: start must be at most 200 characters.',
    ])
    expect(validate([{ id: 'a', start: 'teh 😀', target: 'the' }])).toEqual([
      "Task 3 item 1: start has characters that can't be typed: 😀",
    ])
    expect(validate([{ id: 'a', start: 'the', target: 'the' }])).toEqual([
      'Task 3 item 1: start and target are the same, so there is nothing to fix.',
    ])
    expect(validate([{ id: 'a', start: 'teh', target: 'the', requireKeys: ['Space'] }])).toEqual([
      "Task 3 item 1: requireKeys has keys it can't check (Space). Use Backspace, Delete, ArrowLeft, ArrowRight, Home, End, select.",
    ])
    expect(validate([{ id: 'a', start: 'teh', target: 'the' }], { minKept: 90 })).toEqual([
      'Task 3: minKept must be a number above 0 and at most 1.',
    ])
    expect(validate([{ id: 'a', start: 'teh', target: 'the', requireKeys: 'Delete' }])).toEqual([
      'Task 3 item 1: requireKeys must be a list, such as [Delete] or [Backspace, select].',
    ])
  })
})
