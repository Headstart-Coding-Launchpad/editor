import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TeacherEditorPanel from '../TeacherEditorPanel'

vi.mock('../../../../shared/CodeEditor', () => ({
  CodeEditor: () => <div data-testid="code-editor" />,
}))

const CODE_ARRANGE_TASK = {
  id: 1,
  title: 'Arrange Task',
  taskType: 'code_arrange',
  lines: [
    { id: 'L1', parts: [{ type: 'slot', id: 'L1', code: 'print(1)' }] },
    { id: 'L2', parts: [{ type: 'slot', id: 'L2', code: 'print(2)' }] },
  ],
  distractors: [{ id: 'D1', code: 'print(99)' }],
}

const CODE_ARRANGE_LESSON = { type: 'python', tasks: [CODE_ARRANGE_TASK] }

function mkProps(overrides = {}) {
  return {
    lesson: CODE_ARRANGE_LESSON,
    task: CODE_ARRANGE_TASK,
    displayTaskId: 1,
    isInSandbox: false,
    isInformationTask: false,
    activeTeacherStage: null,
    taskCodeStages: [],
    teacherCodeTab: 'starter',
    setTeacherCodeTab: vi.fn(),
    hasStudents: false,
    onSendStageToAll: vi.fn(),
    liveState: null,
    onChange: vi.fn(),
    onActivity: vi.fn(),
    teacherLiveReference: null,
    teacherLiveReferenceVisibleToAll: false,
    onToggleLiveReference: vi.fn(),
    ...overrides,
  }
}

describe('TeacherEditorPanel — code_arrange tasks', () => {
  it('shows a read-only tile board with the authored solution placed, not a code editor', () => {
    render(<TeacherEditorPanel {...mkProps()} />)

    expect(screen.queryByTestId('code-editor')).not.toBeInTheDocument()
    expect(screen.getByText('print(1)')).toBeInTheDocument()
    expect(screen.getByText('print(2)')).toBeInTheDocument()
    // Solution tiles are placed into their slots; the distractor stays
    // unplaced in the pool below.
    expect(screen.getByText('print(99)')).toBeInTheDocument()
  })

  it('disables run controls (read-only preview, not an interactive workspace)', () => {
    render(<TeacherEditorPanel {...mkProps()} />)
    expect(screen.queryByRole('button', { name: /^run$/i })).not.toBeInTheDocument()
  })

  it('falls back to the normal code editor while in the teacher sandbox', () => {
    render(<TeacherEditorPanel {...mkProps({ isInSandbox: true })} />)

    expect(screen.getByTestId('code-editor')).toBeInTheDocument()
    expect(screen.queryByText('print(1)')).not.toBeInTheDocument()
  })
})
