import { describe, it, expect } from 'vitest'
import { evaluateDesktopCheck, CHECKS } from '../checks.js'
import { warnCompleteDesktop } from '../../moduleTaskValidation.js'
import {
  makeDefaultDesktop,
  normaliseDesktop,
  serializeDesktop,
  deserializeDesktop,
  resizeWindow,
  openWindow,
  arrangeSideBySide,
  setDesktopViewport,
} from '../desktopState.js'

function desktop(overrides = {}) {
  return {
    fs: { '/': { type: 'dir' } },
    recycleBin: [],
    windows: [],
    browserVisited: [],
    lastSearchQuery: null,
    ...overrides,
  }
}

describe('window_state moved_to', () => {
  const win = (props) => ({ appId: 'textEditor', minimized: false, maximized: false, ...props })
  const movedTo = (zone) => ({
    type: 'window_state',
    operator: 'moved_to',
    appId: 'textEditor',
    zone,
  })

  it('uses the stored desktop size, not the assumed 1200px', () => {
    // Centre at x=450: right of centre on an 800px desktop, left of it on 1200px.
    const windows = [win({ x: 350, y: 100, width: 200, height: 200 })]
    const measured = desktop({ windows, viewport: { width: 800, height: 600 } })
    expect(evaluateDesktopCheck(movedTo('right_half'), measured)).toBe(true)
    expect(evaluateDesktopCheck(movedTo('left_half'), measured)).toBe(false)
    expect(evaluateDesktopCheck(movedTo('left_half'), desktop({ windows }))).toBe(true)
  })

  it('checks quadrants and halves by the window centre', () => {
    const state = desktop({
      windows: [win({ x: 700, y: 400, width: 300, height: 200 })],
      viewport: { width: 1000, height: 700 },
    })
    expect(evaluateDesktopCheck(movedTo('bottom_right'), state)).toBe(true)
    expect(evaluateDesktopCheck(movedTo('top_right'), state)).toBe(false)
    expect(evaluateDesktopCheck(movedTo('bottom_half'), state)).toBe(true)
  })

  it('does not count a minimised, maximised or missing window, or an unknown zone', () => {
    const at = { x: 700, y: 100, width: 200, height: 200 }
    const viewport = { width: 1000, height: 700 }
    const state = (props) => desktop({ windows: [win({ ...at, ...props })], viewport })
    expect(evaluateDesktopCheck(movedTo('right_half'), state({}))).toBe(true)
    expect(evaluateDesktopCheck(movedTo('right_half'), state({ minimized: true }))).toBe(false)
    expect(evaluateDesktopCheck(movedTo('right_half'), state({ maximized: true }))).toBe(false)
    expect(evaluateDesktopCheck(movedTo('middle'), state({}))).toBe(false)
    expect(evaluateDesktopCheck(movedTo('right_half'), desktop({ viewport }))).toBe(false)
  })
})

describe('window_state resized', () => {
  const viewport = { width: 1000, height: 800 }
  const resized = (extra = {}) => ({
    type: 'window_state',
    operator: 'resized',
    appId: 'browser',
    ...extra,
  })
  const state = (props) =>
    desktop({
      viewport,
      windows: [
        {
          appId: 'browser',
          x: 0,
          y: 0,
          startWidth: 600,
          startHeight: 400,
          minimized: false,
          maximized: false,
          ...props,
        },
      ],
    })
  const check = (extra, props) => evaluateDesktopCheck(resized(extra), state(props))

  it('smaller / larger need a 15% change in area', () => {
    expect(check({ size: 'smaller' }, { width: 500, height: 400 })).toBe(true)
    expect(check({ size: 'smaller' }, { width: 560, height: 400 })).toBe(false)
    expect(check({ size: 'larger' }, { width: 700, height: 400 })).toBe(true)
    expect(check({ size: 'larger' }, { width: 500, height: 400 })).toBe(false)
  })

  it('with no size or limits, any meaningful change counts', () => {
    expect(check({}, { width: 480, height: 400 })).toBe(true)
    expect(check({}, { width: 720, height: 400 })).toBe(true)
    expect(check({}, { width: 620, height: 400 })).toBe(false)
  })

  it('a window never resized (no start size) has not changed', () => {
    expect(
      check({}, { width: 600, height: 400, startWidth: undefined, startHeight: undefined })
    ).toBe(false)
  })

  it('min/max limits are fractions of the stored desktop size', () => {
    const wide = { width: 600, height: 400 }
    expect(check({ minWidth: 0.5 }, wide)).toBe(true)
    expect(check({ minWidth: 0.7 }, wide)).toBe(false)
    expect(check({ maxHeight: 0.5 }, wide)).toBe(true)
    expect(check({ size: 'smaller', maxWidth: 0.5 }, { width: 450, height: 400 })).toBe(true)
  })

  it('maximising or minimising is not resizing', () => {
    expect(check({}, { width: 300, height: 400, maximized: true })).toBe(false)
    expect(check({}, { width: 300, height: 400, minimized: true })).toBe(false)
  })
})

