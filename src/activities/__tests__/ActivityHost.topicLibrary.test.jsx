import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ActivityHost from '../ActivityHost.jsx'
import binary from '../binary/definition.js'

// Activity headers have no Topic library chip (Ryan, 7 Nov 2026), but [[topic]] links and a
// tutor's topic push (openTopicId) still open the one Topic library dialog. The real
// MarkdownRenderer and TopicLibraryDialog are used; only the topic list is faked.

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
  description: 'Read about [[binary-numbers|binary]], then turn bits **on** to make 5.',
  taskType: 'activity',
  activityType: 'binary',
  mode: 'make_number',
  bits: 4,
  items: [{ id: 'a', target: 5 }],
}

function activityFor(task) {
  return {
    task,
    state: binary.initialState(task),
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    readSavedState: vi.fn(() => null),
  }
}

function expectOneTopicDialog() {
  const dialogs = screen.getAllByRole('dialog', { name: 'Topic library' })
  expect(dialogs).toHaveLength(1)
  expect(within(dialogs[0]).getAllByText('Binary numbers').length).toBeGreaterThan(0)
  expect(within(dialogs[0]).getByText('double')).toBeInTheDocument()
}

describe('an activity header (no Topic library chip)', () => {
  it('shows no chip, but a [[topic]] link opens the real dialog and reports it', () => {
    const onTopicOpen = vi.fn()
    render(
      <ActivityHost
        task={BINARY}
        activity={activityFor(BINARY)}
        lessonType="python"
        topicLibrary={{ onTopicOpen, onTopicClose: vi.fn(), openTopicId: null }}
      />
    )
    expect(screen.getByRole('heading', { name: 'Make 5' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Topic library|Loading library/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'binary' }))
    expectOneTopicDialog()
    expect(onTopicOpen).toHaveBeenCalledWith('binary-numbers')
  })

  it("a tutor's topic push opens the same single dialog and reports it", () => {
    const onTopicOpen = vi.fn()
    const activity = activityFor(BINARY)
    const lib = (openTopicId) => ({ onTopicOpen, onTopicClose: vi.fn(), openTopicId })
    const { rerender } = render(
      <ActivityHost
        task={BINARY}
        activity={activity}
        lessonType="python"
        topicLibrary={lib(null)}
      />
    )
    expect(screen.queryByRole('dialog', { name: 'Topic library' })).toBeNull()
    rerender(
      <ActivityHost
        task={BINARY}
        activity={activity}
        lessonType="python"
        topicLibrary={lib('binary-numbers')}
      />
    )
    expectOneTopicDialog()
    expect(onTopicOpen).toHaveBeenCalledWith('binary-numbers')
    expect(screen.queryByRole('button', { name: /Topic library|Loading library/ })).toBeNull()
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
    const dialogs = screen.getAllByRole('dialog', { name: 'Topic library' })
    expect(dialogs).toHaveLength(1)
    expect(within(dialogs[0]).getAllByText('Binary numbers').length).toBeGreaterThan(0)
  })
})
