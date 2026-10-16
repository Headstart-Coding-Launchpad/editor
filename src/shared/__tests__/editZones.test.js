// Edit zones (P6-30): `#@lock-first` / `#@lock-last` fenced locks, `#@slot` one-line slots and
// `puzzle.noNewLines` — the markers (lineHints.js), their anchoring (lockedLines.js) and the
// editor guard (lockedLinesEditor.js), driven through an EditorState as the locked-lines tests
// are. The tags, the outline and the note tooltip need a real browser check.
import { describe, expect, it } from 'vitest'
import { EditorState } from '@codemirror/state'
import { parseLineHints, stripTaskLineHints } from '../lineHints.js'
import {
  anchorSlots,
  chooseZones,
  getTaskLockSets,
  lockFenceOfMarkerLine,
  slotMarkerSize,
} from '../lockedLines.js'
import { lockedLinesExtension, setLockedLineSets, zoneViolation } from '../lockedLinesEditor.js'

const ROBOT = [
  '#@lock-first',
  'from stage import *',
  '#@lock',
  'robot = {"body": "steelblue"}',
  '#> Add the antenna here',
  '#@slot',
  '',
  '#@lock-last',
  'draw(robot)',
  '',
].join('\n')

function robotTask(puzzle = { noNewLines: true }) {
  return stripTaskLineHints(
    { id: 1, puzzle, codeStages: [{ role: 'starter', code: ROBOT }] },
    'python'
  )
}

// A stripped task's starter in an editor with its zones.
function zonedState(task = robotTask()) {
  const doc = task.codeStages?.[0]?.code ?? task.starterCode
  const state = EditorState.create({ doc, extensions: [lockedLinesExtension()] })
  return state.update({ effects: setLockedLineSets.of(getTaskLockSets(task)) }).state
}

const edit = (state, changes, userEvent = 'input.type') =>
  state.update({ changes, userEvent }).state

// The stripped robot starter: 'from stage import *', 'robot = {...}', '' (the slot),
// 'draw(robot)', ''.
const lineFrom = (state, n) => state.doc.line(n).from

describe('edit zone markers', () => {
  it('reads #@lock-first / #@lock-last and #@slot [n] in Python syntax only', () => {
    expect(lockFenceOfMarkerLine('  #@lock-last', 'python')).toBe('last')
    expect(lockFenceOfMarkerLine('#@lock-first  keep', 'python')).toBe('first')
    expect(lockFenceOfMarkerLine('#@lock', 'python')).toBeNull()
    expect(lockFenceOfMarkerLine('#@lock-last', 'html')).toBeNull()
    expect(slotMarkerSize('#@slot', 'python')).toBe(1)
    expect(slotMarkerSize('#@slot 2', 'python')).toBe(2)
    expect(slotMarkerSize('#@slot 99', 'python')).toBe(5)
    expect(slotMarkerSize('#@slots', 'python')).toBeNull()
  })

  it('strips the markers and records fences and slots', () => {
    const parsed = parseLineHints(ROBOT, 'python')
    expect(parsed.code).toBe('from stage import *\nrobot = {"body": "steelblue"}\n\ndraw(robot)\n')
    expect(parsed.locks).toEqual([
      { line: 1, target: 'from stage import *', fence: 'first' },
      { line: 2, target: 'robot = {"body": "steelblue"}' },
      { line: 4, target: 'draw(robot)', fence: 'last' },
      { line: 3, slot: 1, after: 'robot = {"body": "steelblue"}', before: 'draw(robot)' },
    ])
    expect(parsed.hints).toEqual([{ line: 3, text: 'Add the antenna here', target: '' }])
  })

  it('a trailing #@slot gets a new empty last line', () => {
    const parsed = parseLineHints('x = 1\n#@slot', 'python')
    expect(parsed.code).toBe('x = 1\n')
    expect(parsed.locks).toEqual([{ line: 2, slot: 1, after: 'x = 1', before: null }])
  })

  it('puzzle.noNewLines adds its rule to the lock sets, once', () => {
    const task = robotTask()
    expect(getTaskLockSets(task)[0].at(-1)).toEqual({ noNewLines: true })
    expect(stripTaskLineHints(task, 'python')).toBe(task)
    const plain = stripTaskLineHints(
      { id: 2, puzzle: { noNewLines: true }, starterCode: 'x = 1' },
      'python'
    )
    expect(getTaskLockSets(plain)).toEqual([[{ noNewLines: true }]])
    const html = stripTaskLineHints({ id: 3, puzzle: { noNewLines: true } }, 'html')
    expect(html.lockSets).toBeUndefined()
  })

  it('re-anchors a slot on the student code by the line before it', () => {
    const entries = [{ line: 3, slot: 1, after: 'b', before: 'd' }]
    expect(anchorSlots(['a', 'b', 'typed', 'd'], entries)).toEqual([{ line: 3, size: 1, lines: 1 }])
    // Lines added above: found by the line before it.
    expect(anchorSlots(['a', 'new', 'b', 'typed', 'd'], entries)).toEqual([
      { line: 4, size: 1, lines: 1 },
    ])
    expect(anchorSlots(['a', 'b', 'one', 'two', 'd'], [{ ...entries[0], slot: 2 }])).toEqual([
      { line: 3, size: 2, lines: 2 },
    ])
    const zones = chooseZones('a\nb\nx\nd', [[...entries, { noNewLines: true }]])
    expect(zones.slots).toEqual([{ line: 3, size: 1, lines: 1 }])
    expect(zones.noNewLines).toBe(true)
  })
})

