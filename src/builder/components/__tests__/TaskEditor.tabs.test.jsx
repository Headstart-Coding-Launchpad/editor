import React, { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TaskEditor from '../TaskEditor'
import { forgetTaskEditorTab, taskEditorTabErrorCounts } from '../task-editor/taskEditorTabs'

vi.mock('../../../shared/useLessonStorageAssets', () => ({
  useLessonStorageAssets: () => ({ storageAssets: [], loading: false, error: null }),
}))

vi.mock('../../../shared/useTypeAssets', () => ({
  useTypeAssets: () => ({ typeStorageAssets: [], loading: false, error: null }),
}))

afterEach(() => forgetTaskEditorTab())

const codeTask = {
  id: 2,
  title: 'Draw on the Stage',
  estimatedMinutes: 8,
  explainer: 'Draw a red box.',
  starterCode: 'print(1)\n',
  intent: 'Students meet the Stage.',
}

function Editor({ initialTask = codeTask, lesson, validationErrors, onUpdate = () => {} }) {
  const [task, setTask] = useState(initialTask)
  return (
    <TaskEditor
      task={task}
      lesson={lesson ?? { id: 'demo', title: 'Demo', type: 'python', tasks: [task] }}
      validationErrors={validationErrors}
      onUpdate={(next) => {
        onUpdate(next)
        setTask(next)
      }}
    />
  )
}

function tab(name) {
  return screen.getByRole('tab', { name: new RegExp(`^${name}`) })
}

// Fun moment (Builder, tutor-facing): an author opens a code task and the code is right there,
// with the set-once settings on one line; everything else is one tab away, nothing lost.
describe('TaskEditor tabs: Content, Settings, Authoring notes', () => {
  it('opens on Content: title, minutes, one status line, then the code with Run', () => {
    render(<Editor />)
    expect(tab('Content')).toHaveAttribute('aria-selected', 'true')
    expect(tab('Settings')).toHaveAttribute('aria-selected', 'false')
    expect(tab('Authoring notes')).toHaveAttribute('aria-selected', 'false')

    const panel = screen.getByRole('tabpanel')
    expect(within(panel).getByDisplayValue('Draw on the Stage')).toBeInTheDocument()
    expect(within(panel).getByDisplayValue('8')).toBeInTheDocument()
    // The set-once settings on one compact line.
    const line = within(panel).getByTestId('task-status-line')
    expect(within(line).getByLabelText('Priority')).toHaveValue('core')
    expect(within(line).getByTestId('task-must-see')).not.toBeChecked()
    expect(within(line).getByLabelText('Available in')).toHaveValue('both')
    expect(within(line).getByRole('button', { name: /Task format/ })).toBeInTheDocument()
    // The code body is on the first screen.
    expect(within(panel).getByRole('button', { name: 'Run' })).toBeInTheDocument()
    // Settings and notes are not on Content.
    expect(screen.queryByRole('checkbox', { name: /coloured brackets/i })).toBeNull()
    expect(screen.getByDisplayValue('Students meet the Stage.')).not.toBeVisible()
  })

  it('keeps every tab mounted: the code editor survives a trip to Settings', async () => {
    const user = userEvent.setup()
    render(<Editor />)
    const run = screen.getByRole('button', { name: 'Run' })
    await user.click(tab('Settings'))
    expect(run).toBeInTheDocument()
    expect(run).not.toBeVisible()
    await user.click(tab('Content'))
    expect(screen.getByRole('button', { name: 'Run' })).toBe(run)
    expect(run).toBeVisible()
  })

  it('Home and End jump to the first and last tab', async () => {
    const user = userEvent.setup()
    render(<Editor />)
    tab('Content').focus()
    await user.keyboard('{End}')
    expect(tab('Authoring notes')).toHaveAttribute('aria-selected', 'true')
    expect(tab('Authoring notes')).toHaveFocus()
    await user.keyboard('{Home}')
    expect(tab('Content')).toHaveAttribute('aria-selected', 'true')
    expect(tab('Content')).toHaveFocus()
  })

  it('Escape closes the format popover and puts focus back on the chip', async () => {
    const user = userEvent.setup()
    render(<Editor />)
    const chip = screen.getByRole('button', { name: /Task format/ })
    await user.click(chip)
    screen.getByRole('button', { name: /^Quiz$/ }).focus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('button', { name: /^Quiz$/ })).toBeNull()
    expect(chip).toHaveFocus()
  })

  it('opens on Content when the remembered tab has nothing for this task (Settings on a quiz)', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Editor />)
    await user.click(tab('Settings'))
    unmount()
    render(
      <Editor
        initialTask={{
          id: 6,
          title: 'Pick one',
          taskType: 'quiz',
          quizType: 'multiple_choice',
          question: 'Which?',
          options: [
            { id: 'a', text: 'Yes' },
            { id: 'b', text: 'No' },
          ],
        }}
      />
    )
    expect(tab('Content')).toHaveAttribute('aria-selected', 'true')
    // Choosing Settings by hand still shows the placeholder.
    await user.click(tab('Settings'))
    expect(screen.getByText(/No extra settings for this task format/)).toBeVisible()
  })

  it('the status line still sets priority, must see and mode as before', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(<Editor onUpdate={onUpdate} />)
    await user.selectOptions(screen.getByLabelText('Priority'), 'optional')
    expect(onUpdate.mock.lastCall[0].priority).toBe('optional')
    await user.selectOptions(screen.getByLabelText('Priority'), 'core')
    expect(onUpdate.mock.lastCall[0]).not.toHaveProperty('priority')
    await user.click(screen.getByTestId('task-must-see'))
    expect(onUpdate.mock.lastCall[0].mustSee).toBe(true)
    await user.selectOptions(screen.getByLabelText('Available in'), 'solo')
    expect(onUpdate.mock.lastCall[0].taskMode).toBe('solo')
    await user.selectOptions(screen.getByLabelText('Available in'), 'both')
    expect(onUpdate.mock.lastCall[0].taskMode).toBeUndefined()
  })

  it('the format chip opens the task formats', async () => {
    const user = userEvent.setup()
    render(<Editor />)
    await user.click(screen.getByRole('button', { name: /Task format/ }))
    expect(screen.getByRole('button', { name: /^Code$/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^Quiz$/ })).toBeInTheDocument()
  })

  it('Settings holds the optional features and Task options; Authoring notes holds the notes', async () => {
    const user = userEvent.setup()
    render(<Editor />)
    await user.click(tab('Settings'))
    expect(screen.getByRole('checkbox', { name: /coloured brackets/i })).toBeChecked()
    expect(screen.getByRole('button', { name: /Task options/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Run' })).toBeNull()

    await user.click(tab('Authoring notes'))
    expect(screen.getByDisplayValue('Students meet the Stage.')).toBeInTheDocument()
    expect(screen.getByText('Task activity')).toBeInTheDocument()
  })

  it('remembers the chosen tab when the next task opens (this session only)', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<Editor />)
    await user.click(tab('Settings'))
    unmount()
    render(<Editor initialTask={{ ...codeTask, id: 3, title: 'Next task' }} />)
    expect(tab('Settings')).toHaveAttribute('aria-selected', 'true')
  })

  it('shows an error count on the tab that holds the broken field', () => {
    render(
      <Editor
        validationErrors={[
          'Task 1 has feedback checks but no completion check',
          'Task 1 peerHints can have at most 6 hints',
          'Task 10 has no starter code',
          'title is required',
        ]}
      />
    )
    expect(tab('Settings')).toHaveAccessibleName(/2 errors/)
    expect(tab('Content')).not.toHaveAccessibleName(/error/)
    expect(tab('Authoring notes')).not.toHaveAccessibleName(/error/)
  })
})

