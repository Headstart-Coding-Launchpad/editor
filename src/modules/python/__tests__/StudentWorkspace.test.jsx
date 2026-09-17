import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StudentWorkspace from '../StudentWorkspace'

vi.mock('../PythonEditor', () => ({
  default: () => <div>python-editor</div>,
}))
const outputPanelSpy = vi.fn()
vi.mock('../../../app/components/OutputPanel', () => ({
  default: (props) => {
    outputPanelSpy(props)
    return <div>output-panel</div>
  },
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
  handleInputChange: vi.fn(),
  publishOutputCollapsed: vi.fn(),
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

  it('publishes the collapse-state change alongside the local toggle, for any live-viewing student to mirror', () => {
    cs.publishOutputCollapsed.mockClear()
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
      />
    )

    fireEvent.click(screen.getByText('Run'))
    expect(cs.publishOutputCollapsed).toHaveBeenCalledWith(false)
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

describe('Python StudentWorkspace input() live-mirror wiring', () => {
  it('wires cs.handleInputChange through to OutputPanel while interactive', () => {
    outputPanelSpy.mockClear()
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
      />
    )

    // Output starts collapsed (not mounted inside SplitPane's right pane) —
    // expand it via Run, same as the visible-panes tests above.
    fireEvent.click(screen.getByText('Run'))

    const props = outputPanelSpy.mock.calls.at(-1)[0]
    expect(props.onInputChange).toBe(cs.handleInputChange)
  })
})

describe('Python StudentWorkspace forced-live output-collapse lock', () => {
  it('mirrors displayOutputCollapsed=true (collapsed) while forced-live', () => {
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
        isForcedTeacherLive
        displayOutputCollapsed={true}
        isMobile={false}
        isTeacherEditing={false}
        teacherLiveCode=""
        onVisiblePanesChange={onVisiblePanesChange}
      />
    )

    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['code'])
  })

  it('mirrors displayOutputCollapsed=false (expanded) while forced-live', () => {
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
        isForcedTeacherLive
        displayOutputCollapsed={false}
        isMobile={false}
        isTeacherEditing={false}
        teacherLiveCode=""
        onVisiblePanesChange={onVisiblePanesChange}
      />
    )

    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['code', 'console'])
  })

  it('does not let a forced-live viewer expand the collapsed panel themselves (locked, not just seeded)', () => {
    cs.publishOutputCollapsed.mockClear()
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
        isForcedTeacherLive
        displayOutputCollapsed={true}
        isMobile={false}
        isTeacherEditing={false}
        teacherLiveCode=""
        onVisiblePanesChange={onVisiblePanesChange}
      />
    )

    // The collapsed rail is still shown (so the viewer knows the panel exists)
    // but is inert while forced-live — clicking it must not change anything.
    fireEvent.click(screen.getByTitle('Output (collapsed by the presenter)'))

    expect(onVisiblePanesChange).toHaveBeenLastCalledWith(['code'])
    expect(cs.publishOutputCollapsed).not.toHaveBeenCalled()
  })
})

describe('Python StudentWorkspace in a teacher-started sandbox', () => {
  it("ignores the session task's submit mode, tests and check", () => {
    outputPanelSpy.mockClear()
    render(
      <StudentWorkspace
        task={{
          interactionMode: 'submit',
          tests: [{ name: 't1' }],
          check: { type: 'output_contains', value: 'hi' },
          copyCode: 'print(1)',
        }}
        cs={cs}
        lessonId="lesson-1"
        identityId="student-1"
        viewingTaskId={null}
        isSandbox={true}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        isMobile={false}
        isTeacherEditing={false}
        teacherLiveCode=""
      />
    )

    expect(screen.getByText('Run')).toBeInTheDocument()
    expect(screen.queryByText('Submit')).not.toBeInTheDocument()
    expect(screen.queryByText('Run Tests')).not.toBeInTheDocument()
    expect(screen.queryByText('copy-code-panel')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Run'))
    expect(outputPanelSpy).toHaveBeenLastCalledWith(expect.objectContaining({ hasCheck: false }))
  })
})
