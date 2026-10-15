import { describe, expect, it } from 'vitest'
import {
  SLOW_MO_HISTORY,
  buildSlowMoModel,
  compactRecording,
  computeLoopPasses,
  describePosition,
  initialPlayback,
  lineAt,
  outputAt,
  passLabel,
  passesAt,
  playbackReducer,
  readRecording,
  shrinkValueNode,
  stageAt,
  stepChangedItems,
  turtleAt,
  variablesAt,
} from '../recording.js'
import { PYTHON_SLOW_MO_MAX_STEPS } from '../config.js'

const int = (v) => ({ t: 'int', v })

// total = 0 / for n in [4, 7, 2, 5]: / total = total + n / print(total), as the worker records it.
function loopRecording() {
  return {
    steps: [
      { l: 1, k: 0, s: { total: int(0) } },
      { l: 2, k: 0, s: { n: int(4) } },
      { l: 3, k: 0, s: { total: int(4) } },
      { l: 2, k: 0, s: { n: int(7) } },
      { l: 3, k: 0, s: { total: int(11) } },
      { l: 2, k: 0, s: { n: int(2) } },
      { l: 3, k: 0, s: { total: int(13) } },
      { l: 2, k: 0, s: { n: int(5) } },
      { l: 3, k: 0, s: { total: int(18) } },
      { l: 2, k: 0 },
      { l: 4, k: 0, o: 3 },
    ],
    output: '18\n',
    loops: [{ line: 2, end: 3, total: 4 }],
    turtle: null,
    stage: null,
    status: 'success',
  }
}

describe('readRecording', () => {
  it('normalises a worker recording and drops broken steps', () => {
    const rec = readRecording({
      steps: [{ l: 1, k: 0 }, { l: 0 }, null, { l: 2, k: -3, s: 'no', d: ['x', 3], c: 'f', o: 4 }],
      output: 'hi',
      loops: [{ line: 2, end: 1, total: -1 }, { line: 0 }],
      status: 'weird',
    })
    expect(rec.steps).toEqual([
      { l: 1, k: 0 },
      { l: 2, k: 0, d: ['x'], c: 'f', o: 4 },
    ])
    expect(rec.loops).toEqual([{ line: 2, end: 2, total: null }])
    expect(rec.status).toBe('success')
  })

  it('reads lists the realtime database turned into numbered objects', () => {
    const rec = readRecording({ steps: { 0: { l: 1 }, 1: { l: 2 } }, output: '' })
    expect(rec.steps.map((step) => step.l)).toEqual([1, 2])
  })

  it('caps the steps at 2,000', () => {
    const steps = Array.from({ length: PYTHON_SLOW_MO_MAX_STEPS + 5 }, () => ({ l: 1 }))
    const rec = readRecording({ steps })
    expect(rec.steps).toHaveLength(PYTHON_SLOW_MO_MAX_STEPS)
    expect(rec.status).toBe('capped')
  })

  it('is null for anything that is not a recording', () => {
    expect(readRecording(null)).toBeNull()
    expect(readRecording([1, 2])).toBeNull()
  })
})

