// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('blockly', () => ({ default: {} }))

const played = []
vi.mock('../scratchSounds.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    playScratchSound: vi.fn(async (sound) => {
      played.push(sound)
    }),
    stopAllScratchSounds: vi.fn(),
  }
})

import {
  DEFAULT_SPRITE_SOUNDS,
  SYNTH_SOUNDS,
  getSynthSound,
  normalizeSoundPresets,
  resolveSpriteSounds,
  synthDuration,
  uniqueItemName,
  validateScratchSoundsAndTabs,
} from '../scratchSounds.js'
import { createRunSignal, runAllSprites } from '../scratch'

describe('synth sound library', () => {
  it('has unique ids, and every layer has a positive duration', () => {
    const ids = SYNTH_SOUNDS.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const synth of SYNTH_SOUNDS) {
      expect(synth.layers.length).toBeGreaterThan(0)
      for (const layer of synth.layers) expect(layer.duration).toBeGreaterThan(0)
      expect(synthDuration(synth)).toBeGreaterThan(0)
    }
  })

  it('keeps the four original tones as the defaults, by name', () => {
    expect(DEFAULT_SPRITE_SOUNDS.map((s) => s.name)).toEqual(['pop', 'meow', 'click', 'chime'])
    for (const snd of DEFAULT_SPRITE_SOUNDS) expect(getSynthSound(snd.synth)).not.toBeNull()
  })
})

describe('resolveSpriteSounds', () => {
  it('falls back to the defaults when a sprite has no sounds', () => {
    expect(resolveSpriteSounds({})).toBe(DEFAULT_SPRITE_SOUNDS)
    expect(resolveSpriteSounds({ sounds: [] })).toBe(DEFAULT_SPRITE_SOUNDS)
  })

  it("uses a sprite's own sounds when it has some", () => {
    const sounds = [{ name: 'bark', audio: 'bark.mp3' }]
    expect(resolveSpriteSounds({ sounds })).toBe(sounds)
  })
})

describe('uniqueItemName / normalizeSoundPresets', () => {
  it('suffixes a clashing name', () => {
    expect(uniqueItemName('pop', [{ name: 'pop' }, { name: 'pop 2' }])).toBe('pop 3')
    expect(uniqueItemName('new', [{ name: 'pop' }])).toBe('new')
  })

  it('drops library entries without an id, name or audio', () => {
    expect(
      normalizeSoundPresets([
        { id: 'a', name: 'A', audio: 'https://x/a.mp3' },
        { id: 'b', name: 'B', audio: '' },
        { name: 'C', audio: 'c.mp3' },
        null,
      ])
    ).toEqual([{ id: 'a', name: 'A', audio: 'https://x/a.mp3' }])
    expect(normalizeSoundPresets('nope')).toEqual([])
  })
})

describe('validateScratchSoundsAndTabs', () => {
  function run(task) {
    const errors = []
    const warnings = []
    validateScratchSoundsAndTabs(task, 1, errors, warnings)
    return { errors, warnings }
  }

  it('accepts valid sounds and flags', () => {
    expect(
      run({
        showCostumesTab: true,
        showSoundsTab: true,
        allowAddCostume: true,
        allowAddSound: true,
        sprites: [
          {
            name: 'Cat',
            sounds: [
              { name: 'pop', synth: 'pop' },
              { name: 'bark', audio: 'b.mp3' },
            ],
          },
        ],
      })
    ).toEqual({ errors: [], warnings: [] })
  })

  it('rejects non-boolean flags and malformed sounds', () => {
    const { errors } = run({
      showSoundsTab: 'yes',
      sprites: [
        {
          name: 'Cat',
          sounds: [
            { name: 'a', synth: 'nope' },
            { name: 'a', audio: 'a.mp3' },
            { name: 'both', synth: 'pop', audio: 'x.mp3' },
            { synth: 'pop' },
          ],
        },
        { name: 'Dog', sounds: 'pop' },
      ],
    })
    expect(errors).toEqual([
      'Task 1 showSoundsTab must be true or false',
      expect.stringContaining('unknown synth "nope"'),
      'Task 1 sprite "Cat" has two sounds named "a"',
      'Task 1 sprite "Cat" sound "both" needs exactly one of synth or audio',
      'Task 1 sprite "Cat" has a sound with no name',
      'Task 1 sprite "Dog" sounds must be a list',
    ])
  })

  it('warns when an add flag is on without its tab', () => {
    expect(run({ allowAddCostume: true, allowAddSound: true }).warnings).toEqual([
      'Task 1 allowAddCostume has no effect without showCostumesTab',
      'Task 1 allowAddSound has no effect without showSoundsTab',
    ])
  })
})

// ── Interpreter: `start sound` plays the running sprite's own sound ───────────

function soundWorkspace(soundName) {
  const play = {
    type: 'sound_playuntildone',
    getFieldValue: (name) => (name === 'SOUND_MENU' ? soundName : null),
    getInputTargetBlock: () => null,
    getNextBlock: () => null,
  }
  const hat = {
    type: 'event_whenflagclicked',
    getFieldValue: () => null,
    getInputTargetBlock: () => null,
    getNextBlock: () => play,
  }
  return { getBlocksByType: (type) => (type === 'event_whenflagclicked' ? [hat] : []) }
}

function sprite(id, workspace, sounds) {
  return {
    id,
    workspace,
    state: { x: 0, y: 0, direction: 90, size: 100, visible: true, costume: null },
    costumes: [],
    sounds,
    onUpdate: () => {},
  }
}

describe('sound blocks at run time', () => {
  beforeEach(() => {
    played.length = 0
  })

  it("plays the sound with that name from the sprite's own list", async () => {
    const bark = { name: 'bark', audio: 'bark.mp3', url: 'https://x/bark.mp3' }
    await runAllSprites(
      [
        sprite('dog', soundWorkspace('bark'), [bark]),
        sprite('cat', soundWorkspace('bark'), [{ name: 'bark', synth: 'meow' }]),
      ],
      createRunSignal()
    )
    expect(played).toContainEqual(bark)
    expect(played).toContainEqual({ name: 'bark', synth: 'meow' })
  })

  it('falls back to the built-in synth of the same id for old blocks, then to pop', async () => {
    await runAllSprites([sprite('a', soundWorkspace('chime'), null)], createRunSignal())
    await runAllSprites(
      [sprite('b', soundWorkspace('gone'), [{ name: 'bark', audio: 'b.mp3' }])],
      createRunSignal()
    )
    expect(played).toEqual([{ name: 'chime', synth: 'chime' }, { synth: 'pop' }])
  })
})
