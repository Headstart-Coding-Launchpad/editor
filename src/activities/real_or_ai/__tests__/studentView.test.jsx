import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StudentView from '../../../app/views/StudentView'
import { getActivityDefinition } from '../../registry.pure.js'

// Real click-through: renders the real StudentView → LessonTaskContent → ActivityHost →
// useActivityState chain for a lesson containing this activity, mocking only Firebase-backed
// hooks. Unit tests of a view can pass while the real classroom crashes; this catches that.
// (Skipped inside src/activities/_template, which is never registered.)
// Every pick and clue is a discrete change (mirrored to the tutor's card even before Reveal);
// revealing the last pair finishes the activity (completion: 'auto').

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
      tells: ['hands', 'too_smooth'],
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
    it('renders in the classroom, mirrors picks live and finishes on the last Reveal', async () => {
      const user = userEvent.setup()
      render(<StudentView lessonId={LESSON.id} lesson={LESSON} />)
      await user.click(await screen.findByRole('button', { name: 'Pick B as the AI one' }))
      expect(screen.queryByRole('button', { name: 'Run' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Check my work' })).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: 'Too smooth' }))
      // The tutor's card follows the picks before the pair is revealed.
      await waitFor(() =>
        expect(mocks.session.writeStudentAnswer).toHaveBeenCalledWith(
          'student-1',
          JSON.stringify({ v: 1, items: { p1: { pick: 'b', tell: 'too_smooth', done: false } } })
        )
      )
      expect(mocks.session.writeStudentRun).not.toHaveBeenCalled()
      await user.click(screen.getByRole('button', { name: 'Reveal' }))
      const answer = JSON.stringify({
        v: 1,
        items: { p1: { pick: 'b', tell: 'too_smooth', done: true } },
      })
      await waitFor(() =>
        expect(mocks.session.writeStudentRun).toHaveBeenCalledWith('student-1', {
          answer,
          status: 'submitted',
          checkPassed: true,
        })
      )
      expect(screen.getByTestId('real_or_ai-reveal')).toHaveTextContent('Yes! B is the AI one.')
      expect(mocks.session.writeStudentCode).not.toHaveBeenCalled()
    })
  }
)
