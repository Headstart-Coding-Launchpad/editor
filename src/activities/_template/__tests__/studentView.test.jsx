import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StudentView from '../../../app/views/StudentView'
import { getActivityDefinition } from '../../registry.pure.js'

// Real click-through: renders the real StudentView → LessonTaskContent → ActivityHost →
// useActivityState chain for a lesson containing this activity, mocking only Firebase-backed
// hooks. Unit tests of a view can pass while the real classroom crashes; this catches that.
// (Skipped inside src/activities/_template, which is never registered.)
// TODO(new-activity): drive the real controls of your activity and assert what is written.

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
  id: 'template_activity-click',
  title: 'Template Activity click-through',
  type: 'python',
  tasks: [
    {
      id: 1,
      title: 'Answer the questions',
      taskType: 'activity',
      activityType: 'template_activity',
      items: [{ id: 'a', prompt: 'What is 2 + 2?', answer: '4' }],
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

describe.skipIf(!getActivityDefinition('template_activity'))(
  'Template Activity StudentView click-through',
  () => {
    it('renders in the classroom, has no Run button and reports a passing Check', async () => {
      const user = userEvent.setup()
      render(<StudentView lessonId={LESSON.id} lesson={LESSON} />)
      await user.type(await screen.findByLabelText('Your answer'), '4')
      expect(screen.queryByRole('button', { name: 'Run' })).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Check answers' }))
      const answer = JSON.stringify({ v: 1, items: { a: { answer: '4' } } })
      await waitFor(() =>
        expect(mocks.session.writeStudentRun).toHaveBeenCalledWith('student-1', {
          answer,
          status: 'submitted',
          checkPassed: true,
        })
      )
      // Typing is continuous: never mirrored while the teacher isn't watching.
      expect(mocks.session.writeStudentAnswer).not.toHaveBeenCalled()
      expect(mocks.session.writeStudentCode).not.toHaveBeenCalled()
    })
  }
)
