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

const ITEMS = [
  ['football', '⚽', 'Football', 'sport'],
  ['tennis', '🎾', 'Tennis', 'sport'],
  ['swimming', '🏊', 'Swimming', 'sport'],
  ['cat', '🐱', 'Cats', 'animals'],
  ['dog', '🐶', 'Dogs', 'animals'],
  ['frog', '🐸', 'Frogs', 'animals'],
  ['guitar', '🎸', 'Guitar', 'music'],
  ['drums', '🥁', 'Drums', 'music'],
  ['piano', '🎹', 'Piano', 'music'],
  ['pizza', '🍕', 'Pizza', 'food'],
  ['icecream', '🍦', 'Ice cream', 'food'],
  ['pancakes', '🥞', 'Pancakes', 'food'],
].map(([id, emoji, label, group]) => ({ id, emoji, label, group }))

const LESSON = {
  id: 'recommender-click',
  title: 'Recommender click-through',
  type: 'python',
  tasks: [
    {
      id: 1,
      title: 'Build your feed',
      taskType: 'activity',
      activityType: 'recommender',
      items: ITEMS,
      raters: 'preset',
      showWhy: true,
      bubble: true,
      minRated: 2,
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

describe.skipIf(!getActivityDefinition('recommender'))(
  'Recommender StudentView click-through',
  () => {
    it('renders in the classroom, has no Run or Check button and passes on rate + Why?', async () => {
      const user = userEvent.setup()
      render(<StudentView lessonId={LESSON.id} lesson={LESSON} />)
      await user.click(await screen.findByRole('button', { name: 'Like Football' }))
      await user.click(screen.getByRole('button', { name: 'Dislike Cats' }))
      expect(screen.queryByRole('button', { name: 'Run' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Check my work' })).not.toBeInTheDocument()
      // Rated enough but no Why? yet: not passed.
      expect(mocks.session.writeStudentRun).not.toHaveBeenCalled()
      await user.click(screen.getAllByRole('button', { name: /^Why / })[0])
      await waitFor(() => expect(mocks.session.writeStudentRun).toHaveBeenCalled())
      const [studentId, run] = mocks.session.writeStudentRun.mock.calls[0]
      expect(studentId).toBe('student-1')
      expect(run).toMatchObject({ status: 'submitted', checkPassed: true })
      expect(JSON.parse(run.answer)).toEqual({
        v: 1,
        ratings: { football: 1, cat: -1 },
        why: true,
      })
      expect(mocks.session.writeStudentCode).not.toHaveBeenCalled()
    })
  }
)
