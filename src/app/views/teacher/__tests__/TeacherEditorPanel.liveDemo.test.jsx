import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TeacherEditorPanel from '../TeacherEditorPanel'

const editorProps = vi.fn()
vi.mock('../../../../modules/python/PythonEditor.jsx', () => ({
  default: (p) => {
    editorProps(p)
    return <div data-testid="code-editor" />
  },
}))

const TASK = { id: 1, title: 'T', taskType: 'code', starterCode: 'print(1)' }
function props(over = {}) {
  return {
    lesson: { type: 'python', tasks: [TASK] },
    task: TASK,
    displayTaskId: 1,
    isInSandbox: false,
    isInformationTask: false,
    activeTeacherStage: null,
    taskCodeStages: [],
    teacherCodeTab: 'starter',
    setTeacherCodeTab: vi.fn(),
    hasStudents: false,
    onSendStageToAll: vi.fn(),
    liveState: 'print("live")',
    onChange: vi.fn(),
    ...over,
  }
}

describe('TeacherEditorPanel liveDemo', () => {
  it('is editable with the live note and no code tabs', () => {
    render(<TeacherEditorPanel {...props({ liveDemo: true })} />)
    expect(editorProps.mock.calls.at(-1)[0].readOnly).toBe(false)
    expect(screen.getByTestId('teacher-panel-live-note').textContent).toContain(
      'Live: students see what you type'
    )
    expect(screen.queryByTestId('teacher-panel-readonly-note')).toBeNull()
  })

  it('stays read-only otherwise', () => {
    render(<TeacherEditorPanel {...props()} />)
    expect(editorProps.mock.calls.at(-1)[0].readOnly).toBe(true)
    expect(screen.getByTestId('teacher-panel-readonly-note')).toBeTruthy()
  })
})
