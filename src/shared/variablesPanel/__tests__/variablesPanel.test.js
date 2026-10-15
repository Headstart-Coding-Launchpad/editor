// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  getPredictRunLock,
  PREDICT_RUN_LOCK_MESSAGE,
  MAX_CHANGED_ITEMS,
  buildVariablesRun,
  changedItemKeys,
  changedItemSet,
  changedNames,
  compactVariablesForSync,
  currentSnapshot,
  describeVariable,
  formatValue,
  getShowVariables,
  readSyncedVariables,
  typeLabel,
  variableCaptureOptions,
  visibleVars,
  visualOptions,
} from '../variablesPanel.js'

const str = (v) => ({ t: 'str', v })
const int = (v) => ({ t: 'int', v })
const list = (items) => ({ t: 'list', items, len: items.length })
const snap = (entries) => ({ vars: entries.map(([n, v]) => ({ n, v })), scope: null })

describe('getShowVariables', () => {
  it('is off unless the task sets an object', () => {
    expect(getShowVariables({})).toBeNull()
    expect(getShowVariables({ showVariables: true })).toBeNull()
    expect(getShowVariables({ showVariables: ['x'] })).toBeNull()
  })

  it('defaults to view at the end and keeps mode-specific fields only in their mode', () => {
    expect(getShowVariables({ showVariables: {} })).toEqual({
      mode: 'view',
      at: 'end',
      hide: [],
      predict: [],
      target: {},
      visuals: true,
      stageLists: 'size',
      lockRun: false,
    })
    expect(
      getShowVariables({
        showVariables: { mode: 'predict', at: 'marker', predict: ['a', ' a ', 'b'], hide: ['x'] },
      })
    ).toEqual({
      mode: 'predict',
      at: 'marker',
      hide: ['x'],
      predict: ['a', 'b'],
      target: {},
      visuals: true,
      stageLists: 'size',
      lockRun: true,
    })
    expect(
      getShowVariables({ showVariables: { mode: 'view', predict: ['a'], target: { a: 1 } } })
    ).toMatchObject({ predict: [], target: {} })
    expect(
      getShowVariables({ showVariables: { mode: 'target', target: { a: 1 } } }).target
    ).toEqual({ a: 1 })
  })

  it('reads visuals (off only when false) and stageLists (size unless a known option)', () => {
    expect(getShowVariables({ showVariables: { visuals: false } }).visuals).toBe(false)
    expect(getShowVariables({ showVariables: { visuals: 'no' } }).visuals).toBe(true)
    expect(getShowVariables({ showVariables: { stageLists: 'picture' } }).stageLists).toBe(
      'picture'
    )
    expect(getShowVariables({ showVariables: { stageLists: 'tiles' } }).stageLists).toBe('tiles')
    expect(getShowVariables({ showVariables: { stageLists: 'huge' } }).stageLists).toBe('size')
    expect(visualOptions({ visuals: false, stageLists: 'tiles' })).toEqual({
      visuals: false,
      stageLists: 'tiles',
    })
    expect(visualOptions(undefined)).toEqual({ visuals: true, stageLists: 'size' })
  })
})

describe('per-item change marks', () => {
  it('keys changed list items by index, counting new items', () => {
    expect(changedItemKeys(list([int(1), int(2)]), list([int(1), int(3), int(4)]))).toEqual([
      '1',
      '2',
    ])
    expect(changedItemKeys(list([str('red')]), list([str('red')]))).toEqual([])
  })

  it('keys 2D cells as row,col, including every cell of a new row', () => {
    const before = list([list([str('red'), str('red')])])
    const after = list([list([str('red'), str('blue')]), list([str('x'), str('y')])])
    expect(changedItemKeys(before, after)).toEqual(['0,1', '1,0', '1,1'])
  })

  it('keys dict entries by their key as Python text', () => {
    const dict = (entries) => ({
      t: 'dict',
      len: entries.length,
      items: entries.map(([k, v]) => ({ k: str(k), v })),
    })
    expect(
      changedItemKeys(
        dict([['a', int(1)]]),
        dict([
          ['a', int(2)],
          ['b', int(2)],
        ])
      )
    ).toEqual(['k:"a"', 'k:"b"'])
  })

  it('marks nothing item by item when the kind changed or a side is missing', () => {
    expect(changedItemKeys(int(1), list([int(1)]))).toEqual([])
    expect(changedItemKeys(null, list([int(1)]))).toEqual([])
  })

  it('keeps at most MAX_CHANGED_ITEMS keys', () => {
    const many = (value) => list(Array.from({ length: MAX_CHANGED_ITEMS + 50 }, () => int(value)))
    expect(changedItemKeys(many(1), many(2))).toHaveLength(MAX_CHANGED_ITEMS)
  })

  it('puts the marks in the run state and carries them to the tutor', () => {
    const config = { at: 'end' }
    const first = buildVariablesRun({
      taskId: 1,
      capture: { end: snap([['palette', list([str('red'), str('blue')])]]) },
      config,
    })
    expect(first.changedItems).toEqual({})
    const second = buildVariablesRun({
      taskId: 1,
      capture: { end: snap([['palette', list([str('red'), str('green')])]]) },
      config,
      previous: first,
    })
    expect(second.changed).toEqual(['palette'])
    expect(second.changedItems).toEqual({ palette: ['1'] })
    expect(changedItemSet(second, 'palette').has('1')).toBe(true)
    expect(changedItemSet(second, 'other').size).toBe(0)
    const back = readSyncedVariables(compactVariablesForSync(second, null))
    expect(back.run.changedItems).toEqual({ palette: ['1'] })
    expect(readSyncedVariables({ taskId: 1, ran: true }).run.changedItems).toEqual({})
  })
})

