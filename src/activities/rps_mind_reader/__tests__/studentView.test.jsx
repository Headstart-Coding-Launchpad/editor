import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  id: 'rps_mind_reader-click',
  title: 'Mind Reader click-through',
  type: 'python',
  tasks: [
    {
      id: 1,
      title: 'Beat the Mind Reader',
      taskType: 'activity',
      activityType: 'rps_mind_reader',
      rounds: 6,
      passAt: 3,
    },
  ],
}

beforeEach(() => {
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

// The template is scaffolding for npm run new:activity / new:module and is not registered, so
// this click-through skips here on purpose; a copied activity's test asserts registration.
describe.skipIf(!getActivityDefinition('rps_mind_reader'))(
  'Mind Reader StudentView click-through',
  () => {
    it('renders in the classroom, plays rounds with real taps and passes at passAt', async () => {
      const user = userEvent.setup()
      render(<StudentView lessonId={LESSON.id} lesson={LESSON} />)
      expect(await screen.findByText('It has chosen')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Run' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Check my work' })).not.toBeInTheDocument()
      for (let r = 0; r < 3; r += 1) {
        await user.click(await screen.findByRole('button', { name: 'Rock' }))
        await waitFor(() => expect(screen.getByRole('button', { name: 'Rock' })).toBeEnabled(), {
          timeout: 3000,
        })
      }
      await waitFor(() =>
        expect(mocks.session.writeStudentRun).toHaveBeenCalledWith(
          'student-1',
          expect.objectContaining({ status: 'submitted', checkPassed: true })
        )
      )
      const sent = JSON.parse(mocks.session.writeStudentRun.mock.calls.at(-1)[1].answer)
      expect(sent.moves).toBe('000')
      expect(sent.picks).toHaveLength(3)
      expect(mocks.session.writeStudentCode).not.toHaveBeenCalled()
    })
  }
)
