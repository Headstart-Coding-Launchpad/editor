import {
  getKeyForChar,
  describeCharKeys,
  isSupportedLayout,
  normalizeKeyEvent,
  normalizePointerEvent,
  comboOf,
  normalizeCombo,
  isReservedCombo,
  recognizeGestures,
  gestureSatisfies,
  typedCharacters,
  summarizeInput,
  typingStats,
  createInputRecorder,
  detectInputCapabilities,
  withKeyEvidence,
  unmetRequirements,
} from '../index.js'

let clock = 0
const key = (keyValue, extra = {}) =>
  normalizeKeyEvent(
    {
      type: 'keydown',
      key: keyValue,
      code: extra.code ?? '',
      shiftKey: extra.shift,
      ctrlKey: extra.ctrl,
      metaKey: extra.meta,
      altKey: extra.alt,
      getModifierState: (name) => name === 'CapsLock' && !!extra.caps,
      ...extra.raw,
    },
    (clock += 100)
  )
const pointer = (type, extra = {}) =>
  normalizePointerEvent(
    {
      type,
      pointerType: extra.pointerType ?? 'mouse',
      button: extra.button ?? 0,
      clientX: extra.x ?? 0,
      clientY: extra.y ?? 0,
      targetId: extra.target ?? null,
    },
    null,
    extra.t ?? (clock += 10)
  )

beforeEach(() => {
  clock = 0
})

describe('UK layout', () => {
  it('maps UK symbols to the right key and Shift state', () => {
    expect(getKeyForChar('"')).toEqual({ code: 'Digit2', shift: true })
    expect(getKeyForChar('@')).toEqual({ code: 'Quote', shift: true })
    expect(getKeyForChar('£')).toEqual({ code: 'Digit3', shift: true })
    expect(getKeyForChar('#')).toEqual({ code: 'Backslash', shift: false })
    expect(getKeyForChar('A')).toEqual({ code: 'KeyA', shift: true })
    expect(getKeyForChar('a')).toEqual({ code: 'KeyA', shift: false })
    expect(getKeyForChar(' ')).toEqual({ code: 'Space', shift: false })
    expect(getKeyForChar('€')).toBeNull()
  })

  it('describes how to type a character', () => {
    expect(describeCharKeys('"')).toBe('Shift + 2')
    expect(describeCharKeys('@')).toBe("Shift + '")
    expect(describeCharKeys('H')).toBe('Shift + H')
    expect(describeCharKeys('h')).toBe('H')
    expect(isSupportedLayout('uk')).toBe(true)
    expect(isSupportedLayout('us')).toBe(false)
  })
})

describe('key events and combos', () => {
  it('normalises modifiers, Caps Lock and source', () => {
    const e = key('A', { code: 'KeyA', caps: true })
    expect(e).toMatchObject({ kind: 'keydown', key: 'A', capsLock: true, source: 'hardware' })
    expect(e.mods).toEqual({ shift: false, ctrl: false, alt: false, meta: false, mod: false })
    expect(key('Unidentified').source).toBe('virtual')
    expect(key('a', { raw: { source: 'virtual' } }).source).toBe('virtual')
  })

  it('builds canonical combos, treating Ctrl and Cmd alike', () => {
    expect(comboOf(key('c', { code: 'KeyC', ctrl: true }))).toBe('mod+c')
    expect(comboOf(key('c', { code: 'KeyC', meta: true }))).toBe('mod+c')
    expect(comboOf(key('Z', { code: 'KeyZ', ctrl: true, shift: true }))).toBe('mod+shift+z')
    expect(comboOf(key('Tab', { shift: true }))).toBe('shift+tab')
    expect(comboOf(key('A', { code: 'KeyA', shift: true }))).toBe('a')
    expect(comboOf(key('Shift', { shift: true }))).toBeNull()
  })

  it('normalises authored combos and flags browser-reserved ones', () => {
    expect(normalizeCombo('Ctrl + Shift + T')).toBe('mod+shift+t')
    expect(normalizeCombo('shift+cmd+z')).toBe('mod+shift+z')
    expect(isReservedCombo('Ctrl+W')).toBe(true)
    expect(isReservedCombo('cmd+shift+n')).toBe(true)
    expect(isReservedCombo('Ctrl+C')).toBe(false)
  })
})

