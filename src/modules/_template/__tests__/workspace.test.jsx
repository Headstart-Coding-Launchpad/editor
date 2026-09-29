import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import StudentWorkspace from '../StudentWorkspace.jsx'
import BuilderWorkspace from '../BuilderWorkspace.jsx'
import TeacherLiveView from '../TeacherLiveView.jsx'

// The Template Module UI pieces with a stand-in `cs` (the classroom state hook). The real chain is
// driven by studentView.test.jsx once the module is registered.
// TODO(new-module): cover every control of the real workspace, its read-only modes and the exact
// work each interaction produces.

function fakeCs(overrides = {}) {
  return {
    code: 'say ',
    handleCodeChange: vi.fn(),
    handleWorkspaceRun: vi.fn(),
    handleResetCode: vi.fn(),
    readSavedTaskWork: vi.fn(() => 'earlier work'),
    remoteRunToken: null,
    acknowledgeRemoteRun: vi.fn(),
    ...overrides,
  }
}

const TASK = { id: 1, title: 'Write hello', starterCode: 'say ' }

describe('Template Module StudentWorkspace', () => {
  it('edits the work through cs and checks it with the Check button', () => {
    const cs = fakeCs()
    render(<StudentWorkspace task={TASK} cs={cs} />)
    fireEvent.change(screen.getByLabelText('Your work'), { target: { value: 'say hello' } })
    expect(cs.handleCodeChange).toHaveBeenCalledWith('say hello')
    fireEvent.click(screen.getByRole('button', { name: 'Check' }))
    expect(cs.handleWorkspaceRun).toHaveBeenCalledWith('say ')
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(cs.handleResetCode).toHaveBeenCalled()
  })

  it('is read-only while viewing an earlier task or a teacher broadcast', () => {
    const cs = fakeCs()
    const { rerender } = render(
      <StudentWorkspace task={TASK} cs={cs} isViewingPrev viewingTaskId={1} />
    )
    expect(screen.getByLabelText('Your work')).toHaveValue('earlier work')
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled()
    rerender(<StudentWorkspace task={TASK} cs={cs} isForcedTeacherLive displayCode="teacher" />)
    expect(screen.getByLabelText('Your work')).toHaveValue('teacher')
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument()
  })

  it('runs the check on a teacher remote run', () => {
    const cs = fakeCs({ remoteRunToken: 7 })
    render(<StudentWorkspace task={TASK} cs={cs} />)
    expect(cs.handleWorkspaceRun).toHaveBeenCalledWith('say ')
    expect(cs.acknowledgeRemoteRun).toHaveBeenCalledWith(7)
  })
})

describe('Template Module BuilderWorkspace', () => {
  it('writes the tab being edited', () => {
    const onUpdate = vi.fn()
    const props = {
      task: { ...TASK, codeStages: [{ label: 'Hint', role: 'support', code: '' }] },
      onUpdate,
      codeStages: [{ label: 'Hint', role: 'support', code: '' }],
      activePythonCode: 'say ',
      handleCodeTabChange: vi.fn(),
    }
    const { rerender } = render(<BuilderWorkspace {...props} codeTab="starter" />)
    const editor = () => screen.getByLabelText('Template Module starting work')
    fireEvent.change(editor(), { target: { value: 'a' } })
    expect(onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ starterCode: 'a' }))
    rerender(<BuilderWorkspace {...props} codeTab="complete" />)
    fireEvent.change(editor(), { target: { value: 'b' } })
    expect(onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ completeCode: 'b' }))
    rerender(<BuilderWorkspace {...props} codeTab="stage_0" />)
    fireEvent.change(editor(), { target: { value: 'c' } })
    expect(onUpdate.mock.lastCall[0].codeStages[0].code).toBe('c')
  })
})

describe('Template Module TeacherLiveView', () => {
  it('shows the display state and edits only when given onChange', () => {
    const onChange = vi.fn()
    const { rerender } = render(<TeacherLiveView displayState="work" readOnly />)
    expect(screen.getByLabelText('Template Module work')).toHaveAttribute('readonly')
    rerender(<TeacherLiveView displayState="work" readOnly={false} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Template Module work'), { target: { value: 'x' } })
    expect(onChange).toHaveBeenCalledWith('x')
  })
})
