import { describe, expect, it } from 'vitest'
import {
  applyGraphicEffectsToPixels,
  drawSpriteWithGraphicEffects,
  effectUniforms,
  fallbackCanvasFilter,
  hasGraphicEffects,
  readGraphicEffects,
} from '../graphicEffects.js'

const NONE = readGraphicEffects({})

function solid(width, height, [r, g, b, a]) {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < data.length; i += 4) data.set([r, g, b, a], i)
  return data
}

function pixel(data, width, x, y) {
  return Array.from(data.slice((y * width + x) * 4, (y * width + x) * 4 + 4))
}

describe('reading effects from sprite state', () => {
  it('defaults missing effects to 0 and detects any active effect', () => {
    expect(readGraphicEffects({ effect_ghost: 40 })).toMatchObject({ ghost: 40, color: 0 })
    expect(hasGraphicEffects(NONE)).toBe(false)
    expect(hasGraphicEffects(readGraphicEffects({ effect_whirl: -5 }))).toBe(true)
  })

  it('clamps values the way Scratch does', () => {
    const u = effectUniforms({ ...NONE, ghost: 250, brightness: -500, mosaic: 99999 })
    expect(u.ghost).toBe(0)
    expect(u.brightness).toBe(-1)
    expect(u.mosaic).toBe(512)
  })
})

describe('applyGraphicEffectsToPixels', () => {
  it('leaves pixels unchanged when no effect is set', () => {
    const source = solid(4, 4, [10, 20, 30, 255])
    expect(Array.from(applyGraphicEffectsToPixels(source, 4, 4, NONE))).toEqual(Array.from(source))
  })

  it('ghost 50 halves opacity, ghost 100 makes the sprite invisible', () => {
    const source = solid(2, 2, [255, 0, 0, 255])
    expect(
      pixel(applyGraphicEffectsToPixels(source, 2, 2, { ...NONE, ghost: 50 }), 2, 0, 0)
    ).toEqual([255, 0, 0, 128])
    expect(
      pixel(applyGraphicEffectsToPixels(source, 2, 2, { ...NONE, ghost: 100 }), 2, 0, 0)[3]
    ).toBe(0)
  })

  it('brightness 100 turns the sprite white and -100 turns it black', () => {
    const source = solid(2, 2, [100, 150, 200, 255])
    expect(
      pixel(applyGraphicEffectsToPixels(source, 2, 2, { ...NONE, brightness: 100 }), 2, 1, 1)
    ).toEqual([255, 255, 255, 255])
    expect(
      pixel(applyGraphicEffectsToPixels(source, 2, 2, { ...NONE, brightness: -100 }), 2, 1, 1)
    ).toEqual([0, 0, 0, 255])
  })

  it('color 100 shifts hue halfway round the wheel (red becomes cyan)', () => {
    const source = solid(2, 2, [255, 0, 0, 255])
    expect(
      pixel(applyGraphicEffectsToPixels(source, 2, 2, { ...NONE, color: 100 }), 2, 0, 0)
    ).toEqual([0, 255, 255, 255])
  })

  it('color 200 wraps back to the original hue', () => {
    const source = solid(2, 2, [255, 0, 0, 255])
    expect(
      pixel(applyGraphicEffectsToPixels(source, 2, 2, { ...NONE, color: 200 }), 2, 0, 0)
    ).toEqual([255, 0, 0, 255])
  })

  it('mosaic repeats the whole sprite as a grid of smaller copies', () => {
    // 4x4 sprite: left half red, right half blue.
    const width = 4
    const source = new Uint8ClampedArray(width * width * 4)
    for (let y = 0; y < width; y++) {
      for (let x = 0; x < width; x++) {
        source.set(x < 2 ? [255, 0, 0, 255] : [0, 0, 255, 255], (y * width + x) * 4)
      }
    }
    // mosaic 10 → 2 tiles: columns go red, blue, red, blue.
    const out = applyGraphicEffectsToPixels(source, width, width, { ...NONE, mosaic: 10 })
    expect([0, 1, 2, 3].map((x) => pixel(out, width, x, 0)[0])).toEqual([255, 0, 255, 0])
  })

  it('pixelate turns neighbouring pixels into uniform blocks', () => {
    const width = 8
    const source = new Uint8ClampedArray(width * width * 4)
    for (let i = 0; i < width * width; i++) source.set([i * 3, 0, 0, 255], i * 4)
    // skinSize 8 / (40 / 10) = 2 blocks across the sprite.
    const out = applyGraphicEffectsToPixels(source, width, width, { ...NONE, pixelate: 40 }, 8)
    expect(pixel(out, width, 0, 0)).toEqual(pixel(out, width, 3, 3))
    expect(pixel(out, width, 0, 0)).not.toEqual(pixel(out, width, 4, 4))
  })

  it('whirl and fisheye leave the centre pixel in place but move pixels off-centre', () => {
    const width = 9
    const source = new Uint8ClampedArray(width * width * 4)
    for (let i = 0; i < width * width; i++) source.set([i, 255 - i, 0, 255], i * 4)
    for (const effects of [
      { ...NONE, whirl: 90 },
      { ...NONE, fisheye: 100 },
    ]) {
      const out = applyGraphicEffectsToPixels(source, width, width, effects)
      expect(pixel(out, width, 4, 4)).toEqual(pixel(source, width, 4, 4))
      expect(pixel(out, width, 2, 3)).not.toEqual(pixel(source, width, 2, 3))
    }
  })
})

describe('fallback for cross-origin costumes', () => {
  it('approximates colour and brightness with a CSS filter', () => {
    expect(fallbackCanvasFilter(NONE)).toBe('none')
    expect(fallbackCanvasFilter({ ...NONE, color: 50, brightness: -50 })).toBe(
      'hue-rotate(90deg) brightness(0.5)'
    )
  })

  it('reports that effects were not drawn when no 2D canvas is available', () => {
    // jsdom has no canvas implementation, so the caller falls back to the plain sprite.
    const transform = { cx: 0, cy: 0, rot: 0, flipH: false, r: 24 }
    expect(drawSpriteWithGraphicEffects({}, { ...NONE, ghost: 50 }, transform, () => {})).toBe(
      false
    )
  })
})
