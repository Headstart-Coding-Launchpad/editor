import { beforeEach, describe, expect, it } from 'vitest'
import {
  LAST_KIT_STORAGE_KEY,
  LANDING_PLAYGROUND_TYPES,
  BLANK_KIT,
  MAIN_KITS,
  kitIdForPlayground,
  kitPath,
  loadLastKitId,
  pythonKitLessonId,
  saveLastKitId,
} from '../playgroundKits'
import { loadSavedCode, saveCode, studentTaskStorageKey } from '../studentStorage'

describe('playground kits', () => {
  beforeEach(() => localStorage.clear())

  it('has 4 kit cards and a separate Blank page kit', () => {
    expect(MAIN_KITS.map((k) => k.id)).toEqual(['turtle', 'game', 'picture', 'beats'])
    expect(BLANK_KIT.id).toBe('blank')
  })

  it('routes Turtle and Game to their own playgrounds, the rest to ?kit=', () => {
    const paths = Object.fromEntries([...MAIN_KITS, BLANK_KIT].map((k) => [k.id, kitPath(k)]))
    expect(paths).toEqual({
      turtle: '/playground/turtle',
      game: '/playground/arcade',
      picture: '/playground/python?kit=picture',
      beats: '/playground/python?kit=beats',
      blank: '/playground/python?kit=blank',
    })
    expect(LANDING_PLAYGROUND_TYPES).not.toContain('turtle')
    expect(LANDING_PLAYGROUND_TYPES).not.toContain('arcade')
  })

  it('each Python kit remembers its own code under the existing task key format', () => {
    const ids = ['picture', 'beats', 'blank'].map(pythonKitLessonId)
    expect(new Set(ids).size).toBe(3)
    expect(pythonKitLessonId('blank')).toBe('__playground__python')
    expect(studentTaskStorageKey(pythonKitLessonId('beats'), 1, 'anon')).toBe(
      'headstart___playground__python:beats_1_anon'
    )

    saveCode(pythonKitLessonId('beats'), 1, 'anon', { code: 'play("x...")' })
    saveCode(pythonKitLessonId('picture'), 1, 'anon', { code: 'grid(fox, width=32)' })

    expect(loadSavedCode(pythonKitLessonId('beats'), 1, 'anon').code).toBe('play("x...")')
    expect(loadSavedCode(pythonKitLessonId('picture'), 1, 'anon').code).toBe('grid(fox, width=32)')
    expect(loadSavedCode(pythonKitLessonId('blank'), 1, 'anon')).toBeNull()
  })

  it('remembers the last kit for Carry on, ignoring unknown ids', () => {
    expect(loadLastKitId()).toBeNull()
    saveLastKitId('beats')
    expect(loadLastKitId()).toBe('beats')
    saveLastKitId('nope')
    expect(loadLastKitId()).toBe('beats')
    localStorage.setItem(LAST_KIT_STORAGE_KEY, 'old-kit')
    expect(loadLastKitId()).toBeNull()
  })

  it('names the kit a playground shows', () => {
    expect(kitIdForPlayground('turtle')).toBe('turtle')
    expect(kitIdForPlayground('arcade')).toBe('game')
    expect(kitIdForPlayground('python', BLANK_KIT)).toBe('blank')
    expect(kitIdForPlayground('electronics')).toBeNull()
    expect(kitIdForPlayground('scratch')).toBeNull()
  })
})