describe('variableCaptureOptions', () => {
  const task = {
    id: 1,
    showVariables: { mode: 'view', at: 'marker', hide: ['secret'] },
    peekSets: [
      { source: 'starter', stageIndex: 0, file: null, peek: { line: 2, target: 'y = 2' } },
    ],
  }

  it('is null without a panel', () => {
    expect(variableCaptureOptions({ id: 1 }, 'x = 1')).toBeNull()
  })

  it('sends the re-anchored peek line, moved by the runtime offset', () => {
    expect(variableCaptureOptions(task, 'x = 1\ny = 2')).toEqual({
      panel: true,
      peekLine: 2,
      hide: ['secret'],
    })
    expect(variableCaptureOptions(task, 'x = 1\nz = 0\ny = 2', { lineOffset: 2 }).peekLine).toBe(5)
    expect(variableCaptureOptions(task, 'x = 1').peekLine).toBeNull()
    expect(
      variableCaptureOptions({ ...task, showVariables: { at: 'end' } }, 'x = 1\ny = 2').peekLine
    ).toBeNull()
  })
})

describe('type labels and formatting', () => {
  it('labels each kind', () => {
    expect(typeLabel(str('a'))).toBe('text')
    expect(typeLabel(int(1))).toBe('number')
    expect(typeLabel({ t: 'float', v: 1.5, r: '1.5' })).toBe('number')
    expect(typeLabel({ t: 'bool', v: true })).toBe('true/false')
    expect(typeLabel({ t: 'none' })).toBe('None')
    expect(typeLabel(list([]))).toBe('list')
    expect(typeLabel({ t: 'dict', items: [], len: 0 })).toBe('dict')
    expect(typeLabel({ t: 'obj', type: 'Turtle', r: '<Turtle>' })).toBe('Turtle')
  })

  it('shows quotes on text, Python spellings and float reprs', () => {
    expect(formatValue(str('5'))).toBe('"5"')
    expect(formatValue(int(5))).toBe('5')
    expect(formatValue({ t: 'float', v: 5, r: '5.0' })).toBe('5.0')
    expect(formatValue({ t: 'bool', v: false })).toBe('False')
    expect(formatValue({ t: 'none' })).toBe('None')
    expect(formatValue(str('say "hi"\n'))).toBe('"say \\"hi\\"\\n"')
    expect(formatValue({ t: 'str', v: 'abc', more: 10 })).toBe('"abc"…')
  })

  it('formats collections, single tuples, empty sets and unread items', () => {
    expect(formatValue(list([str('key'), str('map')]))).toBe('["key", "map"]')
    expect(formatValue({ t: 'tuple', items: [int(1)], len: 1 })).toBe('(1,)')
    expect(formatValue({ t: 'set', items: [], len: 0 })).toBe('set()')
    expect(formatValue({ t: 'dict', items: [{ k: str('a'), v: int(1) }], len: 1 })).toBe('{"a": 1}')
    expect(formatValue({ t: 'list', items: [int(1)], len: 3 })).toBe('[1, …]')
    expect(formatValue({ t: 'list', len: 4, cut: true })).toBe('[…]')
  })

  it('cuts long text with an ellipsis', () => {
    expect(formatValue(str('abcdefghij'), { maxChars: 6 })).toBe('"abcd…')
  })

  it('describes a tag for screen readers', () => {
    expect(describeVariable('score', int(10))).toBe('score: number 10')
    expect(describeVariable('name', str('Sam'))).toBe('name: text "Sam"')
    expect(describeVariable('bag', list([str('key')]))).toBe('bag: list of 1 item, ["key"]')
  })
})

