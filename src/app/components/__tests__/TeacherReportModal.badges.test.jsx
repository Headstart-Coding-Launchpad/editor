import React from 'react'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TeacherReportModal from '../TeacherReportModal'

// A report with every live-badge section (built reports are anonymised; this one still carries
// display names, as an old report might, to prove they never show).
const report = {
  lessonId: 'demo',
  lessonTitle: 'Demo Lesson',
  sessionId: '1000',
  startedAt: 1000,
  endedAt: 2000000,
  students: [
    {
      displayName: 'Alex',
      badges: [
        {
          badgeId: 'bug_hunter',
          emoji: '🐛',
          title: 'Bug Hunter',
          source: 'rule',
          reason: 'First to fix the bug in “Task 1”',
          taskId: 1,
          awardedAt: 1500,
        },
      ],
      topicsOpened: [
        { topicId: 'loops', title: 'Loops', context: 'task', taskId: 1, source: 'student' },
      ],
      shortcutsUsed: [{ shortcutId: 'run', label: 'Ctrl+Enter', context: 'task', taskId: 1 }],
      personalSandbox: { timeMs: 65000, runs: 4, errorRuns: 2, fixes: 1 },
      tasks: [
        {
          taskId: 1,
          title: 'Task One',
          completed: true,
          attempts: 2,
          finalResult: 'passed',
          timeToFirstEditMs: 4000,
          errorAttempts: 1,
          uniqueFailedAttempts: 1,
          firstPassInClass: true,
          distinctAttempts: [],
        },
      ],
    },
    {
      displayName: 'Sam',
      badges: [
        { badgeId: 'bug_hunter', emoji: '🐛', title: 'Bug Hunter', source: 'manual', taskId: 2 },
      ],
      tasks: [],
    },
  ],
  taskSummary: [
    {
      taskId: 1,
      title: 'Task One',
      totalStudents: 2,
      completedCount: 1,
      completionRate: 0.5,
      avgAttempts: 2,
      avgTimeOnTaskMs: 1000,
      commonFailures: [],
      timeToFirstEdit: { medianMs: 8000, minMs: 4000, maxMs: 12000, studentCount: 2 },
      errorStudentCount: 1,
      topicOpens: { student: 2, teacher: 1 },
      firstRealPass: { studentLabel: 'Student 1', afterMs: 130000 },
    },
  ],
  quizGroups: [
    {
      groupId: 'g1',
      title: 'End Quiz',
      quizTaskIds: [3, 4, 5],
      students: [{ studentLabel: 'Student 1', right: 2, total: 3, firstTryPercent: 67 }],
      medianFirstTryPercent: 67,
    },
  ],
  teacherSandbox: {
    possibleLessonGap: true,
    visits: [
      {
        visitId: '7000',
        enteredAt: 7000,
        exitedAt: 7000 + 14 * 60000,
        durationMs: 14 * 60000,
        previousTaskId: 7,
        previousTaskTitle: null,
        explainer: 'Try a loop',
        pushes: [{ at: 7100, code: 'for i in range(3):' }],
        studentSnapshots: [{ studentLabel: 'Student 2', at: 7200, code: 'print(i)' }],
      },
    ],
  },
  badgeSummary: {
    bug_hunter: { suggested: 1, awarded: 2, autoAwarded: 0, manual: 1, dismissed: 0, revoked: 0 },
  },
  shortcutSummary: { run: 1 },
}

describe('TeacherReportModal: live badge sections', () => {
  it('shows Coding moments grouped by badge, with labels rather than names', () => {
    render(<TeacherReportModal report={report} onClose={vi.fn()} />)
    const wall = screen.getByRole('list', { name: 'Class coding moments' })
    expect(
      within(wall)
        .getAllByRole('listitem')
        .map((row) => row.textContent)
    ).toEqual(['🐛Bug HunterStudent 1, Student 2'])
    expect(screen.queryByText(/Alex|Sam/)).toBeNull()
    expect(screen.getByText(/run \(1 student\)/)).toBeInTheDocument()
  })

  it('copies the class summary with anonymised labels', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<TeacherReportModal report={report} onClose={vi.fn()} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /copy class summary/i }))
    })
    expect(writeText).toHaveBeenCalledWith(
      'Coding moments: Demo Lesson\n🐛 Bug Hunter: Student 1, Student 2'
    )
  })

  it('adds the first edit, console error, Topic Library and first real pass columns', () => {
    render(<TeacherReportModal report={report} onClose={vi.fn()} />)
    expect(screen.getByText('8s median (4s–12s)')).toBeInTheDocument()
    expect(screen.getByText('1 student')).toBeInTheDocument()
    expect(screen.getByText('2 student, 1 tutor-sent')).toBeInTheDocument()
    expect(screen.getByText('Student 1 · 2m 10s in')).toBeInTheDocument()
  })

  it('shows the teacher sandbox as a possible lesson gap, with the code on expand', () => {
    render(<TeacherReportModal report={report} onClose={vi.fn()} />)
    const callout = screen.getByRole('button', {
      name: /The class spent 14 min in the teacher sandbox after Task 7/,
    })
    expect(screen.queryByText('for i in range(3):')).toBeNull()
    fireEvent.click(callout)
    expect(screen.getByText('Try a loop')).toBeInTheDocument()
    expect(screen.getByText('for i in range(3):')).toBeInTheDocument()
    expect(screen.getByText('print(i)')).toBeInTheDocument()
  })

  it('shows quiz-group first tries', () => {
    render(<TeacherReportModal report={report} onClose={vi.fn()} />)
    expect(screen.getByText(/Student 1: 2\/3 \(67%\)/)).toBeInTheDocument()
  })

  it('shows a student’s moments, topics, shortcuts, personal sandbox and task signals', () => {
    render(<TeacherReportModal report={report} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /Student 1/ }))
    expect(screen.getByText(/First to fix the bug/)).toBeInTheDocument()
    expect(screen.getByText('Loops')).toBeInTheDocument()
    expect(screen.getByText('Ctrl+Enter')).toBeInTheDocument()
    expect(screen.getByText('1m 5s · 4 runs, 2 with errors, 1 fix')).toBeInTheDocument()
    expect(
      screen.getByText(
        '✏️ first edit 4s · ⚠️ 1 error run · 1 different failed try · ⭐ first real pass in class'
      )
    ).toBeInTheDocument()
  })

  it('shows the size note when sandbox code was left out', () => {
    render(
      <TeacherReportModal
        report={{ ...report, sizeNote: 'Students’ sandbox code was left out.' }}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('Students’ sandbox code was left out.')).toBeInTheDocument()
  })
})