describe('edit zones in the editor', () => {
  it('types one line in the slot', () => {
    const state = zonedState()
    const after = edit(state, { from: lineFrom(state, 3), insert: 'robot["antenna"] = "red"' })
    expect(after.doc.line(3).text).toBe('robot["antenna"] = "red"')
  })

  it('Enter in a one-line slot does nothing', () => {
    const state = zonedState()
    const typed = edit(state, { from: lineFrom(state, 3), insert: 'x = 1' })
    const after = edit(typed, { from: typed.doc.line(3).to, insert: '\n' }, 'input')
    expect(after.doc.toString()).toBe(typed.doc.toString())
  })

  it('refuses a multi-line paste into a slot', () => {
    const state = zonedState()
    const after = edit(state, { from: lineFrom(state, 3), insert: 'a = 1\nb = 2' }, 'input.paste')
    expect(after.doc.toString()).toBe(state.doc.toString())
  })

  it('a two-line slot takes two lines, not three', () => {
    const task = stripTaskLineHints(
      { id: 1, starterCode: '#@lock\nx = 1\n#@slot 2\n\n#@lock\nshow(x)' },
      'python'
    )
    const state = zonedState(task)
    const two = edit(state, { from: lineFrom(state, 2), insert: 'a\nb' }, 'input.paste')
    expect(two.doc.toString()).toBe('x = 1\na\nb\nshow(x)')
    const three = edit(two, { from: two.doc.line(3).to, insert: '\nc' }, 'input')
    expect(three.doc.toString()).toBe(two.doc.toString())
  })

  it('Backspace can not join the slot onto the line above', () => {
    const state = zonedState()
    const slot = lineFrom(state, 3)
    const after = edit(state, { from: slot - 1, to: slot }, 'delete.backward')
    expect(after.doc.toString()).toBe(state.doc.toString())
  })

  it('typing below a last-locked line moves it above the line', () => {
    const state = zonedState(robotTask({}))
    const after = edit(state, { from: state.doc.length, insert: 'robot["legs"] = 2' })
    expect(after.doc.toString()).toBe(
      'from stage import *\nrobot = {"body": "steelblue"}\n\nrobot["legs"] = 2\ndraw(robot)\n'
    )
    expect(after.selection.main.head).toBe(after.doc.line(4).to)
  })

  it('a new line below a last-locked line is refused under noNewLines', () => {
    const state = zonedState()
    const after = edit(state, { from: state.doc.length, insert: '\n' }, 'input')
    expect(after.doc.toString()).toBe(state.doc.toString())
  })

  it('typing above a first-locked line moves it below the line', () => {
    const state = zonedState(robotTask({}))
    const after = edit(state, { from: 0, insert: 'import math\n' }, 'input.paste')
    expect(after.doc.line(1).text).toBe('from stage import *')
    expect(after.doc.line(2).text).toBe('import math')
  })

  it('noNewLines refuses a new line outside the slots', () => {
    const state = zonedState()
    const at = state.doc.line(3).to
    expect(zoneViolation(state, state.changes({ from: at, insert: 'x\ny' }))).toMatchObject({
      kind: 'slot',
    })
    const plain = stripTaskLineHints(
      { id: 1, puzzle: { noNewLines: true }, starterCode: 'a = 1\nb = 2' },
      'python'
    )
    const s2 = zonedState(plain)
    expect(zoneViolation(s2, s2.changes({ from: 5, insert: '\nc = 3' }))).toMatchObject({
      kind: 'noNewLines',
    })
    expect(zoneViolation(s2, s2.changes({ from: 4, to: 5, insert: '9' }))).toBeNull()
  })

  it('a change from outside (Reset, a saved-code load) is never guarded', () => {
    const state = zonedState()
    const after = state.update({ changes: { from: state.doc.length, insert: 'more\n' } }).state
    expect(after.doc.toString().endsWith('more\n')).toBe(true)
  })
})
