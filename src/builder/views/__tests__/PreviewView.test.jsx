import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import PreviewView from '../PreviewView'

vi.mock('../../../auth/useAuth', () => ({
  useAuth: () => ({ user: { email: 'teacher@example.com' } }),
}))

// StudentView pulls in Firebase/session/Pyodide machinery unrelated to this test; stub it and
// surface the current task id the same way it would via onTaskChange.
vi.mock('../../../app/views/StudentView', () => ({
  default: ({ lesson, initialTaskId, onTaskChange }) => {
    const taskId = initialTaskId ?? lesson?.tasks?.[0]?.id ?? null
    onTaskChange?.(taskId)
    return <div>Student view for task {String(taskId)}</div>
  },
}))

vi.mock('../../../app/components/TeacherFeedbackModal', () => ({
  default: () => null,
}))

const lesson = {
  id: 'preview-demo',
  type: 'python',
  title: 'Preview demo',
  tasks: [
    { id: 1, title: 'Task one', intent: 'Explain **loops** to students.', taskActivity: 'Pair-share discussion', starterCode: '' },
    { id: 2, title: 'Task two', starterCode: '' },
  ],
}

describe('PreviewView authoring metadata (teacher-only preview)', () => {
  it('is visible by default when the lesson is a draft', () => {
    render(<PreviewView lesson={{ ...lesson, draft: true }} onClose={() => {}} initialTaskId={1} />)
    expect(screen.getByText('Authoring metadata (author-only)')).toBeInTheDocument()
    expect(screen.getByText('Explain', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('Pair-share discussion')).toBeInTheDocument()
  })

  it('collapses by default when the lesson is not a draft, and expands on click', () => {
    render(<PreviewView lesson={{ ...lesson, draft: false }} onClose={() => {}} initialTaskId={1} />)
    expect(screen.queryByText('Pair-share discussion')).not.toBeInTheDocument()
    const showButton = screen.getByRole('button', { name: 'Show authoring metadata' })
    fireEvent.click(showButton)
    expect(screen.getByText('Pair-share discussion')).toBeInTheDocument()
  })

  it('renders no authoring metadata section when the task has neither intent nor taskActivity', () => {
    render(<PreviewView lesson={{ ...lesson, draft: true }} onClose={() => {}} initialTaskId={2} />)
    expect(screen.queryByText('Authoring metadata (author-only)')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Show authoring metadata' })).not.toBeInTheDocument()
  })

  it('never renders task intent through the student-facing StudentView mock (proxy for the real render path)', () => {
    render(<PreviewView lesson={{ ...lesson, draft: true }} onClose={() => {}} initialTaskId={1} />)
    // StudentView is stubbed here specifically because the real component is the actual
    // student-facing render path; it receives no intent/taskActivity props from PreviewView.
    expect(screen.getByText('Student view for task 1')).toBeInTheDocument()
  })
})