describe('loop pass counter', () => {
  it('counts each pass and knows the total from a list literal', () => {
    const rec = loopRecording()
    const passes = computeLoopPasses(rec.steps, rec.loops)
    expect(passes[0]).toEqual([])
    expect(passes[1]).toEqual([{ line: 2, pass: 1, total: 4, done: false }])
    expect(passes[2]).toEqual([{ line: 2, pass: 1, total: 4, done: false }])
    expect(passes[6]).toEqual([{ line: 2, pass: 3, total: 4, done: false }])
    // The header runs once more and the loop ends.
    expect(passes[9]).toEqual([{ line: 2, pass: 4, total: 4, done: true }])
    expect(passes[10]).toEqual([])
  })

  it('says "pass N" when the total is unknown, and restarts on a fresh entry', () => {
    const steps = [
      { l: 1, k: 0 },
      { l: 2, k: 0 },
      { l: 3, k: 0 },
      { l: 2, k: 0 },
      { l: 1, k: 0 }, // an outer loop line: the inner loop is left
      { l: 2, k: 0 },
      { l: 3, k: 0 },
    ]
    const passes = computeLoopPasses(steps, [{ line: 2, end: 3, total: null }])
    expect(passes[2]).toEqual([{ line: 2, pass: 1, total: null, done: false }])
    expect(passes[3]).toEqual([{ line: 2, pass: 1, total: null, done: true }])
    expect(passes[6]).toEqual([{ line: 2, pass: 1, total: null, done: false }])
  })

  it('keeps a loop counting while a function it called runs', () => {
    const steps = [
      { l: 5, k: 0 },
      { l: 6, k: 0 },
      { l: 2, k: 1 }, // inside the called function
      { l: 5, k: 0 },
      { l: 6, k: 0 },
      { l: 5, k: 0 },
      { l: 8, k: 0 },
    ]
    const passes = computeLoopPasses(steps, [{ line: 5, end: 6, total: 2 }])
    expect(passes[2]).toEqual([{ line: 5, pass: 1, total: 2, done: false }])
    expect(passes[4]).toEqual([{ line: 5, pass: 2, total: 2, done: false }])
    expect(passes[5]).toEqual([{ line: 5, pass: 2, total: 2, done: true }])
  })

  it('labels passes in plain words', () => {
    expect(passLabel({ pass: 3, total: 4, done: false })).toBe('pass 3 of 4')
    expect(passLabel({ pass: 3, total: null, done: false })).toBe('pass 3')
    expect(passLabel({ pass: 4, total: 4, done: true })).toBe('finished: 4 passes')
    expect(passLabel({ pass: 1, total: null, done: true })).toBe('finished: 1 pass')
    expect(passLabel({ pass: 0, total: 0, done: true })).toBe('no passes')
  })
})

describe('the step model', () => {
  const model = buildSlowMoModel(loopRecording())

  it('starts before the first line', () => {
    expect(model.count).toBe(11)
    expect(lineAt(model, 0)).toBeNull()
    expect(outputAt(model, 0)).toBe('')
    expect(variablesAt(model, 0).snapshot.vars).toEqual([])
    expect(passesAt(model, 0)).toEqual([])
  })

  it('shows each line with its effects', () => {
    expect(lineAt(model, 3)).toBe(3)
    const { snapshot, changed, history } = variablesAt(model, 3)
    expect(snapshot.vars).toEqual([
      { n: 'total', v: int(4) },
      { n: 'n', v: int(4) },
    ])
    expect(changed).toEqual(['total'])
    expect(history).toEqual({ total: [int(0)] })
  })

  it('rebuilds the state when stepping back', () => {
    const forward = variablesAt(model, 7)
    variablesAt(model, 9)
    const back = variablesAt(model, 7)
    expect(back).toEqual(forward)
    expect(back.snapshot.vars.find((entry) => entry.n === 'total').v).toEqual(int(13))
  })

  it(`keeps the last ${SLOW_MO_HISTORY} earlier values, newest first`, () => {
    const { history } = variablesAt(model, 9)
    expect(history.total).toEqual([int(13), int(11), int(4)])
  })

  it('grows the output step by step and shows all of it at the end', () => {
    expect(outputAt(model, 10)).toBe('')
    expect(outputAt(model, 11)).toBe('18\n')
    expect(outputAt(model, 99)).toBe('18\n')
  })

  it('removes the variables a returning function took with it', () => {
    const fnModel = buildSlowMoModel({
      steps: [
        { l: 4, k: 0, s: { x: int(2) }, c: 'double' },
        { l: 2, k: 1, s: { y: int(4) } },
        { l: 3, k: 1, s: { d: int(4) }, d: ['x', 'y'], c: null },
      ],
      output: '',
    })
    expect(variablesAt(fnModel, 2).snapshot).toEqual({
      vars: [
        { n: 'x', v: int(2) },
        { n: 'y', v: int(4) },
      ],
      scope: 'double',
    })
    expect(variablesAt(fnModel, 3).snapshot).toEqual({ vars: [{ n: 'd', v: int(4) }], scope: null })
  })

  it('draws the Turtle and Stage only up to the step', () => {
    const drawn = buildSlowMoModel({
      steps: [
        { l: 1, k: 0, t: 1, te: 0, ts: 0, g: 1 },
        { l: 2, k: 0, t: 2, ts: 1, g: 2 },
        { l: 3, k: 0, t: 0, te: 1, ts: 2 },
      ],
      output: '',
      turtle: {
        epochs: [['a', 'b'], ['c']],
        states: [{ x: 0 }, { x: 10 }, { x: 0 }],
      },
      stage: { commands: [{ type: 'rect' }, { type: 'circle' }] },
    })
    expect(turtleAt(drawn, 0)).toEqual({ commands: [], state: null })
    expect(turtleAt(drawn, 1)).toEqual({ commands: ['a'], state: { x: 0 } })
    expect(turtleAt(drawn, 2)).toEqual({ commands: ['a', 'b'], state: { x: 10 } })
    // reset() started a new epoch.
    expect(turtleAt(drawn, 3)).toEqual({ commands: [], state: { x: 0 } })
    expect(stageAt(drawn, 1)).toEqual([{ type: 'rect' }])
    expect(stageAt(drawn, 3)).toEqual([{ type: 'rect' }, { type: 'circle' }])
    expect(stageAt(model, 3)).toBeNull()
  })

  it('describes a step for screen readers', () => {
    expect(describePosition(model, 0)).toBe('Ready to play 11 steps.')
    expect(describePosition(model, 5)).toBe(
      'Step 5 of 11: line 3 ran. total is now 11 (was 4). Loop on line 2: pass 2 of 4.'
    )
    expect(describePosition(model, 11)).toContain('That was the last step.')
  })
})

