import React, { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TaskEditor from '../components/TaskEditor'
import {
  getActivityDefinition,
  getGalleryActivityDefinitions,
  getQuizActivityDefinitions,
} from '../../activities/registry.pure.js'
import { clearActivityPreviewStore } from '../../activities/ActivityPreview.jsx'

vi.mock('../../shared/useLessonStorageAssets', () => ({
  useLessonStorageAssets: () => ({ storageAssets: [], loading: false, error: null }),
}))

vi.mock('../../shared/useTypeAssets', () => ({
  useTypeAssets: () => ({ typeStorageAssets: [], loading: false, error: null }),
}))

afterEach(() => clearActivityPreviewStore())

const lesson = { id: 'demo', title: 'Demo', type: 'python', tasks: [] }

// Keeps the edited task in state, like the Builder does, and records every update.
function Editor({ initialTask, onUpdate = () => {}, composedLesson = null }) {
  const [task, setTask] = useState(initialTask)
  return (
    <TaskEditor
      task={task}
      lesson={composedLesson ?? lesson}
      composedLesson={composedLesson}
      onUpdate={(next) => {
        onUpdate(next)
        setTask(next)
      }}
    />
  )
}

function formatButton(name) {
  return screen.getByRole('button', { name: new RegExp(`^${name}$`) })
}

function lastUpdate(onUpdate) {
  return onUpdate.mock.calls[onUpdate.mock.calls.length - 1][0]
}

describe('TaskEditor task formats (plan 2.4)', () => {
  it('offers Code, Information, Quiz and Activity (Arrange only in composed lessons)', () => {
    render(<Editor initialTask={{ id: 1, title: 'T', starterCode: 'print(1)' }} />)
    for (const name of ['Code', 'Information', 'Quiz', 'Activity']) {
      expect(formatButton(name)).toBeInTheDocument()
    }
    expect(screen.queryByRole('button', { name: /^Arrange$/ })).toBeNull()
    expect(formatButton('Code')).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows a gallery of every non-quiz activity from the registry before converting', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(<Editor initialTask={{ id: 1, title: 'T', starterCode: 'x' }} onUpdate={onUpdate} />)

    await user.click(formatButton('Activity'))
    expect(onUpdate).not.toHaveBeenCalled()
    const gallery = screen.getByRole('group', { name: 'Choose an activity' })
    const cards = within(gallery).getAllByRole('button')
    expect(cards.map((card) => card.getAttribute('data-activity'))).toEqual(
      getGalleryActivityDefinitions().map((definition) => definition.id)
    )
    for (const definition of getGalleryActivityDefinitions()) {
      expect(within(gallery).getByText(definition.label)).toBeInTheDocument()
      expect(within(gallery).getByText(definition.description)).toBeInTheDocument()
    }
    expect(within(gallery).queryByText('Multiple choice')).toBeNull()
  })

  it('choosing Code again closes the gallery without changing the task', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(
      <Editor
        initialTask={{
          id: 1,
          title: 'T',
          starterCode: 'x',
          check: { type: 'output_contains', value: 'x' },
        }}
        onUpdate={onUpdate}
      />
    )
    await user.click(formatButton('Activity'))
    await user.click(formatButton('Code'))
    expect(onUpdate).not.toHaveBeenCalled()
    expect(screen.queryByRole('group', { name: 'Choose an activity' })).toBeNull()
    expect(formatButton('Code')).toHaveAttribute('aria-pressed', 'true')
  })

  it('converts a code task to the chosen activity, keeping title and description only', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(
      <Editor
        initialTask={{
          id: 4,
          title: 'Type it',
          description: 'Practise typing',
          priority: 'optional',
          starterCode: 'print(1)',
          check: { type: 'output_contains', value: '1' },
          carryCodeFrom: 2,
        }}
        onUpdate={onUpdate}
      />
    )
    await user.click(formatButton('Activity'))
    await user.click(screen.getByRole('button', { name: /Keyboard skills/ }))

    const task = lastUpdate(onUpdate)
    expect(task).toMatchObject({
      id: 4,
      title: 'Type it',
      description: 'Practise typing',
      priority: 'optional',
      taskType: 'activity',
      activityType: 'keyboard',
      mode: 'type_text',
    })
    for (const field of ['starterCode', 'check', 'carryCodeFrom'])
      expect(task[field]).toBeUndefined()
    expect(getActivityDefinition('keyboard').validateTask(task, { n: 1 }).errors).toEqual([])
    expect(formatButton('Activity')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Keyboard skills/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('switching between activities replaces the activity fields', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    const binary = getActivityDefinition('binary').defaultTask({ id: 2, title: 'Bits' })
    render(<Editor initialTask={binary} onUpdate={onUpdate} />)

    await user.click(screen.getByRole('button', { name: /Mouse skills/ }))
    const task = lastUpdate(onUpdate)
    expect(task).toMatchObject({ id: 2, title: 'Bits', activityType: 'mouse' })
    expect(task.bits).toBeUndefined()
    expect(task.mode).toBeUndefined()
    expect(getActivityDefinition('mouse').validateTask(task, { n: 1 }).errors).toEqual([])
  })

  it('leaving an activity for Code or Information strips the activity fields', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    const binary = getActivityDefinition('binary').defaultTask({ id: 2, title: 'Bits' })
    render(<Editor initialTask={binary} onUpdate={onUpdate} />)

    await user.click(formatButton('Information'))
    const info = lastUpdate(onUpdate)
    expect(info).toMatchObject({ id: 2, title: 'Bits', taskType: 'information' })
    for (const field of ['activityType', 'mode', 'bits', 'items', 'showPlaceValues']) {
      expect(info[field]).toBeUndefined()
    }
  })

  it('leaving an activity for Quiz gives the default multiple-choice quiz', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    const mouse = getActivityDefinition('mouse').defaultTask({ id: 3, title: 'Click' })
    render(<Editor initialTask={mouse} onUpdate={onUpdate} />)

    await user.click(formatButton('Quiz'))
    const quiz = lastUpdate(onUpdate)
    expect(quiz).toMatchObject({
      id: 3,
      title: 'Click',
      taskType: 'quiz',
      quizType: 'multiple_choice',
    })
    expect(quiz.targets).toBeUndefined()
    expect(quiz.items).toBeUndefined()
    expect(quiz.activityType).toBeUndefined()
  })

  it('renders the activity BuilderEditor and a preview through ActivityHost', () => {
    const binary = getActivityDefinition('binary').defaultTask({ id: 2, title: 'Bits' })
    render(<Editor initialTask={binary} />)
    expect(screen.getByLabelText('Binary mode')).toBeInTheDocument()
    const preview = screen.getByTestId('activity-preview')
    expect(within(preview).getByTestId('activity-host')).toBeInTheDocument()
    // No code-task options for an activity.
    expect(screen.queryByText('Copy code panel')).toBeNull()
  })

  it('an unknown activityType offers the gallery to replace it', () => {
    render(
      <Editor
        initialTask={{ id: 5, title: 'Future', taskType: 'activity', activityType: 'morse' }}
      />
    )
    expect(screen.getByText(/doesn't know \("morse"\)/)).toBeInTheDocument()
    expect(screen.queryByTestId('activity-preview')).toBeNull()
  })
})

describe('TaskEditor quiz picker (registry driven)', () => {
  const mcQuiz = {
    id: 7,
    title: 'Pick',
    taskType: 'quiz',
    quizType: 'multiple_choice',
    options: [
      { id: 'a', text: 'One' },
      { id: 'b', text: 'Two' },
    ],
    check: { type: 'answer_equals', value: 'b' },
  }

  it('lists every category quiz activity', () => {
    render(<Editor initialTask={mcQuiz} />)
    for (const definition of getQuizActivityDefinitions()) {
      expect(screen.getByRole('button', { name: new RegExp(definition.label) })).toBeInTheDocument()
    }
    expect(screen.getByRole('button', { name: /Multiple choice/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    // The multiple-choice editor comes from quiz_multiple_choice/ui.jsx.
    expect(screen.getByRole('button', { name: '+ Add option' })).toBeInTheDocument()
  })

  it('switching quiz type keeps the legacy shape and the old defaults', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(<Editor initialTask={mcQuiz} onUpdate={onUpdate} />)

    await user.click(screen.getByRole('button', { name: /^Match/ }))
    expect(lastUpdate(onUpdate)).toEqual({
      ...mcQuiz,
      quizType: 'match',
      pairs: [
        { id: 'p1', prompt: '', answer: '' },
        { id: 'p2', prompt: '', answer: '' },
      ],
      check: null,
    })
    expect(screen.getByRole('button', { name: '+ Add pair' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Multiple choice/ }))
    expect(lastUpdate(onUpdate)).toMatchObject({
      taskType: 'quiz',
      quizType: 'multiple_choice',
      options: mcQuiz.options,
      check: null,
    })
  })

  it('choosing Quiz on a code task keeps its options and answer (unchanged behaviour)', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(
      <Editor
        initialTask={{ id: 8, title: 'Q', starterCode: 'x', copyCode: 'y' }}
        onUpdate={onUpdate}
      />
    )
    await user.click(formatButton('Quiz'))
    expect(lastUpdate(onUpdate)).toEqual({
      id: 8,
      title: 'Q',
      starterCode: 'x',
      taskType: 'quiz',
      quizType: 'multiple_choice',
      options: [
        { id: 'a', text: '' },
        { id: 'b', text: '' },
      ],
      check: null,
      carryCodeFrom: null,
      carryBlocksFrom: null,
      carryFsFrom: null,
      carryCircuitFrom: null,
    })
  })
})