describe('gesture recognition', () => {
  it('recognises click, double-click and right-click from native events', () => {
    const gestures = recognizeGestures([
      pointer('click', { target: 'star' }),
      pointer('dblclick', { target: 'folder' }),
      pointer('contextmenu', { target: 'file', button: 2 }),
    ])
    expect(gestures.map((g) => [g.gesture, g.targetId])).toEqual([
      ['click', 'star'],
      ['double_click', 'folder'],
      ['right_click', 'file'],
    ])
  })

  it('recognises a drag and suppresses the trailing click', () => {
    const gestures = recognizeGestures([
      pointer('pointerdown', { target: 'apple', x: 10, y: 10, t: 0 }),
      pointer('pointermove', { x: 40, y: 12, t: 50 }),
      pointer('pointerup', { target: 'basket', x: 200, y: 90, t: 200 }),
      pointer('click', { target: 'apple', t: 210 }),
    ])
    expect(gestures).toEqual([
      { gesture: 'drag', targetId: 'apple', toTargetId: 'basket', at: 200 },
    ])
  })

  it('does not treat small jitter as a drag', () => {
    const gestures = recognizeGestures([
      pointer('pointerdown', { target: 'star', x: 10, y: 10, t: 0 }),
      pointer('pointermove', { x: 13, y: 12, t: 20 }),
      pointer('pointerup', { target: 'star', x: 13, y: 12, t: 60 }),
      pointer('click', { target: 'star', t: 400 }),
    ])
    expect(gestures.map((g) => g.gesture)).toEqual(['click'])
  })

  it('maps touch gestures to their touch names', () => {
    const touch = { pointerType: 'touch' }
    const gestures = recognizeGestures([
      pointer('click', { ...touch, target: 'a' }),
      pointer('dblclick', { ...touch, target: 'b' }),
      pointer('pointerdown', { ...touch, target: 'c', x: 5, y: 5, t: 1000 }),
      pointer('pointerup', { ...touch, target: 'c', x: 6, y: 5, t: 1700 }),
    ])
    expect(gestures.map((g) => g.gesture)).toEqual(['tap', 'double_tap', 'long_press'])
  })

  it('counts an Android long-press contextmenu once', () => {
    const touch = { pointerType: 'touch' }
    const gestures = recognizeGestures([
      pointer('pointerdown', { ...touch, target: 'c', t: 0 }),
      pointer('contextmenu', { ...touch, target: 'c', t: 550 }),
      pointer('pointerup', { ...touch, target: 'c', t: 900 }),
    ])
    expect(gestures.map((g) => g.gesture)).toEqual(['long_press'])
  })

  it('merges a burst of scroll events and recognises hover dwell', () => {
    const gestures = recognizeGestures([
      pointer('wheel', { target: 'list', t: 0 }),
      pointer('wheel', { target: 'list', t: 100 }),
      pointer('wheel', { target: 'list', t: 250 }),
      pointer('pointerenter', { target: 'tip', t: 1000 }),
      pointer('pointerleave', { target: 'tip', t: 2000 }),
      pointer('pointerenter', { target: 'quick', t: 3000 }),
      pointer('pointerleave', { target: 'quick', t: 3100 }),
    ])
    expect(gestures.map((g) => [g.gesture, g.targetId])).toEqual([
      ['scroll', 'list'],
      ['hover', 'tip'],
    ])
  })

  it('accepts touch equivalents when allowed', () => {
    expect(gestureSatisfies('double_click', 'double_tap')).toBe(true)
    expect(gestureSatisfies('right_click', 'long_press')).toBe(true)
    expect(gestureSatisfies('double_click', 'double_tap', { allowTouchEquivalent: false })).toBe(
      false
    )
    expect(gestureSatisfies('hover', 'tap')).toBe(false)
  })
})

describe('summaries', () => {
  it('records whether capitals came from Shift or Caps Lock', () => {
    const typed = typedCharacters([
      key('H', { code: 'KeyH', shift: true }),
      key('i', { code: 'KeyI' }),
      key('B', { code: 'KeyB', caps: true }),
      key('"', { code: 'Digit2', shift: true }),
      key('c', { code: 'KeyC', ctrl: true }),
    ])
    expect(typed.map((c) => [c.char, c.method])).toEqual([
      ['H', 'shift'],
      ['i', null],
      ['B', 'caps_lock'],
      ['"', null],
    ])
  })

  it('summarises keys, shortcuts and gestures without raw events', () => {
    const summary = summarizeInput([
      key('Shift', { shift: true }),
      key('H', { code: 'KeyH', shift: true }),
      key('c', { code: 'KeyC', ctrl: true }),
      key('v', { code: 'KeyV', ctrl: true }),
      pointer('dblclick', { target: 'folder' }),
      pointer('click', { target: 'star' }),
    ])
    expect(summary).toMatchObject({
      keystrokes: 3,
      shiftCapitals: 1,
      capsLockCapitals: 0,
      shortcuts: { 'mod+c': 1, 'mod+v': 1 },
      clicks: 1,
      doubleClicks: 1,
      pointerTypes: ['mouse'],
      sources: ['hardware'],
    })
    expect(JSON.stringify(summary).length).toBeLessThan(500)
  })

  it('computes typing accuracy and words per minute', () => {
    expect(typingStats('Hello World', 'Hello World', 60000)).toEqual({
      correctChars: 11,
      typedChars: 11,
      accuracy: 1,
      wpm: 2.2,
      complete: true,
    })
    expect(typingStats('cat', 'cot', 0)).toMatchObject({ correctChars: 2, accuracy: 0.667, wpm: 0 })
  })
})

describe('recorder and capabilities', () => {
  it('keeps only the most recent events', () => {
    const recorder = createInputRecorder({ maxEvents: 3 })
    for (let i = 0; i < 5; i += 1) recorder.record({ t: i })
    expect(recorder.events().map((e) => e.t)).toEqual([2, 3, 4])
    recorder.reset()
    expect(recorder.size).toBe(0)
  })

  it('detects pointer capabilities and learns about keyboards from hardware keys', () => {
    const matchMedia = (q) => ({ matches: q === '(any-pointer: coarse)' })
    const caps = detectInputCapabilities({ matchMedia, maxTouchPoints: 5 })
    expect(caps).toEqual({
      finePointer: false,
      hover: false,
      touch: true,
      physicalKeyboard: null,
      platform: 'other',
    })
    expect(withKeyEvidence(caps, { source: 'virtual' }).physicalKeyboard).toBeNull()
    expect(withKeyEvidence(caps, { source: 'hardware' }).physicalKeyboard).toBe(true)
    expect(
      unmetRequirements({ finePointer: true, hover: true, physicalKeyboard: true }, caps)
    ).toEqual(['finePointer', 'hover'])
  })
})
