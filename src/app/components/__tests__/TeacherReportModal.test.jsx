import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TeacherReportModal from '../TeacherReportModal'

const report = {
  lessonId: 'demo',
  lessonTitle: 'Demo Lesson',
  sessionId: '1000',
  startedAt: 1000,
  endedAt: 2000,
  students: [
    {
      anonymousId: 'alice',
      displayName: 'Alice',
      tasks: [
        {
          taskId: 1,
          title: 'Task One',
          completed: true,
          attempts: 2,
          finalResult: 'passed',
          distinctAttempts: [
            {
              attemptNumber: 1,
              passed: false,
              retries: 0,
              suggestion: 'missing hello',
              submission: 'print("hi")',
            },
            {
              attemptNumber: 2,
              passed: true,
              retries: 0,
              suggestion: null,
              submission: 'print("hello")',
            },
          ],
        },
      ],
    },
  ],
  taskSummary: [
    {
      taskId: 1,
      title: 'Task One',
      priority: 'optional',
      totalStudents: 1,
      completedCount: 1,
      completionRate: 1,
      avgAttempts: 2,
      avgTimeOnTaskMs: 90000,
      commonFailures: [{ suggestion: 'missing hello', count: 1 }],
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

  it('shows how many references were opened per task and per student', () => {
    const reveals = [
      { taskId: 1, stageIndex: 1, stageLabel: 'Hint', source: 'teacher' },
      { taskId: 1, stageIndex: 2, stageLabel: 'Solution', source: 'student' },
    ]
    const referenceReport = {
      ...report,
      students: [
        {
          ...report.students[0],
          tasks: [{ ...report.students[0].tasks[0], supportReveals: reveals }],
        },
      ],
      taskSummary: [
        {
          ...report.taskSummary[0],
          supportRevealCount: 2,
          supportRevealStudentCount: 1,
          supportRevealSources: { teacher: 1, student: 1 },
        },
      ],
    }
    render(<TeacherReportModal report={referenceReport} onClose={vi.fn()} />)
    expect(screen.getByText('References')).toBeInTheDocument()
    expect(screen.getByText('2 opened by 1 student (1 teacher, 1 student)')).toBeInTheDocument()
    expect(screen.getByText(/2 references opened/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('Student 1'))
    expect(screen.getByText('📖 2 references: Hint, Solution')).toBeInTheDocument()
  })

  it('renders override counts and per-student override detail', () => {
    const overriddenReport = {
      ...report,
      students: [
        {
          ...report.students[0],
          tasks: [
            {
              ...report.students[0].tasks[0],
              completed: true,
              finalResult: 'overridden_failed',
              override: {
                taskId: 1,
                overriddenAt: 1900,
                attemptNumber: 2,
                previousCheckState: 'failed',
              },
            },
          ],
        },
      ],
      taskSummary: [
        {
          ...report.taskSummary[0],
          overrideCount: 1,
          overriddenFailedCount: 1,
          overriddenUnattemptedCount: 0,
        },
      ],
    }

    render(<TeacherReportModal report={overriddenReport} onClose={vi.fn()} />)
    expect(screen.getByText('1/1 (100%), 1 override')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Student 1'))
    expect(screen.getByText('Teacher moved on after 2 attempts')).toBeInTheDocument()
  })

  it('labels auto-checked results and shows the work checked when the class moved on', () => {
    const autoReport = {
      ...report,
      students: [
        {
          ...report.students[0],
          tasks: [
            {
              ...report.students[0].tasks[0],
              completed: false,
              attempts: 0,
              finalResult: 'auto_failed',
              distinctAttempts: [],
              autoCheck: {
                result: 'failed',
                suggestion: 'Use a for loop',
                submission: 'print(1)',
                checkedAt: 1800,
              },
            },
            {
              ...report.students[0].tasks[0],
              taskId: 2,
              title: 'Task Two',
              completed: true,
              attempts: 0,
              finalResult: 'auto_passed',
              distinctAttempts: [],
            },
            {
              ...report.students[0].tasks[0],
              taskId: 3,
              title: 'Task Three',
              completed: false,
              attempts: 0,
              finalResult: 'auto_not_run',
              distinctAttempts: [],
            },
          ],
        },
      ],
      taskSummary: [
        {
          ...report.taskSummary[0],
          completedCount: 0,
          completionRate: 0,
          autoPassedCount: 0,
          autoFailedCount: 1,
          autoNotRunCount: 0,
        },
      ],
    }

    render(<TeacherReportModal report={autoReport} onClose={vi.fn()} />)
    expect(screen.getByText('0/1 (0%), auto-checked: 1 incorrect')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Student 1'))
    expect(screen.getByText('Incorrect (auto-checked)')).toBeInTheDocument()
    expect(screen.getByText('Correct (auto-checked)')).toBeInTheDocument()
    expect(screen.getByText('Not run')).toBeInTheDocument()
    expect(screen.getByText('1/3 tasks completed')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Task One/ }))
    expect(screen.getByText('Auto-checked on move-on: incorrect')).toBeInTheDocument()
    expect(screen.getByText('Use a for loop')).toBeInTheDocument()
    expect(screen.getByText('print(1)')).toBeInTheDocument()
  })

  it('describes a tutor hand pass apart from moving the class on', () => {
    const handPassReport = {
      ...report,
      students: [
        {
          ...report.students[0],
          tasks: [
            {
              ...report.students[0].tasks[0],
              finalResult: 'overridden_failed',
              override: {
                taskId: 1,
                overriddenAt: 1900,
                attemptNumber: 2,
                previousCheckState: 'failed',
                source: 'teacher',
              },
            },
          ],
        },
      ],
    }
    render(<TeacherReportModal report={handPassReport} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Student 1'))
    expect(screen.getByText('Passed by the teacher')).toBeInTheDocument()
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
    fireEvent.change(screen.getByLabelText('What worked well?'), {
      target: { value: 'Great pace' },
    })
    fireEvent.change(screen.getByLabelText("What didn't work, or was broken?"), {
      target: { value: 'Iframe crashed once' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save Feedback' }))

    expect(onSaveFeedback).toHaveBeenCalledWith({
      rating: 4,
      whatWorkedWell: 'Great pace',
      whatDidntWork: 'Iframe crashed once',
    })
  })

  it('renders a per-task teacher rating in the task summary table', () => {
    const reportWithTaskRating = {
      ...report,
      taskSummary: [
        {
          ...report.taskSummary[0],
          teacherRating: {
            rating: 3,
            whatWorkedWell: 'Students got it quickly',
            whatDidntWork: 'Instructions were unclear',
            submittedAt: 1300,
          },
        },
      ],
    }
    render(<TeacherReportModal report={reportWithTaskRating} onClose={vi.fn()} />)
    expect(screen.getByLabelText('Rated 3 out of 5 stars')).toBeInTheDocument()
    expect(screen.getByText(/Students got it quickly/)).toBeInTheDocument()
    expect(screen.getByText(/Instructions were unclear/)).toBeInTheDocument()
  })

  it('does not show the editable form once the report already has feedback', () => {
    const onSaveFeedback = vi.fn()
    const reportWithFeedback = {
      ...report,
      teacherFeedback: { rating: 5, whatWorkedWell: '', whatDidntWork: '', submittedAt: 2500 },
    }
    render(
      <TeacherReportModal
        report={reportWithFeedback}
        onClose={vi.fn()}
        onSaveFeedback={onSaveFeedback}
      />
    )
    expect(screen.queryByText('Rate This Session')).not.toBeInTheDocument()
    expect(screen.getByText('Teacher Feedback')).toBeInTheDocument()
  })
})
