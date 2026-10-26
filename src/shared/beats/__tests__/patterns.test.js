import { describe, expect, it } from 'vitest'
import {
  BEAT_TEMPO_DEFAULT,
  BEAT_TEMPO_MAX,
  BEAT_TEMPO_MIN,
  MAX_BEAT_PARTS,
  MAX_BEAT_STEPS,
  describeBeatSong,
  isBeatCommand,
  readBeatSong,
  readPattern,
  recordBeatCall,
  stepHit,
  validateBeatCall,
} from '../patterns.js'
import { BEATS_INSTALL_PY, BEATS_MODULE_PY } from '../beatsPy.js'

const kick = 'x...x...x...x...'
const snare = '....x.......x...'
const hat = 'x.x.x.x.x.x.x.x.'

describe('validateBeatCall play()', () => {
  it('maps positional patterns to kick, snare, hat, clap in order', () => {
    expect(validateBeatCall('play', [kick, snare, hat], { tempo: 100 })).toEqual({
      command: {
        type: 'beat',
        tempo: 100,
        length: 16,
        rows: [
          { name: 'kick', steps: kick },
          { name: 'snare', steps: snare },
          { name: 'hat', steps: hat },
        ],
      },
    })
  })

  it('takes patterns by name, in the kit order whatever order they are given', () => {
    const { command } = validateBeatCall('play', [], { clap: '..x.', kick: 'x...' })
    expect(command.rows.map((row) => row.name)).toEqual(['kick', 'clap'])
    expect(command.tempo).toBe(BEAT_TEMPO_DEFAULT)
  })

  it('accepts friendly instrument spellings and None for no row', () => {
    const { command } = validateBeatCall('play', [kick, null], { hihat: 'x.x.' })
    expect(command.rows.map((row) => row.name)).toEqual(['kick', 'hat'])
  })

  it('joins a list of strings into one pattern', () => {
    expect(readPattern('kick', ['x...', 'x.x.'])).toBe('x...x.x.')
    expect(readPattern('kick', ['x', '.', 'X', '.'])).toBe('x.X.')
  })

  it('keeps the longest row as the length; shorter rows repeat', () => {
    const { command } = validateBeatCall('play', ['x...', 'x.......x.......'])
    expect(command.length).toBe(16)
    expect(stepHit('x...', 4)).toEqual({ hit: true, accent: false })
    expect(stepHit('x...', 5)).toEqual({ hit: false, accent: false })
    expect(stepHit('X.', 2)).toEqual({ hit: true, accent: true })
  })

  it('says which character is wrong, in plain words', () => {
    const { error } = validateBeatCall('play', ['x..ox...'])
    expect(error.kind).toBe('ValueError')
    expect(error.message).toBe(
      'play(): the kick pattern has "o" as its 4th character. Use x for a hit and . for a rest'
    )
    expect(validateBeatCall('play', [], { snare: 'x... x...' }).error.message).toContain(
      'has a space as its 5th character'
    )
  })

  it('refuses an empty pattern, a too-long one and a non-string', () => {
    expect(validateBeatCall('play', ['']).error.message).toContain('the kick pattern is empty')
    expect(validateBeatCall('play', ['x'.repeat(MAX_BEAT_STEPS + 1)]).error.message).toContain(
      `The most is ${MAX_BEAT_STEPS}`
    )
    const notText = validateBeatCall('play', [true])
    expect(notText.error.kind).toBe('TypeError')
    expect(notText.error.message).toContain('should be in quotes')
    expect(validateBeatCall('play', [['x...', 4]]).error.message).toContain('the kick list')
  })

  it('points a stray number at tempo=', () => {
    expect(validateBeatCall('play', [kick, 120]).error.message).toContain('tempo=120')
    expect(validateBeatCall('play', [kick, snare, hat, 'x...', 90]).error.message).toContain(
      'tempo=90'
    )
  })

  it('checks tempo is a number in range', () => {
    expect(validateBeatCall('play', [kick], { tempo: 1000 }).error).toEqual({
      kind: 'ValueError',
      message: `play(): tempo goes from ${BEAT_TEMPO_MIN} (slow) to ${BEAT_TEMPO_MAX} (very fast), not 1000`,
    })
    const text = validateBeatCall('play', [kick], { tempo: '120' }).error
    expect(text.kind).toBe('TypeError')
    expect(text.message).toContain('(try int())')
    expect(validateBeatCall('play', [kick], { tempo: 99.96 }).command.tempo).toBe(100)
  })

  it('needs at least one pattern and knows its instruments', () => {
    expect(validateBeatCall('play', []).error.message).toContain('needs at least one pattern')
    expect(validateBeatCall('play', [], { drum: 'x' }).error.message).toContain(
      'no instrument called "drum"'
    )
    expect(validateBeatCall('play', [kick], { kick: kick }).error.message).toContain('twice')
  })
})

