import { act, render, screen, waitFor } from '@testing-library/react'
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
  id: 'network_playground-click',
  title: 'Network Playground click-through',
  type: 'python',
  tasks: [
    {
      id: 1,
      title: 'Train the network',
      taskType: 'activity',
      activityType: 'network_playground',
      dataset: 'two_blobs',
      layers: [3],
      target: 0.9,
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

describe.skipIf(!getActivityDefinition('network_playground'))(
  'Network Playground StudentView click-through',
  () => {
    it('renders in the classroom, trains with a real Train click and marks as you go', async () => {
      const user = userEvent.setup()
      const frames = []
      vi.stubGlobal('requestAnimationFrame', (cb) => frames.push(cb))
      vi.stubGlobal('cancelAnimationFrame', () => {})
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
      render(<StudentView lessonId={LESSON.id} lesson={LESSON} />)
      const train = await screen.findByRole('button', { name: /Train/ })
      expect(screen.queryByRole('button', { name: 'Run' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Check my work' })).not.toBeInTheDocument()
      await user.click(train)
      for (let i = 0; i < 200 && frames.length; i += 1) act(() => frames.shift()(performance.now()))
      await waitFor(() =>
        expect(mocks.session.writeStudentRun).toHaveBeenCalledWith(
          'student-1',
          expect.objectContaining({ status: 'submitted', checkPassed: true })
        )
      )
      const run = mocks.session.writeStudentRun.mock.calls.at(-1)[1]
      const sent = JSON.parse(run.answer)
      expect(sent.acc).toBeGreaterThanOrEqual(0.9)
      expect(sent.layers).toEqual([3])
      // The tutor's copy carries the network's numbers so they can see it.
      expect(sent.w).toHaveLength(13)
      expect(mocks.session.writeStudentCode).not.toHaveBeenCalled()
      vi.unstubAllGlobals()
      vi.restoreAllMocks()
    })
  }
)
