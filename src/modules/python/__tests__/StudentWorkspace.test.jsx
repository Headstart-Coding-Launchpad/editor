import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StudentWorkspace from '../StudentWorkspace'

vi.mock('../PythonEditor', () => ({
  default: () => <div>python-editor</div>,
}))
vi.mock('../../../app/components/OutputPanel', () => ({
  default: () => <div>output-panel</div>,
}))
vi.mock('../../../app/components/CopyCodePanel', () => ({
  default: () => <div>copy-code-panel</div>,
}))

const cs = {
  code: '',
  output: '',
  runStatus: null,
  checkPassed: false,
  running: false,
  runningTests: false,
  testResults: null,
  pyodideStatus: 'ready',
  inPersonalSandbox: false,
  handleRun: vi.fn(),
  handleStop: vi.fn(),
  handleRunTests: vi.fn(),
  handleResetCode: vi.fn(),
  handleCodeChange: vi.fn(),
  handleEditorSelection: vi.fn(),
  handleEditorActivity: vi.fn(),
  handleInputSubmit: vi.fn(),
  dismissHighlight: vi.fn(),
  readSavedTaskCode: vi.fn(),
}

describe('Python StudentWorkspace onVisiblePanesChange reporting (teacher live-status badge)', () => {
  it('reports just "code" while output is collapsed, and adds "console" once shown', () => {
    const onVisiblePanesChange = vi.fn()
    render(
      <StudentWorkspace
        task={{}}
        cs={cs}
        lessonId="lesson-1"
        identityId="student-1"
        viewingTaskId={null}
        isSandbox={false}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        isMobile={false}
        isTeacherEditing={false}
        teacherLiveCode=""
        onVisiblePanesChange={onVisiblePanesChange}
      />
    )

    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['code'])

    fireEvent.click(screen.getByText('Run'))
    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['code', 'console'])
  })

  it('never reports "console" for submit-mode tasks, since the output pane never renders', () => {
    const onVisiblePanesChange = vi.fn()
    render(
      <StudentWorkspace
        task={{ interactionMode: 'submit' }}
        cs={cs}
        lessonId="lesson-1"
        identityId="student-1"
        viewingTaskId={null}
        isSandbox={false}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        isMobile={false}
        isTeacherEditing={false}
        teacherLiveCode=""
        onVisiblePanesChange={onVisiblePanesChange}
      />
    )

    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['code'])
    fireEvent.click(screen.getByText('Submit'))
    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['code'])
  })
})
