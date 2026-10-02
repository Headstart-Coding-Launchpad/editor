import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('emoji-picker-react', () => ({
  default: ({ onEmojiClick }) => (
    <button type="button" onClick={() => onEmojiClick({ emoji: '🐶', names: ['dog face'] })}>
      mock emoji
    </button>
  ),
  EmojiStyle: { NATIVE: 'native' },
}))

import {
  addCostumeToSprite,
  addSoundToSprite,
  collectAddedSpriteAssets,
  libraryCostumeOptions,
  mergeAddedSpriteAssets,
} from '../ScratchWorkspace'
import { CostumesTab, SoundsTab } from '../CostumesSoundsPanel.jsx'
import { DEFAULT_SPRITE_SOUNDS, SYNTH_SOUNDS } from '../scratchSounds.js'

describe('adding costumes and sounds to a sprite', () => {
  it('keeps an emoji/shape sprite\'s own look as "costume1" before the first added costume', () => {
    const { sprite, costume } = addCostumeToSprite(
      { id: 's', emoji: '🐱' },
      { name: 'dog', emoji: '🐶' }
    )
    expect(sprite.costumes).toEqual([
      { name: 'costume1', studentAdded: true },
      { name: 'dog', emoji: '🐶', studentAdded: true },
    ])
    expect(costume.name).toBe('dog')
  })

  it('appends to authored costumes with a unique name', () => {
    const { sprite } = addCostumeToSprite(
      { id: 's', costumes: [{ name: 'dog', image: 'a.png' }] },
      { name: 'dog', emoji: '🐶' }
    )
    expect(sprite.costumes.map((c) => c.name)).toEqual(['dog', 'dog 2'])
  })

  it('adds a sound after the default sounds when the sprite had none', () => {
    const sprite = addSoundToSprite({ id: 's' }, { name: 'coin', synth: 'coin' })
    expect(sprite.sounds).toEqual([
      ...DEFAULT_SPRITE_SOUNDS,
      { name: 'coin', synth: 'coin', studentAdded: true },
    ])
  })
})

describe('saving and restoring added costumes/sounds (__meta__)', () => {
  const authored = [
    { id: 'cat', costumes: [{ name: 'c1', image: 'c1.png' }] },
    { id: 'dog' },
    { id: 'mine', studentAdded: true, costumes: [{ name: 'x', emoji: '⭐', studentAdded: true }] },
  ]

  it('collects only additions on authored sprites', () => {
    let sprites = authored.map((sp) =>
      sp.id === 'cat' ? addCostumeToSprite(sp, { name: 'star', emoji: '⭐' }).sprite : sp
    )
    sprites = sprites.map((sp) =>
      sp.id === 'dog' ? addSoundToSprite(sp, { name: 'bark', audio: 'b.mp3' }) : sp
    )
    expect(collectAddedSpriteAssets(sprites)).toEqual({
      addedCostumes: { cat: [{ name: 'star', emoji: '⭐', studentAdded: true }] },
      addedSounds: { dog: [{ name: 'bark', audio: 'b.mp3', studentAdded: true }] },
    })
  })

  it('round-trips, and re-applying is a no-op that returns the same array', () => {
    const addedCostumes = { cat: [{ name: 'star', emoji: '⭐', studentAdded: true }] }
    const addedSounds = { dog: [{ name: 'bark', audio: 'b.mp3', studentAdded: true }] }
    const restored = mergeAddedSpriteAssets(authored, addedCostumes, addedSounds)
    expect(restored).not.toBe(authored)
    expect(restored[0].costumes.map((c) => c.name)).toEqual(['c1', 'star'])
    expect(restored[1].sounds.map((s) => s.name)).toEqual(['pop', 'meow', 'click', 'chime', 'bark'])
    expect(collectAddedSpriteAssets(restored)).toEqual({ addedCostumes, addedSounds })
    expect(mergeAddedSpriteAssets(restored, addedCostumes, addedSounds)).toBe(restored)
  })

  it('never touches student-added sprites (they carry their own lists)', () => {
    const out = mergeAddedSpriteAssets(authored, { mine: [{ name: 'y', emoji: '🌙' }] }, {})
    expect(out).toBe(authored)
  })
})