describe('taskEditorTabErrorCounts', () => {
  it('counts only this task’s errors, by the tab that edits the field', () => {
    const counts = taskEditorTabErrorCounts(
      [
        'Task 2 estimated time must be a positive number of minutes',
        'Task 2 badgeHints must be an object',
        'Task 2 copyCode must be text',
        'Task 12 copyCode must be text',
        'Task 2 has no starter code — students will start with an empty editor',
      ],
      2,
      { hasSettings: true }
    )
    expect(counts).toEqual({ content: 2, settings: 1, notes: 1 })
  })

  it('routes on the error text, not the task title in the label', () => {
    expect(
      taskEditorTabErrorCounts(
        ['Task 3 ("Check your tests") estimated time must be a positive number of minutes'],
        3,
        { hasSettings: true }
      )
    ).toEqual({ content: 1, settings: 0, notes: 0 })
    expect(
      taskEditorTabErrorCounts(['Task 3 ("Intro") copyCode must be text'], 3, {
        hasSettings: true,
      })
    ).toEqual({ content: 0, settings: 1, notes: 0 })
  })

  it('puts check errors on Content when the task has no Settings (a quiz)', () => {
    expect(
      taskEditorTabErrorCounts(['Task 4 has no completion check'], 4, { hasSettings: false })
    ).toEqual({ content: 1, settings: 0, notes: 0 })
  })
})

describe('TaskEditor with an old quiz (string options)', () => {
  it('opens without crashing and shows the option text', () => {
    const quiz = {
      id: 5,
      title: 'Pick one',
      taskType: 'quiz',
      quizType: 'multiple_choice',
      question: 'Which?',
      options: ['Yes', 'No', 42, null],
      check: { type: 'answer_equals', value: 'a' },
    }
    render(<Editor initialTask={quiz} />)
    expect(screen.getAllByText('Yes').length).toBeGreaterThan(0)
  })
})
