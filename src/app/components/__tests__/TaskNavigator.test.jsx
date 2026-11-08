import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TaskNavigator from '../TaskNavigator.jsx'

const tasks = [
  { id: 1, title: 'Task one' },
  { id: 2, title: 'Task two' },
  { id: 3, title: 'Task three' },
]

describe('TaskNavigator task rows (calm teacher view: no Prev / Next)', () => {
  it('has no Prev / Next buttons; clicking a task selects it for preview', () => {
    const onTaskSelect = vi.fn()
    render(<TaskNavigator tasks={tasks} currentTaskId={2} onTaskSelect={onTaskSelect} />)
    expect(screen.queryByRole('button', { name: /Prev/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Next/ })).not.toBeInTheDocument()
    screen.getByRole('button', { name: /Task three/ }).click()
    expect(onTaskSelect).toHaveBeenCalledWith(3)
  })

  it('does not select a task during sandbox mode or staging', () => {
    const onTaskSelect = vi.fn()
    const { unmount } = render(
      <TaskNavigator tasks={tasks} currentTaskId={2} onTaskSelect={onTaskSelect} isSandbox />
    )
    screen.getByRole('button', { name: /Task three/ }).click()
    unmount()
    render(
      <TaskNavigator tasks={tasks} currentTaskId={2} onTaskSelect={onTaskSelect} sandboxStaging />
    )
    screen.getByRole('button', { name: /Task three/ }).click()
    expect(onTaskSelect).not.toHaveBeenCalled()
  })

  it('tags the class’s row "class is here" while another task is previewed', () => {
    const { rerender } = render(<TaskNavigator tasks={tasks} currentTaskId={2} />)
    expect(screen.queryByText('class is here')).not.toBeInTheDocument()
    rerender(<TaskNavigator tasks={tasks} currentTaskId={2} previewTaskId={3} />)
    expect(screen.getByRole('button', { name: /Task two/ })).toHaveTextContent('class is here')
  })
})

describe('TaskNavigator while the sandbox is live', () => {
  it('has no second Deactivate Sandbox button (the yellow bar has the one)', () => {
    render(<TaskNavigator tasks={tasks} currentTaskId={2} isSandbox onSandbox={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Deactivate Sandbox' })).not.toBeInTheDocument()
    expect(screen.getByTestId('task-nav-sandbox-live')).toBeInTheDocument()
  })
})

describe('TaskNavigator current-task line', () => {
  const students = [
    { anonymousId: 'a', lastRunStatus: 'success', lastRunAt: 1, checkPassed: true },
    { anonymousId: 'b', lastRunStatus: null },
  ]

  it('counts runs on a code task', () => {
    render(<TaskNavigator tasks={tasks} currentTaskId={1} students={students} />)
    expect(screen.getByText('1/2 run')).toBeInTheDocument()
  })

  it('shows no run count on an information task', () => {
    const infoTasks = [{ id: 1, title: 'Read me', taskType: 'information' }]
    render(<TaskNavigator tasks={infoTasks} currentTaskId={1} students={students} />)
    expect(screen.queryByText(/ run/)).not.toBeInTheDocument()
  })
})

describe('TaskNavigator Skip optional tasks', () => {
  const lessonTasks = [
    { id: 1, title: 'Task one' },
    { id: 2, title: 'Bonus quiz', priority: 'optional' },
    { id: 3, title: 'Task three' },
    { id: 4, title: 'Extra stage', priority: 'optional' },
  ]

  it('shows the switch in the footer, off by default, and reports a change', () => {
    const onSkipOptionalChange = vi.fn()
    render(
      <TaskNavigator
        tasks={lessonTasks}
        currentTaskId={1}
        onTaskSelect={vi.fn()}
        skipOptional={false}
        onSkipOptionalChange={onSkipOptionalChange}
      />
    )
    const toggle = screen.getByRole('switch', { name: /Skip optional tasks/ })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByTestId('task-nav-footer')).toContainElement(toggle)
    toggle.click()
    expect(onSkipOptionalChange).toHaveBeenCalledWith(true)
  })

  it('greys optional rows with a "skipped by Next" tag while on, and they still preview', () => {
    const onTaskSelect = vi.fn()
    render(
      <TaskNavigator
        tasks={lessonTasks}
        currentTaskId={1}
        onTaskSelect={onTaskSelect}
        skipOptional
        onSkipOptionalChange={vi.fn()}
      />
    )
    expect(screen.getByRole('switch', { name: /Skip optional tasks/ })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(screen.getByText('Next skips 2 optional')).toBeInTheDocument()
    const bonus = screen.getByRole('button', { name: /Bonus quiz/ })
    expect(bonus).toHaveAttribute('data-skipped', 'true')
    expect(bonus).toHaveTextContent('skipped by Next')
    expect(screen.getByRole('button', { name: /Task three/ })).not.toHaveAttribute('data-skipped')
    bonus.click()
    expect(onTaskSelect).toHaveBeenCalledWith(2)
  })

  it('has no switch when the lesson has no optional tasks', () => {
    render(<TaskNavigator tasks={tasks} currentTaskId={1} onSkipOptionalChange={vi.fn()} />)
    expect(screen.queryByRole('switch', { name: /Skip optional tasks/ })).not.toBeInTheDocument()
  })
})