describe('validateBeatCall stop()', () => {
  it('records a stop and takes no arguments', () => {
    expect(validateBeatCall('stop', [])).toEqual({ command: { type: 'beat_stop' } })
    expect(validateBeatCall('stop', [1]).error.kind).toBe('TypeError')
  })
})

describe('recordBeatCall', () => {
  it("appends to the Stage recorder's commands and answers ''", () => {
    const recorder = { commands: [{ type: 'circle' }] }
    expect(recordBeatCall(recorder, 'play', [kick])).toBe('')
    expect(recordBeatCall(recorder, 'stop', [])).toBe('')
    expect(recorder.commands.map((c) => c.type)).toEqual(['circle', 'beat', 'beat_stop'])
  })

  it("answers 'Kind|message' for a bad call and records nothing", () => {
    const recorder = { commands: [] }
    expect(recordBeatCall(recorder, 'play', ['?'])).toMatch(/^ValueError\|play\(\): /)
    expect(recorder.commands).toEqual([])
  })

  it('caps the play() calls in one run and the whole command list', () => {
    const recorder = { commands: [] }
    for (let i = 0; i < MAX_BEAT_PARTS; i++) recordBeatCall(recorder, 'play', ['x'])
    expect(recordBeatCall(recorder, 'play', ['x'])).toMatch(/^RuntimeError\|/)
    expect(recordBeatCall({ commands: [{}] }, 'stop', [], {}, { maxCommands: 1 })).toMatch(
      /^RuntimeError\|/
    )
  })
})

describe('readBeatSong', () => {
  const beat = (steps, tempo = 100) => validateBeatCall('play', [steps], { tempo }).command

  it('is null when no beat was played', () => {
    expect(readBeatSong([{ type: 'circle' }])).toBeNull()
    expect(readBeatSong(null)).toBeNull()
  })

  it('plays every part in order', () => {
    const song = readBeatSong([beat('x...'), { type: 'rect' }, beat('x.x.', 120)])
    expect(song.autoPlay).toBe(true)
    expect(song.parts.map((p) => p.tempo)).toEqual([100, 120])
  })

  it('drops the parts before stop(), and shows (but does not play) the ones stop() ended', () => {
    expect(readBeatSong([beat('x...'), { type: 'beat_stop' }, beat('xx..')]).parts).toHaveLength(1)
    const stopped = readBeatSong([beat('x...'), { type: 'beat_stop' }])
    expect(stopped).toEqual({ parts: [expect.objectContaining({ length: 4 })], autoPlay: false })
  })

  it('reads a synced beat whose rows came back from Firebase as an object', () => {
    const song = readBeatSong([
      { type: 'beat', tempo: 90, rows: { 0: { name: 'kick', steps: 'x.' }, 1: { name: 'x' } } },
    ])
    expect(song.parts[0]).toEqual({ tempo: 90, length: 2, rows: [{ name: 'kick', steps: 'x.' }] })
  })

  it('tells beat commands from drawings', () => {
    expect(isBeatCommand({ type: 'beat' })).toBe(true)
    expect(isBeatCommand({ type: 'beat_stop' })).toBe(true)
    expect(isBeatCommand({ type: 'grid' })).toBe(false)
  })

  it('describes the beat in words, steps counted from 0', () => {
    const song = readBeatSong([validateBeatCall('play', ['x...x...', '....x...']).command])
    expect(describeBeatSong(song)).toBe(
      'Beat grid, steps counted from 0. 8 steps at 100 beats a minute; kick on steps 0, 4; snare on step 4.'
    )
  })
})

describe('the beats Python module source', () => {
  it('exports play and stop only, and calls the bridge', () => {
    expect(BEATS_MODULE_PY).toContain("__all__ = ['play', 'stop']")
    expect(BEATS_MODULE_PY).toContain('def play(*args, **kwargs):')
    expect(BEATS_MODULE_PY).toContain('def stop(*args, **kwargs):')
    expect(BEATS_MODULE_PY).toContain('__hsBeatsCall')
    expect(BEATS_INSTALL_PY).toContain("_hs_sys.modules['beats']")
    expect(BEATS_INSTALL_PY).toContain("'<beats>'")
  })
})
