import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StudentView from '../../../app/views/StudentView'
import { getActivityDefinition } from '../../registry.pure.js'

// Real click-through: renders the real StudentView → LessonTaskContent → ActivityHost →
// useActivityState chain for a lesson containing this activity, mocking only Firebase-backed
// hooks. Unit tests of a view can pass while the real classroom crashes; this catches that.
// (Skipped inside src/activities/_template, which is never registered.)
// One tap is a discrete change (mirrored to the tutor's card); tapping the last pair of the round
// finishes the activity (completion: 'auto').

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
  id: 'real_or_ai-click',
  title: 'Real or AI click-through',
  type: 'python',
  tasks: [
    {
      id: 1,
      title: 'Spot the AI',
      taskType: 'activity',
      activityType: 'real_or_ai',
      items: [
        {
          id: 'p1',
          kind: 'text',
          a: 'Human text',
          b: 'Robot text',
          answer: 'b',
          tell: 'too_smooth',
          reliable: true,
          reveal: 'Very even wording.',
        },
      ],
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

describe.skipIf(!getActivityDefinition('real_or_ai'))(
  'Real or AI StudentView click-through',
  () => {
    it('renders in the classroom and finishes on the tap that completes the round', async () => {
      const user = userEvent.setup()
      render(<StudentView lessonId={LESSON.id} lesson={LESSON} />)
      await user.click(await screen.findByTestId('real_or_ai-side-b'))
      expect(screen.queryByRole('button', { name: 'Run' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Check my work' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Reveal' })).not.toBeInTheDocument()
      await waitFor(() => expect(mocks.session.writeStudentRun).toHaveBeenCalled())
      const [studentId, run] = mocks.session.writeStudentRun.mock.calls[0]
      expect(studentId).toBe('student-1')
      expect(run).toMatchObject({ status: 'submitted', checkPassed: true })
      expect(JSON.parse(run.answer)).toEqual({
        v: 1,
        right: 1,
        items: { p1: { pick: 'b', done: true } },
      })
      expect(screen.getByTestId('real_or_ai-reveal')).toHaveTextContent(
        /Right!\s*B is the AI one\./
      )
      expect(mocks.session.writeStudentCode).not.toHaveBeenCalled()
    })
  }
)
