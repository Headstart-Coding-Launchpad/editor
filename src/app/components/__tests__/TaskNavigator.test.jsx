import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TaskNavigator from '../TaskNavigator.jsx'

const tasks = [
  { id: 1, title: 'Task one' },
  { id: 2, title: 'Task two' },
  { id: 3, title: 'Task three' },
]

describe('TaskNavigator Prev/Next during sandbox mode', () => {
  it('lets Prev/Next select a task when not in sandbox', () => {
    const onTaskSelect = vi.fn()
    render(<TaskNavigator tasks={tasks} currentTaskId={2} onTaskSelect={onTaskSelect} isSandbox={false} sandboxStaging={false} />)

    screen.getByRole('button', { name: /Next/ }).click()
    expect(onTaskSelect).toHaveBeenCalledWith(3)
  })

  it('does not select a task when Prev/Next is clicked during sandbox mode', () => {
    const onTaskSelect = vi.fn()
    render(<TaskNavigator tasks={tasks} currentTaskId={2} onTaskSelect={onTaskSelect} isSandbox sandboxStaging={false} />)

    screen.getByRole('button', { name: /Next/ }).click()
    screen.getByRole('button', { name: /Prev/ }).click()
    expect(onTaskSelect).not.toHaveBeenCalled()
  })

  it('does not select a task when Prev/Next is clicked during sandbox staging', () => {
    const onTaskSelect = vi.fn()
    render(<TaskNavigator tasks={tasks} currentTaskId={2} onTaskSelect={onTaskSelect} isSandbox={false} sandboxStaging />)

    screen.getByRole('button', { name: /Next/ }).click()
    expect(onTaskSelect).not.toHaveBeenCalled()
  })

  it('visually dims Prev/Next during sandbox mode, matching every other task-select control', () => {
    render(<TaskNavigator tasks={tasks} currentTaskId={2} onTaskSelect={vi.fn()} isSandbox sandboxStaging={false} />)

    const next = screen.getByRole('button', { name: /Next/ })
    expect(next).toHaveStyle({ opacity: 0.45 })
  })
})
