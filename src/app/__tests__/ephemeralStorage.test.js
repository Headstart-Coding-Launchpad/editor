import { describe, it, expect, beforeEach } from 'vitest'
import { ephemeralStorage, clearEphemeralStorage } from '../studentStorage'
import { createStudentPersistence } from '../../app/hooks/createStudentPersistence'

beforeEach(() => {
  clearEphemeralStorage()
  localStorage.clear()
})

describe('ephemeralStorage', () => {
  it('round-trips code saves without touching localStorage', () => {
    const states = { player: { blocks: { languageVersion: 0, blocks: [] } } }
    ephemeralStorage.saveCode('lesson-1', 1, 'teacher-presenter', { state: states })
    expect(ephemeralStorage.loadSavedCode('lesson-1', 1, 'teacher-presenter')).toEqual({ state: states })
    expect(localStorage.length).toBe(0)
  })

  it('is keyed by lesson, task, and actor', () => {
    ephemeralStorage.saveCode('lesson-1', 1, 'a', { code: 'x' })
    expect(ephemeralStorage.loadSavedCode('lesson-1', 2, 'a')).toBeNull()
    expect(ephemeralStorage.loadSavedCode('lesson-1', 1, 'b')).toBeNull()
    expect(ephemeralStorage.loadSavedCode('lesson-2', 1, 'a')).toBeNull()
  })

  it('JSON round-trips values (no object aliasing)', () => {
    const data = { state: { player: { x: 1 } } }
    ephemeralStorage.saveCode('lesson-1', 1, 'a', data)
    data.state.player.x = 99
    expect(ephemeralStorage.loadSavedCode('lesson-1', 1, 'a').state.player.x).toBe(1)
  })

  it('saves and loads files and fs state', () => {
    ephemeralStorage.saveFile('lesson-1', 1, 'index.html', 'a', '<p/>')
    expect(ephemeralStorage.loadSavedFile('lesson-1', 1, 'index.html', 'a')).toBe('<p/>')
    const fs = { '/': { type: 'dir', children: {} } }
    ephemeralStorage.saveFsState('lesson-1', 2, 'a', fs)
    expect(ephemeralStorage.loadSavedFs('lesson-1', 2, 'a')).toEqual(fs)
  })

  it('clearEphemeralStorage wipes everything', () => {
    ephemeralStorage.saveCode('lesson-1', 1, 'a', { code: 'x' })
    clearEphemeralStorage()
    expect(ephemeralStorage.loadSavedCode('lesson-1', 1, 'a')).toBeNull()
  })
})

describe('persistence write→read round trip in presentation mode', () => {
  it('scratch state saved while presenting is readable for carry-through', () => {
    const persistence = createStudentPersistence({
      lessonId: 'lesson-rt',
      teacherPresentation: true,
      previewMode: false,
      inPersonalSandboxRef: { current: false },
    })
    const states = { player: { blocks: { languageVersion: 0, blocks: [{ type: 'event_whenflagclicked' }] } } }
    persistence.saveScratch('teacher-presenter', 13, states)
    expect(persistence.readSavedCode('teacher-presenter', 13)).toEqual({ state: states })
    expect(persistence.readSavedCode('teacher-presenter', 14)).toBeNull()
    expect(localStorage.length).toBe(0)
  })
})
