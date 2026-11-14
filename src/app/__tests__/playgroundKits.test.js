import { beforeEach, describe, expect, it } from 'vitest'
import {
  LAST_KIT_STORAGE_KEY,
  LANDING_PLAYGROUND_TYPES,
  BLANK_KIT,
  MAIN_KITS,
  getPythonKit,
  kitIdForPlayground,
  kitPath,
  loadLastKitId,
  pythonKitLessonId,
  saveLastKitId,
} from '../playgroundKits'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { STAGE_MODULE_PY } from '../../shared/stage/stagePy'
import { codeImportsStage } from '../../shared/stage/commands'
import { CSS_COLOURS } from '../../shared/stage/colours'
import { loadSavedCode, saveCode, studentTaskStorageKey } from '../studentStorage'

describe('playground kits', () => {
  beforeEach(() => localStorage.clear())

  it('has 5 kit cards and a separate Blank page kit', () => {
    expect(MAIN_KITS.map((k) => k.id)).toEqual(['turtle', 'game', 'picture', 'beats', 'stage'])
    expect(BLANK_KIT.id).toBe('blank')
  })

  it('routes Turtle and Game to their own playgrounds, the rest to ?kit=', () => {
    const paths = Object.fromEntries([...MAIN_KITS, BLANK_KIT].map((k) => [k.id, kitPath(k)]))
    expect(paths).toEqual({
      turtle: '/playground/turtle',
      game: '/playground/arcade',
      picture: '/playground/python?kit=picture',
      beats: '/playground/python?kit=beats',
      stage: '/playground/python?kit=stage',
      blank: '/playground/python?kit=blank',
    })
    expect(LANDING_PLAYGROUND_TYPES).not.toContain('turtle')
    expect(LANDING_PLAYGROUND_TYPES).not.toContain('arcade')
  })

  it('each Python kit remembers its own code under the existing task key format', () => {
    const ids = ['picture', 'beats', 'stage', 'blank'].map(pythonKitLessonId)
    expect(new Set(ids).size).toBe(4)
    expect(pythonKitLessonId('blank')).toBe('__playground__python')
    expect(studentTaskStorageKey(pythonKitLessonId('beats'), 1, 'anon')).toBe(
      'headstart___playground__python:beats_1_anon'
    )

    saveCode(pythonKitLessonId('beats'), 1, 'anon', { code: 'play("x...")' })
    saveCode(pythonKitLessonId('picture'), 1, 'anon', { code: 'grid(fox, width=32)' })

    expect(loadSavedCode(pythonKitLessonId('beats'), 1, 'anon').code).toBe('play("x...")')
    expect(loadSavedCode(pythonKitLessonId('picture'), 1, 'anon').code).toBe('grid(fox, width=32)')
    expect(loadSavedCode(pythonKitLessonId('blank'), 1, 'anon')).toBeNull()

    expect(studentTaskStorageKey(pythonKitLessonId('stage'), 1, 'anon')).toBe(
      'headstart___playground__python:stage_1_anon'
    )
    saveCode(pythonKitLessonId('stage'), 1, 'anon', { code: 'circle(50)' })
    expect(loadSavedCode(pythonKitLessonId('stage'), 1, 'anon').code).toBe('circle(50)')
    expect(loadSavedCode(pythonKitLessonId('beats'), 1, 'anon').code).toBe('play("x...")')
  })

  it('remembers the last kit for Carry on, ignoring unknown ids', () => {
    expect(loadLastKitId()).toBeNull()
    saveLastKitId('beats')
    expect(loadLastKitId()).toBe('beats')
    saveLastKitId('nope')
    expect(loadLastKitId()).toBe('beats')
    saveLastKitId('stage')
    expect(loadLastKitId()).toBe('stage')
    localStorage.setItem(LAST_KIT_STORAGE_KEY, 'old-kit')
    expect(loadLastKitId()).toBeNull()
  })

  it('names the kit a playground shows', () => {
    expect(kitIdForPlayground('turtle')).toBe('turtle')
    expect(kitIdForPlayground('arcade')).toBe('game')
    expect(kitIdForPlayground('python', BLANK_KIT)).toBe('blank')
    expect(kitIdForPlayground('python', getPythonKit('stage'))).toBe('stage')
    expect(kitIdForPlayground('electronics')).toBeNull()
    expect(kitIdForPlayground('scratch')).toBeNull()
  })

  it('the Stage kit opens in the Python playground; its starter uses only documented Stage calls', () => {
    const stage = getPythonKit('stage')
    expect(stage).toMatchObject({
      label: 'Stage',
      icon: '🎨',
      blurb: 'Draw shapes, words and emoji',
    })
    const code = stage.starterCode
    // Imports the stage, so the workspace shows the Stage pane for the first Run.
    expect(codeImportsStage(code)).toBe(true)

    const exported = STAGE_MODULE_PY.match(/__all__ = \[([^\]]*)\]/)[1]
    const guide = readFileSync(resolve(__dirname, '../../../docs/authoring/stage.md'), 'utf8')
    const called = [...new Set([...code.matchAll(/\b([a-z_]+)\(/g)].map((m) => m[1]))]
    const stageCalls = called.filter((name) => name !== 'range').sort()
    expect(stageCalls).toEqual(['background', 'circle', 'hue', 'stamp', 'text'])
    for (const name of stageCalls) {
      expect(exported).toContain(`'${name}'`)
      expect(guide).toContain(`| \`${name}\` |`)
    }
    // Every named colour is one the Stage knows.
    for (const [, colour] of code.matchAll(/"([a-z]+)"/g)) {
      expect(CSS_COLOURS).toHaveProperty(colour)
    }
    // An emoji on the stage on the first Run.
    expect(code).toContain('stamp("🚀"')
  })
})
