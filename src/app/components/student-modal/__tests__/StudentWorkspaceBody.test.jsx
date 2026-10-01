import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import StudentWorkspaceBody from '../StudentWorkspaceBody'
import {
  CONFIDENCE_TASK,
  FILL_BLANK_DRAG_TASK,
  FILL_BLANK_TYPE_TASK,
  MATCH_TASK,
  MULTIPLE_CHOICE_TASK,
  PYTHON_CODE_ARRANGE_TASK,
  SHORT_ANSWER_TASK,
} from '../../../../test/fixtures/legacyActivityTasks'

// Phase 0 characterisation (docs/architecture/modular-activities-plan.md step 0.3):
// StudentModal's workspace body renders the real QuizTask / CodeArrangeTask from
// the student's mirrored currentAnswer / currentCodeArrangeSlots, read-only
// unless the teacher is editing answers. (StudentModal.test.jsx mocks QuizTask,
// so the rendered answer state per sub-type is pinned here.)

vi.mock('../../../../shared/CodeEditor', () => ({
  CodeEditor: ({ lineHints }) => (
    <div data-testid="code-editor" data-line-hints={JSON.stringify(lineHints ?? null)} />
  ),
}))
vi.mock('../../../../modules/scratch/TeacherLiveView.jsx', () => ({
  default: () => <div data-testid="scratch-live" />,
}))
vi.mock('../../OutputPanel', () => ({
  default: ({ output }) => <div data-testid="output-panel">{output}</div>,
}))
vi.mock('../../CollapsibleIframePreview', () => ({
  default: () => <div data-testid="iframe-preview" />,
}))
vi.mock('../../IframePreview', () => ({
  default: () => <div data-testid="iframe-preview" />,
}))

const BASE_STUDENT = {
  anonymousId: 'student-1',
  displayName: 'Jamie',
  currentAnswer: null,
  currentCode: '',
  currentOutput: '',
  lastRunStatus: null,
  checkPassed: null,
}

function renderBody(task, student = {}, props = {}) {
  const isCodeArrange = task.taskType === 'code_arrange'
  return render(
    <StudentWorkspaceBody
      lesson={{ type: 'python', tasks: [task] }}
      task={task}
      student={{ ...BASE_STUDENT, ...student }}
      session={{ state: 'active', currentTaskId: task.id }}
      isInformation={false}
      isQuiz={task.taskType === 'quiz'}
      isSessionSandbox={false}
      isPython={isCodeArrange}
      isScratch={false}
      isHtml={false}
      isCodeArrangeTask={isCodeArrange}
      files={[]}
      iframeRef={{ current: null }}
      {...props}
    />
  )
}

describe('StudentWorkspaceBody quiz answers (read-only mirror)', () => {
  it('multiple_choice checks the mirrored option', () => {
    renderBody(MULTIPLE_CHOICE_TASK, { currentAnswer: 'b' })
    expect(screen.getByRole('radio', { name: /input\(\)/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: /print\(\)/ })).toHaveAttribute(
      'aria-checked',
      'false'
    )
  })

  it('match places mirrored tiles and leaves unplaced answers in the pool', () => {
    renderBody(MATCH_TASK, { currentAnswer: '{"p1":"p1","p2":"p3"}' })
    // Pool buttons are only the unplaced answers.
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Asks a question'])
    expect(screen.getByText('Shows text')).toBeInTheDocument()
    expect(screen.getByText('Counts items')).toBeInTheDocument()
  })

  it('match reveals correct answers for wrong/empty slots once submitted', () => {
    renderBody(MATCH_TASK, {
      currentAnswer: '{"p1":"p1","p2":"p3"}',
      lastRunStatus: 'submitted',
      checkPassed: false,
    })
    expect(screen.getAllByText(/✓ Correct:/).map((node) => node.textContent)).toEqual([
      '✓ Correct: Asks a question',
      '✓ Correct: Counts items',
    ])
  })

  it('fill_blank drag shows tile text in blanks and the rest in the answer bank', () => {
    renderBody(FILL_BLANK_DRAG_TASK, { currentAnswer: '{"b1":"b1","b2":"d1"}' })
    expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['input'])
    expect(screen.getByText('print')).toBeInTheDocument()
    expect(screen.getByText('len')).toBeInTheDocument()
  })

  it('fill_blank type shows the typed text in a disabled input', () => {
    renderBody(FILL_BLANK_TYPE_TASK, { currentAnswer: '{"t1":"loop"}' })
    const input = screen.getByPlaceholderText('...')
    expect(input).toHaveValue('loop')
    expect(input).toBeDisabled()
  })

  it('short_answer shows the answer in a disabled textarea, and "Your answer" once submitted', () => {
    const { unmount } = renderBody(SHORT_ANSWER_TASK, { currentAnswer: 'It prints' })
    expect(screen.getByPlaceholderText('Type your answer here…')).toHaveValue('It prints')
    expect(screen.getByPlaceholderText('Type your answer here…')).toBeDisabled()
    unmount()
    renderBody(SHORT_ANSWER_TASK, {
      currentAnswer: 'It prints',
      lastRunStatus: 'submitted',
      checkPassed: false,
    })
    expect(screen.getByText('It prints', { selector: 'strong' })).toBeInTheDocument()
  })

  it('confidence presses the mirrored level', () => {
    renderBody(CONFIDENCE_TASK, { currentAnswer: '4' })
    expect(screen.getByTitle('Confidence level 4')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTitle('Confidence level 4')).toBeDisabled()
  })
})