describe('windows_arranged_side_by_side desktop size', () => {
  it('uses the stored desktop size', () => {
    const windows = [
      { appId: 'a', x: 0, y: 0, width: 400, height: 500, minimized: false, maximized: false },
      { appId: 'b', x: 400, y: 0, width: 400, height: 500, minimized: false, maximized: false },
    ]
    const check = { type: 'windows_arranged_side_by_side', appIds: ['a', 'b'] }
    const measured = desktop({ windows, viewport: { width: 800, height: 600 } })
    expect(evaluateDesktopCheck(check, measured)).toBe(true)
    // Against the assumed 1200px desktop the pair covers too little of the screen.
    expect(evaluateDesktopCheck(check, desktop({ windows }))).toBe(false)
  })
})

describe('window_state authoring validation', () => {
  const validate = CHECKS.find((c) => c.type === 'window_state').validate
  const run = (check) => validate({ type: 'window_state', ...check }, { n: 2, kind: 'completion' })

  it('accepts valid checks', () => {
    expect(run({ operator: 'moved_to', appId: 'textEditor', zone: 'right_half' })).toEqual([])
    expect(run({ operator: 'resized', appId: 'browser', size: 'smaller', maxWidth: 0.5 })).toEqual(
      []
    )
    expect(run({ operator: 'opened', appId: 'browser' })).toEqual([])
  })

  it('flags a missing appId, unknown zone or size, and bad limits', () => {
    expect(run({ operator: 'opened' })).toEqual(['Task 2 has a window_state check but no appId'])
    expect(run({ operator: 'moved_to', appId: 'a', zone: 'middle' })[0]).toMatch(
      /^Task 2 has a window_state moved_to check with zone "middle" — use one of: left_half/
    )
    expect(run({ operator: 'moved_to', appId: 'a' })).toHaveLength(1)
    expect(run({ operator: 'resized', appId: 'a', size: 'tiny' })[0]).toMatch(/with size "tiny"/)
    expect(run({ operator: 'resized', appId: 'a', minWidth: 1.5 })[0]).toMatch(
      /whose minWidth is not a fraction of the desktop/
    )
    expect(run({ operator: 'resized', appId: 'a', minHeight: 0.8, maxHeight: 0.5 })).toEqual([
      'Task 2 has a window_state resized check whose minHeight is more than its maxHeight',
    ])
  })

  it('does not test a resized check against the complete desktop', () => {
    const warnings = []
    warnCompleteDesktop(
      {
        check: [{ type: 'window_state', operator: 'resized', appId: 'browser', size: 'smaller' }],
        completeDesktop: {
          fs: { '/': { type: 'dir' } },
          windows: [{ appId: 'browser', x: 0, y: 0, width: 640, height: 420 }],
        },
      },
      1,
      warnings
    )
    expect(warnings).toEqual([])
  })
})

describe('desktop state geometry helpers', () => {
  it('resizeWindow keeps the size a window had before its first resize', () => {
    const state = makeDefaultDesktop(['fileManager'])
    const id = state.windows[0].id
    const once = resizeWindow(state, id, 400, 300)
    expect(once.windows[0]).toMatchObject({
      width: 400,
      height: 300,
      startWidth: 640,
      startHeight: 420,
    })
    const twice = resizeWindow(once, id, 500, 350)
    expect(twice.windows[0]).toMatchObject({ width: 500, startWidth: 640, startHeight: 420 })
  })

  it("arrangeSideBySide keeps each window's starting size", () => {
    let state = openWindow(makeDefaultDesktop(['fileManager']), 'textEditor')
    const [a, b] = state.windows
    state = arrangeSideBySide(state, a.id, b.id, { width: 1000, height: 600 })
    expect(state.windows[0]).toMatchObject({ width: 500, startWidth: 640, startHeight: 420 })
  })

  it('setDesktopViewport rounds, and returns the same state when unchanged', () => {
    const state = setDesktopViewport(makeDefaultDesktop(), { width: 812.4, height: 590.6 })
    expect(state.viewport).toEqual({ width: 812, height: 591 })
    expect(setDesktopViewport(state, { width: 812.2, height: 591.1 })).toBe(state)
    expect(setDesktopViewport(state, { width: 0, height: 500 })).toBe(state)
  })

  it('normaliseDesktop keeps a valid viewport and drops an invalid one', () => {
    const viewport = { width: 900, height: 600 }
    expect(normaliseDesktop({ viewport }).viewport).toEqual(viewport)
    expect(normaliseDesktop({ viewport: { width: 'x' } })).not.toHaveProperty('viewport')
    expect(deserializeDesktop(serializeDesktop({ viewport })).viewport).toEqual(viewport)
  })
})
