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
  id: 'next_word-click',
  title: 'Next Word click-through',
  type: 'python',
  tasks: [
    {
      id: 1,
      title: 'Answer the questions',
      taskType: 'activity',
      activityType: 'next_word',
      texts: [
        {
          title: 'Football',
          body: 'The ball goes into the net. The keeper looks at the net. The striker puts the ball in the net.',
        },
      ],
      allowPaste: true,
      showTemperature: true,
      items: [{ id: 'a', prompt: 'the ball goes into the', answer: 'net' }],
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

describe.skipIf(!getActivityDefinition('next_word'))('Next Word StudentView click-through', () => {
  it('renders in the classroom, has no Run button and reports a passing Check', async () => {
    const user = userEvent.setup()
    render(<StudentView lessonId={LESSON.id} lesson={LESSON} />)
    await user.click(await screen.findByRole('radio', { name: 'Football' }))
    await user.type(screen.getByLabelText('Your prediction'), 'net')
    expect(screen.queryByRole('button', { name: 'Run' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Reveal' }))
    expect(await screen.findByText('Correct')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Check my work' }))
    await waitFor(() =>
      expect(mocks.session.writeStudentRun).toHaveBeenCalledWith('student-1', {
        answer: expect.any(String),
        status: 'submitted',
        checkPassed: true,
      })
    )
    const answer = JSON.parse(mocks.session.writeStudentRun.mock.calls[0][1].answer)
    expect(answer).toMatchObject({
      v: 1,
      source: 'text',
      index: 0,
      items: { a: { guess: 'net', revealed: true } },
    })
    expect(mocks.session.writeStudentCode).not.toHaveBeenCalled()
  })

  it('reports a failing Check when the prediction was never revealed', async () => {
    const user = userEvent.setup()
    render(<StudentView lessonId={LESSON.id} lesson={LESSON} />)
    await user.click(await screen.findByRole('radio', { name: 'Football' }))
    await user.type(screen.getByLabelText('Your prediction'), 'net')
    await user.click(screen.getByRole('button', { name: 'Check my work' }))
    await waitFor(() =>
      expect(mocks.session.writeStudentRun).toHaveBeenCalledWith('student-1', {
        answer: expect.any(String),
        status: 'submitted',
        checkPassed: false,
      })
    )
  })

  it('mirrors a chosen text (a deliberate click) to the teacher without being watched', async () => {
    const user = userEvent.setup()
    render(<StudentView lessonId={LESSON.id} lesson={LESSON} />)
    await user.click(await screen.findByRole('radio', { name: 'Football' }))
    await waitFor(() => expect(mocks.session.writeStudentAnswer).toHaveBeenCalled())
    const [id, serialized] = mocks.session.writeStudentAnswer.mock.calls.at(-1)
    expect(id).toBe('student-1')
    expect(JSON.parse(serialized)).toMatchObject({ source: 'text', index: 0 })
  })

  it('does not mirror typing while the teacher is not watching', async () => {
    const user = userEvent.setup()
    render(<StudentView lessonId={LESSON.id} lesson={LESSON} />)
    // Typing the guess is continuous. (Nothing else has changed, so nothing is written.)
    await user.type(await screen.findByLabelText('Your prediction'), 'net')
    expect(mocks.session.writeStudentAnswer).not.toHaveBeenCalled()
  })
})