describe('stepChangedItems (per-item marks while stepping)', () => {
  const str = (v) => ({ t: 'str', v })
  const list = (items) => ({ t: 'list', len: items.length, items })

  it('marks the item a step changed, against the value before the step', () => {
    const model = buildSlowMoModel({
      steps: [
        { l: 1, k: 0, s: { palette: list([str('red'), str('blue')]) } },
        { l: 2, k: 0, s: { palette: list([str('red'), str('blue'), str('green')]) } },
      ],
      output: '',
      loops: [],
      turtle: null,
      stage: null,
      status: 'success',
    })
    const first = variablesAt(model, 1)
    // A new variable has no earlier value, so only its tag is marked.
    expect(stepChangedItems(first.snapshot, first.changed, first.history)).toEqual({})
    const second = variablesAt(model, 2)
    expect(stepChangedItems(second.snapshot, second.changed, second.history)).toEqual({
      palette: ['2'],
    })
  })
})

describe('playbackReducer', () => {
  const loaded = (extra = {}) =>
    playbackReducer(initialPlayback(1), { type: 'load', count: 3, ...extra })

  it('loads paused at the start, playing, or one step in', () => {
    expect(loaded()).toMatchObject({ position: 0, mode: 'paused', count: 3 })
    expect(loaded({ play: true })).toMatchObject({ position: 0, mode: 'playing' })
    expect(loaded({ step: true })).toMatchObject({ position: 1, mode: 'paused' })
  })

  it('ticks while playing and finishes at the end', () => {
    let state = loaded({ play: true })
    state = playbackReducer(state, { type: 'tick' })
    state = playbackReducer(state, { type: 'tick' })
    expect(state).toMatchObject({ position: 2, mode: 'playing' })
    state = playbackReducer(state, { type: 'tick' })
    expect(state).toMatchObject({ position: 3, mode: 'finished' })
    expect(playbackReducer(state, { type: 'tick' })).toBe(state)
  })

  it('steps, steps back, pauses and restarts', () => {
    let state = loaded({ play: true })
    state = playbackReducer(state, { type: 'pause' })
    expect(state.mode).toBe('paused')
    state = playbackReducer(state, { type: 'step' })
    state = playbackReducer(state, { type: 'step' })
    expect(state.position).toBe(2)
    state = playbackReducer(state, { type: 'back' })
    expect(state).toMatchObject({ position: 1, mode: 'paused' })
    state = playbackReducer(state, { type: 'back' })
    state = playbackReducer(state, { type: 'back' })
    expect(state.position).toBe(0)
    state = playbackReducer({ ...state, position: 3, mode: 'finished' }, { type: 'restart' })
    expect(state).toMatchObject({ position: 0, mode: 'paused' })
  })

  it('plays again from the start once finished', () => {
    const finished = { ...loaded(), position: 3, mode: 'finished' }
    expect(playbackReducer(finished, { type: 'play' })).toMatchObject({
      position: 0,
      mode: 'playing',
    })
  })

  it('does nothing without a recording, clamps the speed, and clears', () => {
    const idle = initialPlayback(1)
    expect(playbackReducer(idle, { type: 'step' })).toBe(idle)
    expect(playbackReducer(idle, { type: 'speed', speed: 9 }).speed).toBe(4)
    expect(playbackReducer(idle, { type: 'speed', speed: 0.1 }).speed).toBe(0.25)
    expect(playbackReducer(loaded(), { type: 'clear' })).toMatchObject({
      mode: 'idle',
      count: 0,
      position: 0,
    })
  })

  it('follows a presenter with seek', () => {
    const state = playbackReducer(initialPlayback(1), {
      type: 'seek',
      count: 5,
      position: 9,
      mode: 'playing',
    })
    expect(state).toMatchObject({ count: 5, position: 5, mode: 'playing' })
  })
})

