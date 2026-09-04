import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import TaskPreviewPanel from '../TaskPreviewPanel'

describe('TaskPreviewPanel authoring metadata', () => {
  it('always renders the student preview children', () => {
    render(
      <TaskPreviewPanel>
        <div>Student-facing content</div>
      </TaskPreviewPanel>
    )
    expect(screen.getByText('Student-facing content')).toBeInTheDocument()
  })

  it('renders no authoring metadata section when no task is supplied', () => {
    render(
      <TaskPreviewPanel>
        <div>Student-facing content</div>
      </TaskPreviewPanel>
    )
    expect(
      screen.queryByText('Authoring metadata (author-only)', { exact: false })
    ).not.toBeInTheDocument()
  })

  it('renders no authoring metadata section when intent and taskActivity are both empty', () => {
    render(
      <TaskPreviewPanel task={{ id: 1, title: 'Task', intent: '', taskActivity: '' }} draft>
        <div>Student-facing content</div>
      </TaskPreviewPanel>
    )
    expect(
      screen.queryByRole('button', { name: 'Show authoring metadata' })
    ).not.toBeInTheDocument()
  })

  it('is visible by default when the lesson is a draft', () => {
    render(
      <TaskPreviewPanel
        task={{
          id: 1,
          title: 'Task',
          intent: 'Teach **recursion**.',
          taskActivity: 'Whiteboard demo',
        }}
        draft
      >
        <div>Student-facing content</div>
      </TaskPreviewPanel>
    )
    expect(screen.getByText('Authoring metadata (author-only)')).toBeInTheDocument()
    expect(screen.getByText('Teach', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('Whiteboard demo')).toBeInTheDocument()
  })

  it('renders task activity below intent, as separate fields', () => {
    render(
      <TaskPreviewPanel
        task={{ id: 1, title: 'Task', intent: 'Teach recursion.', taskActivity: 'Whiteboard demo' }}
        draft
      >
        <div>Student-facing content</div>
      </TaskPreviewPanel>
    )
    expect(screen.getByText('Authoring intent')).toBeInTheDocument()
    expect(screen.getByText('Task activity')).toBeInTheDocument()
  })

  it('collapses by default when the lesson is not a draft, and expands on click', () => {
    render(
      <TaskPreviewPanel
        task={{ id: 1, title: 'Task', intent: 'Teach recursion.', taskActivity: 'Whiteboard demo' }}
        draft={false}
      >
        <div>Student-facing content</div>
      </TaskPreviewPanel>
    )
    expect(screen.queryByText('Whiteboard demo')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show authoring metadata' }))
    expect(screen.getByText('Whiteboard demo')).toBeInTheDocument()
  })

  it('can be re-collapsed after expanding', () => {
    render(
      <TaskPreviewPanel
        task={{ id: 1, title: 'Task', intent: 'Teach recursion.', taskActivity: 'Whiteboard demo' }}
        draft={false}
      >
        <div>Student-facing content</div>
      </TaskPreviewPanel>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Show authoring metadata' }))
    expect(screen.getByText('Whiteboard demo')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Collapse authoring metadata' }))
    expect(screen.queryByText('Whiteboard demo')).not.toBeInTheDocument()
  })
})
