import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StudentView from '../../../app/views/StudentView'
import { getActivityDefinition } from '../../registry.pure.js'

// Real click-through: renders the real StudentView → LessonTaskContent → ActivityHost →
// useActivityState chain for a lesson containing this activity, mocking only Firebase-backed
// hooks. Unit tests of a view can pass while the real classroom crashes; this catches that.
// (Skipped inside src/activities/_template, which is never registered.)

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

// A live session on task `currentTaskId`. Every writer useSession exposes is a spy.
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
  id: 'game_agent-click',
  title: 'Game agent click-through',
  type: 'python',
  tasks: [
    {
      id: 1,
      title: 'Train the robot',
      taskType: 'activity',
      activityType: 'game_agent',
      map: ['#####', '#R..#', '#.#T#', '#####'],
      episodes: 50,
    },
  ],
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
      'Date',
    ],
  })
  localStorage.clear()
  mocks.session = makeSession(LESSON.id)
  mocks.identity = {
    identity: { anonymousId: 'student-1', displayName: 'Sam', lastSessionTimestamp: 456 },
    loaded: true,
    createIdentity: vi.fn(),
    updateTimestamp: vi.fn(),
    updateDisplayName: vi.fn(),
  }
})
afterEach(() => vi.useRealTimers())

const advance = (ms) => act(async () => void vi.advanceTimersByTime(ms))

describe.skipIf(!getActivityDefinition('game_agent'))(
  'Game agent StudentView click-through',
  () => {
    it('trains, goes, and passes when the robot reaches the treasure (no Run or Check button)', async () => {
      render(<StudentView lessonId={LESSON.id} lesson={LESSON} />)
      await advance(100)
      const train = screen.getByRole('button', { name: 'Train (50 tries)' })
      expect(screen.queryByRole('button', { name: 'Run' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Check my work' })).not.toBeInTheDocument()

      fireEvent.click(train)
      await advance(30000)
      expect(screen.getByTestId('ga-stats')).toHaveTextContent('Tries: 50')
      // Training progress is never written as a pass.
      expect(mocks.session.writeStudentRun).not.toHaveBeenCalled()

      fireEvent.click(screen.getByRole('button', { name: 'Go!' }))
      await advance(3000)
      await advance(1000) // the host debounces the answer write
      const calls = mocks.session.writeStudentRun.mock.calls
      expect(calls.length).toBeGreaterThan(0)
      const [id, written] = calls[calls.length - 1]
      expect(id).toBe('student-1')
      expect(written).toMatchObject({ status: 'submitted', checkPassed: true })
      expect(JSON.parse(written.answer)).toMatchObject({
        trained: 50,
        reached: true,
        moves: 'RRD',
        bestScore: 8,
      })
      expect(mocks.session.writeStudentCode).not.toHaveBeenCalled()
    })
  }
)
