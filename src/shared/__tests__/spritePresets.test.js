import { describe, expect, it } from 'vitest'
import {
  createSpriteFromPreset,
  normalizeSpritePresets,
  createBackdropFromPreset,
  normalizeBackdropPresets,
  resolvePresetLibrary,
} from '../spritePresets'

describe('normalizeSpritePresets', () => {
  it('keeps named preset definitions with stable catalogue ids', () => {
    const presets = normalizeSpritePresets([
      { id: 'rocket', name: 'Rocket', type: 'arrow' },
      { id: 2, name: 'Invalid' },
      { id: 'empty-name', name: '' },
    ])

    expect(presets).toEqual([{ id: 'rocket', name: 'Rocket', type: 'arrow' }])
  })
})

describe('createSpriteFromPreset', () => {
  it('copies the public definition into a new uniquely identified sprite', () => {
    const preset = {
      id: 'cat',
      name: 'Cat',
      type: 'cat',
      rotationStyle: 'left-right',
      costumes: [{ name: 'walking', image: 'sprites/cat.png' }],
    }

    const sprite = createSpriteFromPreset([{ id: 'sprite1', name: 'Cat' }], preset)

    expect(sprite).toEqual({
      id: 'sprite2',
      name: 'Cat 2',
      type: 'cat',
      rotationStyle: 'left-right',
      costumes: [{ name: 'walking', image: 'sprites/cat.png' }],
    })
    expect(sprite.costumes).not.toBe(preset.costumes)
  })

  it('fills the first free sprite id when a prior sprite was removed', () => {
    const sprite = createSpriteFromPreset([
      { id: 'sprite1', name: 'Sprite' },
      { id: 'sprite3', name: 'Sprite 3' },
    ])

    expect(sprite.id).toBe('sprite2')
    expect(sprite.name).toBe('Sprite 2')
  })
})

describe('normalizeBackdropPresets', () => {
  it('keeps named preset definitions with stable catalogue ids', () => {
    const presets = normalizeBackdropPresets([
      { id: 'space', name: 'Space', image: 'backdrops/space.png' },
      { id: 3, name: 'Invalid' },
      { id: 'empty-name', name: '' },
    ])

    expect(presets).toEqual([{ id: 'space', name: 'Space', image: 'backdrops/space.png' }])
  })
})

describe('createBackdropFromPreset', () => {
  it('copies the public definition into a new uniquely identified backdrop', () => {
    const preset = { id: 'space', name: 'Space', image: 'backdrops/space.png' }

    const backdrop = createBackdropFromPreset([{ id: 'backdrop1', name: 'Backdrop 1' }], preset)

    expect(backdrop).toEqual({ id: 'backdrop2', name: 'Space', image: 'backdrops/space.png' })
  })

  it('avoids duplicate names when the same backdrop is added twice', () => {
    const preset = { id: 'space', name: 'Space', image: 'backdrops/space.png' }
    const first = createBackdropFromPreset([{ id: 'backdrop1', name: 'Backdrop 1' }], preset)
    const second = createBackdropFromPreset([{ id: 'backdrop1', name: 'Backdrop 1' }, first], preset)

    expect(second.id).toBe('backdrop3')
    expect(second.name).toBe('Space 2')
  })

  it('falls back to a blank white backdrop with no preset', () => {
    const backdrop = createBackdropFromPreset([])
    expect(backdrop).toEqual({ id: 'backdrop1', name: 'Backdrop 1', colour: '#ffffff' })
  })
})

describe('resolvePresetLibrary', () => {
  const library = [
    { id: 'a', name: 'A' },
    { id: 'b', name: 'B' },
    { id: 'c', name: 'C' },
  ]

  it('returns the whole library when no restriction is set', () => {
    expect(resolvePresetLibrary(library, undefined)).toEqual(library)
    expect(resolvePresetLibrary(library, [])).toEqual(library)
  })

  it('narrows to the author-picked subset when restricted', () => {
    expect(resolvePresetLibrary(library, ['b'])).toEqual([{ id: 'b', name: 'B' }])
  })

  it('handles a missing library gracefully', () => {
    expect(resolvePresetLibrary(undefined, ['b'])).toEqual([])
  })
})
