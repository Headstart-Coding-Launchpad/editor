import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StudentGrid from '../StudentGrid'

vi.mock('../../../shared/TopicLibraryView', () => ({
  TopicLibraryDialog: () => <div data-testid="topic-library" />,
}))

vi.mock('../StudentModal', () => ({
  default: ({ student }) => <div data-testid="student-modal">{student.displayName}</div>,
}))

const NOW = 1_000_000

function props(overrides = {}) {
  return {
    students: [
      { anonymousId: 's1', displayName: 'Alice', online: true },
      { anonymousId: 's2', displayName: 'Bob', online: true },
    ],
    lesson: { type: 'python', tasks: [{ id: 1, title: 'Task 1' }] },
    lessonId: 'lesson-1',
    session: { state: 'active', currentTaskId: 1 },
    onRename: vi.fn(),
    onRemove: vi.fn(),
    onGoLive: vi.fn(),
    onGoLiveForAll: vi.fn(),
    onStopLive: vi.fn(),
    onRemoteReset: vi.fn(),
    collapsed: false,
    onToggle: vi.fn(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('StudentGrid openStudentRequest (Class health chip)', () => {
  it("opens the student's screen for a fresh request", () => {
    const p = props()
    const { rerender } = render(<StudentGrid {...p} />)
    act(() => {
      vi.setSystemTime(NOW + 500)
    })
    rerender(<StudentGrid {...p} openStudentRequest={{ studentId: 's2', at: NOW + 500 }} />)
    expect(screen.getByTestId('student-modal')).toHaveTextContent('Bob')
    expect(p.onGoLive).toHaveBeenCalledWith('s2')
  })

  it('ignores a request older than the grid (stale after a remount)', () => {
    const p = props({ openStudentRequest: { studentId: 's2', at: NOW - 60_000 } })
    render(<StudentGrid {...p} />)
    expect(screen.queryByTestId('student-modal')).toBeNull()
    expect(p.onGoLive).not.toHaveBeenCalled()
  })
})
