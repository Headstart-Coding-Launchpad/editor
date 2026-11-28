// @vitest-environment node
// Fun moment: a child types Sprite("🐱") and a cat appears, filling the sprite's box.
// Runs the game frame's own drawing code (everything before Pyodide boots) against a
// recording canvas, so it checks what is drawn, not how the source string reads.
import { describe, expect, it } from 'vitest'
import { buildArcadeIframeSrc, isArcadeEmoji } from '../runtime.js'

// The emoji's ink inside its art canvas, as a real canvas would measure it.
const INK = {
  actualBoundingBoxLeft: 0,
  actualBoundingBoxRight: 100,
  actualBoundingBoxAscent: 90,
  actualBoundingBoxDescent: 10,
}

function fakeCanvas(log) {
  const ctx = new Proxy(
    { measureText: () => INK, setTransform() {}, fillRect() {} },
    {
      get: (target, key) => (key in target ? target[key] : (...args) => log.push([key, ...args])),
      set: (target, key, value) => ((target[key] = value), true),
    }
  )
  return {
    width: 0,
    height: 0,
    style: {},
    getContext: () => ctx,
    getAttribute: () => null,
    addEventListener() {},
    focus() {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 160, height: 120 }),
  }
}

function bootFrame(assets = []) {
  const html = buildArcadeIframeSrc({ assets })
  const script = html.split('<script type="module">')[1].split('const bootstrap =')[0]
  const log = []
  const game = fakeCanvas(log)
  const art = []
  const document = {
    getElementById: (id) => (id === 'game' ? game : { style: {} }),
    createElement: () => {
      const c = fakeCanvas(log)
      art.push(c)
      return c
    },
  }
  class Image {
    complete = true
    naturalWidth = 32
    naturalHeight = 32
  }
  const g = {}
  new Function(
    'globalThis',
    'document',
    'Image',
    'addEventListener',
    'innerWidth',
    'innerHeight',
    'parent',
    script
  )(g, document, Image, () => {}, 640, 480, { postMessage() {} })
  return { g, log, art, draws: () => log.filter(([op]) => op === 'drawImage') }
}

describe('Sprite("🐱") draws an emoji', () => {
  it('draws the emoji to fill its sprite box at the sprite position', () => {
    const { g, draws, art } = bootFrame()
    g.hsArcadeSprite('🐱', 10, 20, 16, 16, 0, 1)
    expect(draws()).toHaveLength(1)
    const [, source, x, y, w, h] = draws()[0]
    expect(art).toContain(source)
    // The ink is 100 x 100 (plus a small margin): it fills the 16 x 16 box.
    expect(w).toBeGreaterThanOrEqual(15)
    expect(h).toBeGreaterThanOrEqual(15)
    expect(x).toBeGreaterThanOrEqual(10)
    expect(y).toBeGreaterThanOrEqual(20)
    expect(x + w).toBeLessThanOrEqual(26.0001)
    expect(y + h).toBeLessThanOrEqual(36.0001)
  })

  it('respects a bigger width and height and draws each emoji once into its art', () => {
    const { g, draws, art } = bootFrame()
    g.hsArcadeSprite('🐱', 0, 0, 48, 48, 0, 1)
    g.hsArcadeSprite('🐱', 0, 0, 48, 48, 0, 1)
    expect(draws()).toHaveLength(2)
    expect(art).toHaveLength(1)
    expect(draws()[1][4]).toBeGreaterThanOrEqual(46)
  })

  it('keeps uploaded assets first, even one named with an emoji', () => {
    const { g, draws, art } = bootFrame([{ name: '🐱', url: 'data:image/png;base64,abc' }])
    g.hsArcadeSprite('🐱', 0, 0, 16, 16, 0, 1)
    expect(draws()).toHaveLength(1)
    expect(art).toHaveLength(0)
  })

  it('still draws nothing for an unknown name that is not an emoji', () => {
    const { g, draws } = bootFrame()
    g.hsArcadeSprite('player.png', 0, 0, 16, 16, 0, 1)
    g.hsArcadeSprite('cat', 0, 0, 16, 16, 0, 1)
    expect(draws()).toHaveLength(0)
  })
})

describe('isArcadeEmoji', () => {
  it('knows single and multi-codepoint emoji', () => {
    for (const e of ['🐱', '❤️', '👍🏽', '👩‍🚀', '🏳️‍🌈', '🇬🇧', '1️⃣', '🐱🐶']) {
      expect(isArcadeEmoji(e), e).toBe(true)
    }
  })

  it('does not take names, digits or emoji inside a file name', () => {
    for (const n of ['', 'cat', 'player.png', '7', '#', '🐱.png', 'cat 🐱', ' 🐱']) {
      expect(isArcadeEmoji(n), n).toBe(false)
    }
  })
})
