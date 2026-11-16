import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TeacherEditorPanel from '../TeacherEditorPanel'

// Fun moment (tutor-tabs sketch, OK'd 16 Nov 2026): the tutor clicks the Support tab and sees
// exactly what a student sees (the green change view), labelled Support, with the raw code one
// switch away.

vi.mock('../../../../shared/CodeEditor', () => ({
  CodeEditor: ({ value }) => <div data-testid="code-editor">{value}</div>,
}))

const STARTER = 'score = 0'
const SUPPORT_CODE = 'score = 0\nfor i in range(3):\n    score = score + i'
const COMPLETE_CODE = 'score = 0\nfor i in range(3):\n    score = score + i\nprint(score)'

const TASK = {
  id: 4,
  title: 'Add up',
  codeStages: [
    { role: 'starter', code: STARTER },
    { role: 'support', label: 'Loop', show: 'change', code: SUPPORT_CODE },
    { role: 'complete', show: 'change', code: COMPLETE_CODE },
  ],
}
const LESSON = { type: 'python', tasks: [TASK] }

function renderTab(tab, overrides = {}) {
  const index = Number(tab.replace('stage_', ''))
  return render(
    <TeacherEditorPanel
      lesson={LESSON}
      task={TASK}
      displayTaskId={4}
      isInSandbox={false}
      isInformationTask={false}
      activeTeacherStage={TASK.codeStages[index]}
      taskCodeStages={TASK.codeStages}
      teacherCodeTab={tab}
      setTeacherCodeTab={vi.fn()}
      hasStudents
      onSendStageToAll={vi.fn()}
      liveState={null}
      onChange={vi.fn()}
      onActivity={vi.fn()}
      answerTab="stage_2"
      {...overrides}
    />
  )
}

describe('Tutor Support / Complete tabs show what the student sees', () => {
  it('the Support tab shows the green change view, labelled Support, with raw code behind a switch', () => {
    renderTab('stage_1')
    const view = screen.getByTestId('teacher-stage-student-view')
    expect(within(view).getByText('Support')).toBeInTheDocument()
    expect(view).toHaveTextContent('What the student sees')
    const change = within(view).getByTestId('stage-change-view')
    expect(change).toHaveTextContent('for i in range(3):')
    expect(change).toHaveTextContent('after this line')
    expect(within(change).getByLabelText('added: for i in range(3):')).toBeInTheDocument()
    // The raw editor is hidden behind the switch.
    expect(screen.queryByTestId('code-editor')).not.toBeInTheDocument()

    const switchGroup = within(view).getByRole('group', { name: 'Show' })
    const studentBtn = within(switchGroup).getByRole('button', { name: 'Student view' })
    expect(studentBtn).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(switchGroup).getByRole('button', { name: 'Raw code' }))
    expect(screen.getByTestId('code-editor')).toHaveTextContent('for i in range(3):')
    expect(screen.queryByTestId('stage-change-view')).not.toBeInTheDocument()

    fireEvent.click(within(switchGroup).getByRole('button', { name: 'Student view' }))
    expect(screen.getByTestId('stage-change-view')).toBeInTheDocument()
  })

  it('the Complete tab is labelled Complete and shows the change view the student gets', () => {
    renderTab('stage_2')
    const view = screen.getByTestId('teacher-stage-student-view')
    expect(within(view).getByText('Complete')).toBeInTheDocument()
    expect(within(view).getByTestId('stage-change-view')).toHaveTextContent('print(score)')
    expect(screen.queryByTestId('code-editor')).not.toBeInTheDocument()
  })

  it('a stage without the change view shows the reference panel the student gets', () => {
    const task = {
      ...TASK,
      codeStages: [TASK.codeStages[0], { role: 'support', label: 'Loop', code: SUPPORT_CODE }],
    }
    renderTab('stage_1', {
      task,
      lesson: { type: 'python', tasks: [task] },
      taskCodeStages: task.codeStages,
      activeTeacherStage: task.codeStages[1],
      answerTab: null,
    })
    const view = screen.getByTestId('teacher-stage-student-view')
    expect(within(view).getByLabelText('Loop stage reference')).toHaveTextContent(
      'score = score + i'
    )
  })

  it('the Starter tab and the sandbox keep the plain editor', () => {
    renderTab('stage_0')
    expect(screen.queryByTestId('teacher-stage-student-view')).not.toBeInTheDocument()
    expect(screen.getByTestId('code-editor')).toBeInTheDocument()
  })

  it('the sandbox keeps the plain editor on a Support tab', () => {
    renderTab('stage_1', { isInSandbox: true, liveState: 'print("try")' })
    expect(screen.queryByTestId('teacher-stage-student-view')).not.toBeInTheDocument()
    expect(screen.getByTestId('code-editor')).toHaveTextContent('print("try")')
  })
})
