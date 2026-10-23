import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StudentView from '../../../app/views/StudentView'
import { getActivityDefinition } from '../../registry.pure.js'

// Real click-through: renders the real StudentView → LessonTaskContent → ActivityHost →
// useActivityState chain for a lesson containing the Space station, mocking only Firebase-backed
// hooks. Drives the real controls and asserts what is written: the station is marked as you go
// (no Run or Check button) and the shared answer keeps at most one undo step.

const mocks = vi.hoisted(() => ({ session: null, identity: null }))

vi.mock('../../../shared/lessonService', () => ({
  fetchLessonById: vi.fn(() => Promise.resolve(null)),
  findSoloCompanion: vi.fn(() => Promise.resolve(null)),
  applyLessonOverride: (lesson, overrideTasks) =>
    overrideTasks ? { ...lesson, tasks: overrideTasks } : lesson,
}))

vi.mock('../../../shared/useLessonStorageAssets', () => ({
  useLessonStorageAssets: () => ({
    storageAssets: [],
    folderAssets: [],
    loading: false,
    error: null,
    refresh: () => Promise.resolve(),
  }),
}))

vi.mock('../../../shared/useTypeAssets', () => ({
  useTypeAssets: () => ({
    typeStorageAssets: [],
    defaultSprites: [],
    defaultBackdrops: [],
    loading: false,
    error: null,
  }),
}))

vi.mock('../../../app/hooks/useSession', () => ({ useSession: () => mocks.session }))
vi.mock('../../../app/hooks/useIdentity', () => ({ useIdentity: () => mocks.identity }))

function makeSession(lessonId, currentTaskId = 1) {
  const writers = new Map()
  const values = {
    session: {
      lessonId,
      state: 'active',
      createdAt: 456,
      currentTaskId,
      students: { 'student-1': { displayName: 'Sam' } },
    },
    loading: false,
    connected: true,
  }
  return new Proxy(values, {
    get(target, prop) {
      if (prop in target) return target[prop]
      if (typeof prop !== 'string' || prop === 'then') return undefined
      if (!writers.has(prop))
        writers.set(
          prop,
          vi.fn(() => Promise.resolve())
        )
      return writers.get(prop)
    },
  })
}

const LESSON = {
  id: 'station-click',
  title: 'Station click-through',
  type: 'python',
  tasks: [
    {
      id: 1,
      title: 'Power up the station',
      taskType: 'activity',
      activityType: 'station',
      lesson: 1,
      items: [
        { id: 'core', goal: 'power_on', target: 'core' },
        { id: 'hull', goal: 'pick_colour', target: 'hull' },
      ],
    },
  ],
}

// The station needs a mouse or trackpad; jsdom reports none unless the media query matches.
function mockFinePointer() {
  window.matchMedia = (query) => ({
    matches: /any-pointer:\s*fine/.test(query),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

beforeEach(() => {
  localStorage.clear()
  mockFinePointer()
  mocks.session = makeSession(LESSON.id)
  mocks.identity = {
    identity: { anonymousId: 'student-1', displayName: 'Sam', lastSessionTimestamp: 456 },
    loaded: true,
    createIdentity: vi.fn(),
    updateTimestamp: vi.fn(),
    updateDisplayName: vi.fn(),
  }
})

describe.skipIf(!getActivityDefinition('station'))('Station StudentView click-through', () => {
  it('lights a section and picks a colour, marks the task as you go and shares the goals', async () => {
    render(<StudentView lessonId={LESSON.id} lesson={LESSON} />)
    await screen.findByTestId('station-activity')
    expect(screen.queryByRole('button', { name: 'Run' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Check my work' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('activity-blocked')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Core power' }))
    expect(screen.getByTestId('section-core')).toHaveAttribute('data-lit', 'true')
    expect(screen.queryByText('Station upgraded!')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Hull colour green' }))
    expect(screen.getByText('Station upgraded!')).toBeInTheDocument()

    // The card update carries the scene and how each goal was done, and at most one undo step.
    await waitFor(() => {
      const sent = mocks.session.writeStudentAnswer.mock.calls
      expect(sent.length).toBeGreaterThan(0)
      const last = JSON.parse(sent[sent.length - 1][1])
      expect(last.scene.power.core).toBe(true)
      expect(last.scene.hull).toBe('green')
      expect(last.done.core.method).toBe('click')
      expect(last.done.hull.method).toBe('click')
      expect(last.undo.length).toBeLessThanOrEqual(1)
    })

    // Reaching the goals marks the task, with no Check button.
    await waitFor(() => expect(mocks.session.writeStudentRun).toHaveBeenCalled())
    const [id, run] = mocks.session.writeStudentRun.mock.calls[0]
    expect(id).toBe('student-1')
    expect(run.status).toBe('submitted')
    expect(run.checkPassed).toBe(true)
    expect(JSON.parse(run.answer).done.hull).toBeTruthy()
    expect(mocks.session.writeStudentCode).not.toHaveBeenCalled()
  }, 20000)
})