describe('StudentWorkspaceBody teacher answer editing', () => {
  it('multiple_choice edits push { answer, passed: undefined } (MC emits no passedOverride)', async () => {
    const user = userEvent.setup()
    const onEditAnswer = vi.fn()
    renderBody(MULTIPLE_CHOICE_TASK, { currentAnswer: 'b' }, { answerEditing: true, onEditAnswer })
    await user.click(screen.getByRole('radio', { name: /print\(\)/ }))
    expect(onEditAnswer.mock.calls).toEqual([[{ answer: 'a', passed: undefined }]])
    // The teacher's edit shows immediately, before any Firebase echo.
    expect(screen.getByRole('radio', { name: /print\(\)/ })).toHaveAttribute('aria-checked', 'true')
  })

  it('confidence and typed fill_blank edits push the serialized answer with their passed flag', () => {
    const onEditAnswer = vi.fn()
    const { unmount } = renderBody(
      CONFIDENCE_TASK,
      { currentAnswer: '2' },
      { answerEditing: true, onEditAnswer }
    )
    fireEvent.click(screen.getByTitle('Confidence level 5'))
    expect(onEditAnswer).toHaveBeenLastCalledWith({ answer: '5', passed: true })
    unmount()

    renderBody(
      FILL_BLANK_TYPE_TASK,
      { currentAnswer: '{"t1":"lo"}' },
      { answerEditing: true, onEditAnswer }
    )
    fireEvent.change(screen.getByPlaceholderText('...'), { target: { value: 'loop' } })
    expect(onEditAnswer).toHaveBeenLastCalledWith({ answer: '{"t1":"loop"}', passed: null })
  })
})

describe('StudentWorkspaceBody code_arrange', () => {
  it('prefers mirrored currentCodeArrangeSlots over the assembled code', () => {
    renderBody(PYTHON_CODE_ARRANGE_TASK, {
      currentCodeArrangeSlots: { S1: 'S1d1' },
      currentCode: 'for i in range(5):\n    print(i * 2)',
    })
    // S1 holds the distractor "10"; the L2 blank is empty, so both correct tiles
    // ("5" and the print line) plus the other distractor stay in the pool.
    expect(
      screen
        .getAllByRole('button')
        .map((b) => b.textContent)
        .sort()
    ).toEqual(['    print(i * 2)', '    print(i + 2)', '5'].sort())
  })

  it('derives the board from currentCode when no slots were mirrored', () => {
    renderBody(PYTHON_CODE_ARRANGE_TASK, {
      currentCodeArrangeSlots: null,
      currentCode: 'for i in range(5):\n    print(i * 2)',
    })
    expect(
      screen
        .getAllByRole('button')
        .map((b) => b.textContent)
        .sort()
    ).toEqual(['    print(i + 2)', '10'].sort())
  })

  it('pushes { codeArrangeSlots } when the teacher places a tile', async () => {
    const user = userEvent.setup()
    const onEditAnswer = vi.fn()
    renderBody(
      PYTHON_CODE_ARRANGE_TASK,
      { currentCodeArrangeSlots: {} },
      { answerEditing: true, onEditAnswer }
    )
    await user.click(screen.getByRole('button', { name: '5' }))
    await user.click(screen.getAllByText('Tap to place')[0])
    expect(onEditAnswer).toHaveBeenLastCalledWith({ codeArrangeSlots: { S1: 'S1' } })
  })
})

describe('StudentWorkspaceBody line hints', () => {
  const codeHints = [{ line: 1, text: 'Change the name', target: "name = 'Sam'" }]
  const fileHints = [{ line: 2, text: 'Add a heading', target: '<body>' }]
  const HINTED_TASK = {
    id: 't-hints',
    title: 'Hinted',
    starterCode: "name = 'Sam'\nprint(name)\n",
    lineHintSets: [
      { source: 'starter', stageIndex: null, file: null, hints: codeHints },
      { source: 'starter', stageIndex: null, file: 'index.html', hints: fileHints },
    ],
  }
  const lineHintsOf = () => JSON.parse(screen.getByTestId('code-editor').dataset.lineHints)

  it("passes the task's code hint sets to the mirrored code editor", () => {
    renderBody(HINTED_TASK, { currentCode: "name = 'Sam'\nprint(name)\n" }, { mirror: 'code' })
    expect(lineHintsOf()).toEqual([codeHints])
  })

  it("passes the active file's hint sets in the files mirror", () => {
    const file = { name: 'index.html', type: 'html', content: '<html>\n<body>\n' }
    renderBody(
      HINTED_TASK,
      {},
      {
        mirror: 'files',
        files: [file],
        activeFile: 'index.html',
        activeFileObj: file,
        setActiveFile: vi.fn(),
      }
    )
    expect(lineHintsOf()).toEqual([fileHints])
  })

  it('passes no hints in a session sandbox or for a task without hint markers', () => {
    const { unmount } = renderBody(HINTED_TASK, {}, { mirror: 'code', isSessionSandbox: true })
    expect(lineHintsOf()).toBeNull()
    unmount()
    renderBody({ ...HINTED_TASK, lineHintSets: undefined }, {}, { mirror: 'code' })
    expect(lineHintsOf()).toBeNull()
  })
})