describe('compactRecording (Go Live size budget)', () => {
  const longText = (n) => ({ t: 'str', v: 'x'.repeat(n) })

  function bigRecording(steps = 400) {
    return {
      steps: Array.from({ length: steps }, (_, i) => ({
        l: (i % 3) + 1,
        k: 0,
        s: { text: longText(400), items: { t: 'list', len: 50, items: Array(50).fill(int(i)) } },
        o: i,
      })),
      output: 'y'.repeat(30000),
      loops: [],
      stage: {
        commands: Array(2000).fill({ type: 'rect', x: 1, y: 1, w: 2, h: 2, colour: 'red' }),
      },
      status: 'success',
    }
  }

  it('leaves a small recording alone', () => {
    const result = compactRecording(loopRecording(), 300_000)
    expect(result.level).toBe(0)
    expect(JSON.parse(result.json).steps).toHaveLength(11)
  })

  it('gives up detail in order until it fits the budget', () => {
    const shrunk = compactRecording(bigRecording(), 300_000)
    expect(shrunk.json.length).toBeLessThanOrEqual(300_000)
    expect(shrunk.level).toBeGreaterThanOrEqual(1)
    expect(shrunk.recording.steps).toHaveLength(400)

    const tight = compactRecording(bigRecording(), 60_000)
    expect(tight.json.length).toBeLessThanOrEqual(60_000)
    expect(tight.recording.varsDropped).toBe(true)
    expect(tight.recording.steps.every((step) => !step.s)).toBe(true)
  })

  it('cuts steps last, marking the recording capped', () => {
    const result = compactRecording(bigRecording(2000), 5_000)
    expect(result.level).toBe(5)
    expect(result.json.length).toBeLessThanOrEqual(5_000)
    expect(result.recording.status).toBe('capped')
    expect(result.recording.steps.length).toBeLessThan(2000)
  })

  it('shrinks a value node: short text, a few items, nothing nested', () => {
    expect(shrinkValueNode(longText(100))).toEqual({ t: 'str', v: 'x'.repeat(40), more: 60 })
    const nested = {
      t: 'list',
      len: 8,
      items: [{ t: 'list', len: 2, items: [int(1), int(2)] }, ...Array(7).fill(int(3))],
    }
    expect(shrinkValueNode(nested)).toEqual({
      t: 'list',
      len: 8,
      items: [{ t: 'list', len: 2, items: [], cut: true }, int(3), int(3), int(3), int(3)],
      cut: true,
    })
  })
})