describe('snapshots and runs', () => {
  it('drops hidden, dunder and internal names', () => {
    const snapshot = snap([
      ['a', int(1)],
      ['__x__', int(2)],
      ['_hs_tmp', int(3)],
      ['secret', int(4)],
    ])
    expect(visibleVars(snapshot, ['secret']).map((entry) => entry.n)).toEqual(['a'])
  })

  it('marks changed and new names against the previous run', () => {
    const before = snap([
      ['a', int(1)],
      ['b', str('x')],
    ])
    const after = snap([
      ['a', int(1)],
      ['b', str('y')],
      ['c', int(0)],
    ])
    expect(changedNames(before, after)).toEqual(['b', 'c'])
    expect(changedNames(null, after)).toEqual([])
  })

  it('shows the peek snapshot when it was reached, else the end', () => {
    const capture = {
      end: snap([['a', int(2)]]),
      peek: snap([['a', int(1)]]),
      peekLine: 4,
      peekReached: true,
    }
    const marker = { at: 'marker' }
    const run = buildVariablesRun({ taskId: 7, status: 'success', capture, config: marker })
    expect(currentSnapshot(run).vars[0].v).toEqual(int(1))
    expect(run).toMatchObject({ taskId: 7, at: 'marker', peekLine: 4, peekReached: true })
    const missed = buildVariablesRun({
      taskId: 7,
      status: 'error',
      capture: { ...capture, peek: null, peekReached: false },
      config: marker,
    })
    expect(currentSnapshot(missed).vars[0].v).toEqual(int(2))
    expect(missed.status).toBe('error')
    const atEnd = buildVariablesRun({ taskId: 7, capture, config: { at: 'end' } })
    expect(currentSnapshot(atEnd).vars[0].v).toEqual(int(2))
  })

  it('compares with the previous run of the same task only (ids as text)', () => {
    const config = { at: 'end' }
    const first = buildVariablesRun({ taskId: 1, capture: { end: snap([['a', int(1)]]) }, config })
    const second = buildVariablesRun({
      taskId: '1',
      capture: { end: snap([['a', int(2)]]) },
      config,
      previous: first,
    })
    expect(second.changed).toEqual(['a'])
    const other = buildVariablesRun({
      taskId: 2,
      capture: { end: snap([['a', int(2)]]) },
      config,
      previous: first,
    })
    expect(other.changed).toEqual([])
  })

  it('has no snapshot when the code never ran', () => {
    const run = buildVariablesRun({ taskId: 1, status: 'error', capture: null, config: {} })
    expect(run.snapshots).toEqual([])
    expect(currentSnapshot(run)).toBeNull()
  })
})

describe('sync shape', () => {
  it('is null with nothing to show, and round-trips a run with predictions', () => {
    expect(compactVariablesForSync(null, null)).toBeNull()
    expect(compactVariablesForSync(null, { taskId: 1, values: { a: '' } })).toBeNull()
    const run = buildVariablesRun({
      taskId: 1,
      status: 'success',
      capture: { end: snap([['a', int(3)]]) },
      config: { at: 'end' },
    })
    const synced = compactVariablesForSync(run, {
      taskId: 1,
      values: { a: '3' },
      results: { a: true },
    })
    expect(JSON.stringify(synced)).not.toContain('undefined')
    const back = readSyncedVariables(synced)
    expect(currentSnapshot(back.run).vars).toEqual([{ n: 'a', v: int(3) }])
    expect(back.predictions).toEqual({ taskId: 1, values: { a: '3' }, results: { a: true } })
  })

  it('carries predictions typed before any run', () => {
    const synced = compactVariablesForSync(null, { taskId: 2, values: { a: '5' }, results: null })
    expect(synced).toMatchObject({ taskId: 2, ran: false, predictions: { a: '5' } })
    expect(readSyncedVariables(synced).run).toBeNull()
  })

  it('tolerates the realtime database dropping empty arrays', () => {
    const back = readSyncedVariables({ taskId: 1, ran: true, at: 'end' })
    expect(back.run.snapshots).toEqual([])
    expect(back.run.changed).toEqual([])
  })
})

describe("predict mode's Run lock (getPredictRunLock, P6-18)", () => {
  const task = { id: 7, showVariables: { mode: 'predict', predict: ['coins', 'gems'] } }

  it('locks until every predict tag has a non-blank answer', () => {
    expect(getPredictRunLock(task, null)).toEqual({
      message: PREDICT_RUN_LOCK_MESSAGE,
      missing: ['coins', 'gems'],
    })
    const some = { taskId: 7, values: { coins: '13', gems: '  ' }, results: null }
    expect(getPredictRunLock(task, some).missing).toEqual(['gems'])
    const all = { taskId: 7, values: { coins: '13', gems: '5' }, results: null }
    expect(getPredictRunLock(task, all)).toBeNull()
  })

  it('lifts for good after the first Run, even if a tag is cleared again', () => {
    expect(getPredictRunLock(task, { taskId: 7, values: { coins: '' }, ran: true })).toBeNull()
  })

  it("ignores another task's predictions", () => {
    const other = { taskId: 8, values: { coins: '1', gems: '2' }, ran: true }
    expect(getPredictRunLock(task, other).missing).toEqual(['coins', 'gems'])
  })

  it('never locks with lockRun: false, outside predict mode, or with nothing to predict', () => {
    expect(
      getPredictRunLock({ id: 7, showVariables: { ...task.showVariables, lockRun: false } }, null)
    ).toBeNull()
    expect(getPredictRunLock({ id: 7, showVariables: { mode: 'view' } }, null)).toBeNull()
    expect(getPredictRunLock({ id: 7, showVariables: { mode: 'predict' } }, null)).toBeNull()
    expect(getPredictRunLock({ id: 7 }, null)).toBeNull()
  })
})
