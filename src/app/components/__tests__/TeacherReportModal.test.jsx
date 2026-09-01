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
      taskId: 1, title: 'Task One', priority: 'optional', totalStudents: 1, completedCount: 1, completionRate: 1,
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
    expect(screen.getByText('optional')).toBeInTheDocument()
  })

  it('renders override counts and per-student override detail', () => {
    const overriddenReport = {
      ...report,
      students: [{
        ...report.students[0],
        tasks: [{
          ...report.students[0].tasks[0],
          completed: true,
          finalResult: 'overridden_failed',
          override: { taskId: 1, overriddenAt: 1900, attemptNumber: 2, previousCheckState: 'failed' },
        }],
      }],
      taskSummary: [{
        ...report.taskSummary[0],
        overrideCount: 1,
        overriddenFailedCount: 1,
        overriddenUnattemptedCount: 0,
      }],
    }

    render(<TeacherReportModal report={overriddenReport} onClose={vi.fn()} />)
    expect(screen.getByText('1/1 (100%), 1 override')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Student 1'))
    expect(screen.getByText('Teacher moved on after 2 attempts')).toBeInTheDocument()
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

  it('renders teacher feedback when present on the report', () => {
    const reportWithFeedback = {
      ...report,
      teacherFeedback: {
        rating: 4,
        whatWorkedWell: 'Great pace',
        whatDidntWork: 'Iframe crashed once',
        submittedAt: 2500,
      },
    }
    render(<TeacherReportModal report={reportWithFeedback} onClose={vi.fn()} />)
    expect(screen.getByText('Teacher Feedback')).toBeInTheDocument()
    expect(screen.getByLabelText('Rated 4 out of 5 stars')).toBeInTheDocument()
    expect(screen.getByText('Great pace')).toBeInTheDocument()
    expect(screen.getByText('Iframe crashed once')).toBeInTheDocument()
  })

  it('does not render a teacher feedback section when absent and no onSaveFeedback is given', () => {
    render(<TeacherReportModal report={report} onClose={vi.fn()} />)
    expect(screen.queryByText('Teacher Feedback')).not.toBeInTheDocument()
    expect(screen.queryByText('Rate This Session')).not.toBeInTheDocument()
  })

  it('renders an editable feedback form when onSaveFeedback is given and no feedback exists yet', async () => {
    const onSaveFeedback = vi.fn().mockResolvedValue(undefined)
    render(<TeacherReportModal report={report} onClose={vi.fn()} onSaveFeedback={onSaveFeedback} />)

    expect(screen.getByText('Rate This Session')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: '4 stars' }))
    fireEvent.change(screen.getByLabelText('What worked well?'), { target: { value: 'Great pace' } })
    fireEvent.change(screen.getByLabelText("What didn't work, or was broken?"), { target: { value: 'Iframe crashed once' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Feedback' }))

    expect(onSaveFeedback).toHaveBeenCalledWith({
      rating: 4,
      whatWorkedWell: 'Great pace',
      whatDidntWork: 'Iframe crashed once',
    })
  })

  it('does not show the editable form once the report already has feedback', () => {
    const onSaveFeedback = vi.fn()
    const reportWithFeedback = { ...report, teacherFeedback: { rating: 5, whatWorkedWell: '', whatDidntWork: '', submittedAt: 2500 } }
    render(<TeacherReportModal report={reportWithFeedback} onClose={vi.fn()} onSaveFeedback={onSaveFeedback} />)
    expect(screen.queryByText('Rate This Session')).not.toBeInTheDocument()
    expect(screen.getByText('Teacher Feedback')).toBeInTheDocument()
  })
})