describe('libraryCostumeOptions', () => {
  it('flattens image/emoji costumes and emoji-only sprites, skipping shape-only ones', () => {
    expect(
      libraryCostumeOptions([
        {
          id: 'a',
          name: 'Cat',
          costumes: [
            { name: 'cat-a', image: 'a.png' },
            { name: 'cat-b', emoji: '😺' },
          ],
        },
        { id: 'b', name: 'Fish', emoji: '🐟' },
        { id: 'c', name: 'Ball', type: 'ball' },
      ])
    ).toEqual([
      { key: 'a:0', name: 'cat-a', image: 'a.png' },
      { key: 'a:1', name: 'cat-b', emoji: '😺' },
      { key: 'b', name: 'Fish', emoji: '🐟' },
    ])
  })
})

describe('CostumesTab', () => {
  const sprite = { id: 'cat', name: 'Cat', costumes: [{ name: 'one' }, { name: 'two' }] }
  const base = {
    sprite,
    currentCostume: 'two',
    readOnly: false,
    libraryCostumes: [{ key: 'k', name: 'Star', emoji: '⭐' }],
    renderCostumeThumb: () => null,
    onSelectCostume: vi.fn(),
    onAddCostume: vi.fn(),
  }

  it('lists costumes, marks the current one, and wears a clicked one', () => {
    const onSelectCostume = vi.fn()
    render(<CostumesTab {...base} canAdd={false} onSelectCostume={onSelectCostume} />)
    expect(screen.getByRole('option', { name: /two/ })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('button', { name: /add costume/i })).toBeNull()
    fireEvent.click(screen.getByRole('option', { name: /one/ }))
    expect(onSelectCostume).toHaveBeenCalledWith('one')
  })

  it('adds a library costume or an emoji when adding is allowed', () => {
    const onAddCostume = vi.fn()
    render(<CostumesTab {...base} canAdd onAddCostume={onAddCostume} />)
    fireEvent.click(screen.getByRole('button', { name: /add costume/i }))
    fireEvent.click(screen.getByRole('option', { name: /Star/ }))
    expect(onAddCostume).toHaveBeenCalledWith({ name: 'Star', emoji: '⭐' })
    fireEvent.click(screen.getByRole('button', { name: /add costume/i }))
    fireEvent.click(screen.getByRole('button', { name: 'mock emoji' }))
    expect(onAddCostume).toHaveBeenLastCalledWith({ name: 'dog face', emoji: '🐶' })
  })
})

describe('SoundsTab', () => {
  it('previews sounds, and adds a synth or a library file', () => {
    const onPreviewSound = vi.fn()
    const onAddSound = vi.fn()
    render(
      <SoundsTab
        sprite={{ id: 'cat', name: 'Cat' }}
        sounds={DEFAULT_SPRITE_SOUNDS}
        canAdd
        audioLibrary={[
          { id: 'sound1', name: 'Bark', audio: 'https://x/b.mp3', url: 'https://x/b.mp3' },
        ]}
        onPreviewSound={onPreviewSound}
        onAddSound={onAddSound}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Play meow' }))
    expect(onPreviewSound).toHaveBeenCalledWith({ name: 'meow', synth: 'meow' })

    fireEvent.click(screen.getByRole('button', { name: /add sound/i }))
    expect(screen.getAllByRole('button', { name: /^Add / })).toHaveLength(SYNTH_SOUNDS.length + 1)
    fireEvent.click(screen.getByRole('button', { name: 'Add laser' }))
    expect(onAddSound).toHaveBeenCalledWith({ name: 'laser', synth: 'laser' })

    fireEvent.click(screen.getByRole('button', { name: /add sound/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Bark' }))
    expect(onAddSound).toHaveBeenLastCalledWith({ name: 'Bark', audio: 'https://x/b.mp3' })
  })
})
