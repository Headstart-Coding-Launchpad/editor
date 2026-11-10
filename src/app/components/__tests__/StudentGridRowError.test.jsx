import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../shared/TopicLibraryView', () => ({
  TopicLibraryDialog: () => <div data-testid="topic-library" />,
}))
vi.mock('../StudentModal', () => ({ default: () => null }))
// A row that breaks on bad data, as a real row might on a half-written snapshot.
vi.mock('../StudentListRow', () => ({
  default: ({ student }) => {
    if (student.broken) throw new Error('bad row data')
    return <div data-testid="student-row">{student.displayName}</div>
  },
}))

import StudentGrid from '../StudentGrid'

const LESSON = { type: 'python', tasks: [{ id: 1, title: 'Task 1' }] }

function props(sessionStudents) {
  const session = { state: 'active', currentTaskId: 1, students: sessionStudents }
  return {
    students: Object.entries(sessionStudents).map(([id, s]) => ({ ...s, anonymousId: id })),
    lesson: LESSON,
    lessonId: 'lesson-1',
    session,
    onRename: vi.fn(),
    onRemove: vi.fn(),
    onGoLive: vi.fn(),
    onGoLiveForAll: vi.fn(),
    onStopLive: vi.fn(),
    onRemoteReset: vi.fn(),
    collapsed: false,
    onToggle: vi.fn(),
  }
}

describe('StudentGrid row render error', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
  afterEach(() => vi.restoreAllMocks())

  it('keeps the other rows, and the broken row recovers by itself when good data arrives', () => {
    const bob = { displayName: 'Bob', online: true }
    const { rerender } = render(
      <StudentGrid
        {...props({ s1: { displayName: 'Alice', online: true, broken: true }, s2: bob })}
      />
    )
    expect(screen.getByTestId('render-error-fallback')).toHaveTextContent(
      "Alice's card hit an error."
    )
    expect(screen.getByText('Bob')).toBeInTheDocument()

    // The next snapshot for Alice is fine: no tutor tap needed.
    rerender(<StudentGrid {...props({ s1: { displayName: 'Alice', online: true }, s2: bob })} />)
    expect(screen.queryByTestId('render-error-fallback')).toBeNull()
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })
})
