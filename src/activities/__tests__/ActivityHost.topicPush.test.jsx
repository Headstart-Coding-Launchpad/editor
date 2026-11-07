import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ActivityHost from '../ActivityHost.jsx'
import binary from '../binary/definition.js'
import quizMultipleChoice from '../quiz_multiple_choice/definition.js'

// Activity headers have no Topic library chip (Ryan, 7 Nov 2026), but a tutor's topic push must
// still open the topic, with or without a [[topic]] link or any text in the activity. The real
// MarkdownRenderer and TopicLibraryDialog are used; only the topic list is faked, and like the
// real hook it loads nothing while `enabled` is false.

vi.mock('../../shared/useElementSize', () => ({ useElementSize: vi.fn() }))
vi.mock('../../modules/registry', async (importOriginal) => ({
  ...(await importOriginal()),
  getLessonModule: vi.fn(),
}))

const TOPICS = [
  {
    id: 'binary-numbers',
    title: 'Binary numbers',
    types: [],
    category: 'Data',
    summary: 'Numbers made of 0s and 1s.',
    description: 'Each bit is worth **double** the one to its right.',
    syntax: '',
    aliases: ['binary'],
    related: [],
  },
]

vi.mock('../../shared/topicLibrary', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useTopicLibrary: (_type = null, enabled = true) => ({
      topics: enabled ? TOPICS : [],
      allTopics: enabled ? TOPICS : [],
      loading: false,
      error: null,
    }),
  }
})

import { getLessonModule } from '../../modules/registry'
import { useElementSize } from '../../shared/useElementSize'
import LessonTaskContent from '../../app/components/LessonTaskContent'

const BINARY = {
  id: 2,
  title: 'Make 5',
  description: 'Turn bits **on** to make the number.',
  taskType: 'activity',
  activityType: 'binary',
  mode: 'make_number',
  bits: 4,
  items: [{ id: 'a', target: 5 }],
}

function activityFor(task, state) {
  return {
    task,
    state,
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    readSavedState: vi.fn(() => null),
  }
}

function pushTopic(task, state) {
  const onTopicOpen = vi.fn()
  const activity = activityFor(task, state)
  const lib = (openTopicId) => ({ onTopicOpen, onTopicClose: vi.fn(), openTopicId })
  const { rerender } = render(
    <ActivityHost task={task} activity={activity} lessonType="python" topicLibrary={lib(null)} />
  )
  expect(screen.queryByRole('dialog', { name: 'Topic library' })).toBeNull()
  rerender(
    <ActivityHost
      task={task}
      activity={activity}
      lessonType="python"
      topicLibrary={lib('binary-numbers')}
    />
  )
  return { onTopicOpen }
}

function expectTopicDialog(onTopicOpen) {
  const dialog = screen.getByRole('dialog', { name: 'Topic library' })
  expect(within(dialog).getAllByText('Binary numbers').length).toBeGreaterThan(0)
  expect(within(dialog).getByText('double')).toBeInTheDocument()
  expect(onTopicOpen).toHaveBeenCalledWith('binary-numbers')
  expect(screen.queryByRole('button', { name: 'Topic library' })).toBeNull()
}

describe('a tutor topic push on an activity (no Topic library chip)', () => {
  it('opens the real topic when the activity text has no [[topic]] link', () => {
    const { onTopicOpen } = pushTopic(BINARY, binary.initialState(BINARY))
    expect(screen.getByRole('heading', { name: 'Make 5' })).toBeInTheDocument()
    expectTopicDialog(onTopicOpen)
  })

  it('opens the real topic when the activity has no title or text', () => {
    const bare = { ...BINARY, title: '', description: '' }
    const { onTopicOpen } = pushTopic(bare, binary.initialState(bare))
    expectTopicDialog(onTopicOpen)
  })

  it('opens the real topic on a quiz, which lays itself out with no header', () => {
    const quiz = { id: 7, title: 'Quiz', ...quizMultipleChoice.defaultTask({ id: 7 }) }
    const { onTopicOpen } = pushTopic(quiz, quizMultipleChoice.initialState(quiz))
    expectTopicDialog(onTopicOpen)
  })

  it('still opens a [[topic]] link in the activity text, reporting it to the tutor', () => {
    const linked = { ...BINARY, description: 'Read about [[binary-numbers|binary]] first.' }
    const onTopicOpen = vi.fn()
    render(
      <ActivityHost
        task={linked}
        activity={activityFor(linked, binary.initialState(linked))}
        lessonType="python"
        topicLibrary={{ onTopicOpen, onTopicClose: vi.fn(), openTopicId: null }}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'binary' }))
    expectTopicDialog(onTopicOpen)
  })
})

describe('a Python task explainer', () => {
  beforeEach(() => {
    getLessonModule.mockReturnValue({
      type: 'python',
      StudentWorkspace: () => <div>Workspace</div>,
      getLayoutStyles: () => ({}),
    })
    useElementSize.mockReturnValue([{ current: null }, { width: 1600, height: 900 }])
  })

  it('still shows the Topic library chip, which opens the library', () => {
    render(
      <LessonTaskContent
        lesson={{ type: 'python' }}
        cs={{ inPersonalSandbox: false, activity: null }}
        currentTaskId={1}
        task={{ id: 1, title: 'Say hello', explainer: 'Print a greeting.' }}
        isSandbox={false}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        isMobile={false}
        isQuizTask={false}
        isAutoEvaluatedQuiz={false}
        isInformationTask={false}
        isTeacherEditing={false}
        onTopicOpen={vi.fn()}
        onTopicClose={vi.fn()}
        openTopicId={null}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Topic library' }))
    const dialog = screen.getByRole('dialog', { name: 'Topic library' })
    expect(within(dialog).getAllByText('Binary numbers').length).toBeGreaterThan(0)
  })
})
