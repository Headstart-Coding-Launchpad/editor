import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TeacherReportModal from '../TeacherReportModal'

const report = {
  lessonId: 'demo', lessonTitle: 'Demo Lesson', sessionId: '1000', startedAt: 1000, endedAt: 2000,
  students: [
    {
      anonymousId: 'alice',
      displayName: 'Alice',
      tasks: [
        {
          taskId: 1, title: 'Task One', completed: true, attempts: 2, finalResult: 'passed',
          distinctAttempts: [
            { attemptNumber: 1, passed: false, retries: 0, suggestion: 'missing hello', submission: 'print("hi")' },
            { attemptNumber: 2, passed: true, retries: 0, suggestion: null, submission: 'print("hello")' },
          ],
        },
      ],
    },
  ],
  taskSummary: [
    {
      taskId: 1, title: 'Task One', totalStudents: 1, completedCount: 1, completionRate: 1,
      avgAttempts: 2, avgTimeOnTaskMs: 90000, commonFailures: [{ suggestion: 'missing hello', count: 1 }],
    },
  ],
}

describe('TeacherReportModal', () => {
  it('renders the lesson title and task summary', () => {
    render(<TeacherReportModal report={report} onClose={vi.fn()} />)
    expect(screen.getByText('Demo Lesson')).toBeInTheDocument()
    expect(screen.getByText('1/1 (100%)')).toBeInTheDocument()
    expect(screen.getByText('missing hello (1)')).toBeInTheDocument()
    expect(screen.getByText('1m 30s')).toBeInTheDocument()
  })

  it('expands a student and task row to reveal distinct attempts', () => {
    render(<TeacherReportModal report={report} onClose={vi.fn()} />)
    expect(screen.queryByText('Alice')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Student 1'))
    fireEvent.click(screen.getByRole('button', { name: /Task One/ }))
    expect(screen.getByText('print("hi")')).toBeInTheDocument()
    expect(screen.getByText('print("hello")')).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(<TeacherReportModal report={report} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('renders nothing when no report is provided', () => {
    const { container } = render(<TeacherReportModal report={null} onClose={vi.fn()} />)
    expect(container).toBeEmptyDOMElement()
  })
})
