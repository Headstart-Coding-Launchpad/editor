import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  id: 'next_word-click',
  title: 'Next Word click-through',
  type: 'python',
  tasks: [
    {
      id: 1,
      title: 'Guess the next word',
      taskType: 'activity',
      activityType: 'next_word',
      guesses: 1,
      panels: ['stats'],
    },
  ],
}

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(Math, 'random').mockReturnValue(0)
  window.matchMedia = vi.fn(() => ({
    matches: true,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  mocks.session = makeSession(LESSON.id)
  mocks.identity = {
    identity: { anonymousId: 'student-1', displayName: 'Sam', lastSessionTimestamp: 456 },
    loaded: true,
    createIdentity: vi.fn(),
    updateTimestamp: vi.fn(),
    updateDisplayName: vi.fn(),
  }
})

afterEach(() => {
  vi.restoreAllMocks()
  delete window.matchMedia
})

describe.skipIf(!getActivityDefinition('next_word'))('Next Word StudentView click-through', () => {
  it('renders in the classroom, has no Run or Check button and passes after the guesses', async () => {
    const user = userEvent.setup()
    render(<StudentView lessonId={LESSON.id} lesson={LESSON} />)
    fireEvent.change(await screen.findByLabelText(/Write some sentences/), {
      target: { value: 'The cat sat on the mat. The cat ran.' },
    })
    expect(screen.queryByRole('button', { name: 'Run' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Check my work' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Start a sentence' }))
    await user.click(screen.getByRole('button', { name: /^cat:/ }))
    await user.click(screen.getByRole('button', { name: 'Next word' }))
    await waitFor(() =>
      expect(mocks.session.writeStudentRun).toHaveBeenCalledWith('student-1', {
        answer: expect.any(String),
        status: 'submitted',
        checkPassed: true,
      })
    )
    // What leaves the device carries the sentence and the counts, never the student's own text.
    const answer = JSON.parse(mocks.session.writeStudentRun.mock.calls[0][1].answer)
    expect(answer).toMatchObject({ v: 2, sentence: 'the cat', guesses: 1, right: 1, ownWords: 9 })
    expect(mocks.session.writeStudentCode).not.toHaveBeenCalled()
  })

  it('mirrors a tap (a deliberate click) to the teacher, with the own sentences', async () => {
    const user = userEvent.setup()
    render(<StudentView lessonId={LESSON.id} lesson={LESSON} />)
    fireEvent.change(await screen.findByLabelText(/Write some sentences/), {
      target: { value: 'The cat sat on the mat. The cat ran.' },
    })
    await user.click(screen.getByRole('button', { name: 'Start a sentence' }))
    await waitFor(() => expect(mocks.session.writeStudentAnswer).toHaveBeenCalled())
    const [id, serialized] = mocks.session.writeStudentAnswer.mock.calls.at(-1)
    expect(id).toBe('student-1')
    expect(JSON.parse(serialized)).toMatchObject({ sentence: 'the', ownWords: 9 })
    expect(serialized).toContain('The cat sat')
  })

  it('does not mirror typing while the teacher is not watching', async () => {
    render(<StudentView lessonId={LESSON.id} lesson={LESSON} />)
    fireEvent.change(await screen.findByLabelText(/Write some sentences/), {
      target: { value: 'The cat sat' },
    })
    expect(mocks.session.writeStudentAnswer).not.toHaveBeenCalled()
  })
})
