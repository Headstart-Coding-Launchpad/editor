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
  id: 'learning_tree-click',
  title: 'Learning Tree click-through',
  type: 'python',
  tasks: [
    {
      id: 1,
      title: 'Answer the questions',
      taskType: 'activity',
      activityType: 'learning_tree',
      features: ['has_fur', 'can_fly', 'lives_in_water'],
      labels: ['pet', 'wild'],
      testItems: [
        { name: 'Hamster', yes: ['has_fur'], label: 'pet' },
        { name: 'Eagle', yes: ['can_fly'], label: 'wild' },
      ],
      passAt: 2,
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

describe.skipIf(!getActivityDefinition('learning_tree'))(
  'Learning Tree StudentView click-through',
  () => {
    it('renders in the classroom, has no Run or Check button and marks as you go', async () => {
      const user = userEvent.setup()
      render(<StudentView lessonId={LESSON.id} lesson={LESSON} />)
      const add = async (name, feature, label) => {
        await user.type(await screen.findByLabelText('Item name'), name)
        await user.click(screen.getByRole('button', { name: feature }))
        await user.click(screen.getByRole('button', { name: `+ ${label}` }))
      }
      await add('cat', 'has fur?', 'pet')
      await add('owl', 'can fly?', 'wild')
      expect(screen.queryByRole('button', { name: 'Run' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Check my work' })).not.toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: /Try it on new animals/ }))
      expect(await screen.findByText('Your tree got 2 of 2 right')).toBeInTheDocument()
      await waitFor(() =>
        expect(mocks.session.writeStudentRun).toHaveBeenCalledWith(
          'student-1',
          expect.objectContaining({ status: 'submitted', checkPassed: true })
        )
      )
      const saved = JSON.parse(mocks.session.writeStudentRun.mock.calls.at(-1)[1].answer)
      expect(saved.examples).toEqual([
        { n: 'cat', f: '100', l: 0 },
        { n: 'owl', f: '010', l: 1 },
      ])
      expect(saved.tried).toBe(true)
      expect(mocks.session.writeStudentCode).not.toHaveBeenCalled()
    })
  }
)
