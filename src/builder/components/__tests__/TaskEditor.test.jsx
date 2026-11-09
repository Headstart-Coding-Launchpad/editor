import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import TaskEditor from '../TaskEditor'
import { forgetTaskEditorTab } from '../task-editor/taskEditorTabs'

// TaskEditor pulls in CodeMirror, Pyodide, the Scratch VM, and asset-browser machinery through
// its sibling editor components; none of that is exercised by an information task, so it is
// stubbed at the module boundary the same way EditLessonModal.test.jsx stubs TaskEditor itself.
vi.mock('../ExplainerEditor', () => ({
  default: ({ value, onChange }) => (
    <textarea
      aria-label="Authoring intent editor"
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}))

vi.mock('../task-editor/TaskEditorFields', () => ({
  Field: ({ label, hint, children }) => (
    <label>
      <span>{label}</span>
      {hint && <span>{hint}</span>}
      {children}
    </label>
  ),
  TaskFormatIcon: () => null,
  SpriteManager: () => null,
  BackdropManager: () => null,
}))

vi.mock('../task-editor/QuizEditors', () => ({
  QuizTypePicker: () => null,
  MatchPairsBuilder: () => null,
  FillBlankBuilder: () => null,
  ShortAnswerBuilder: () => null,
  QuizOptionsBuilder: () => null,
}))

vi.mock('../../../modules/scratch/scratchEditors', () => ({
  ScratchToolboxPicker: () => null,
}))

vi.mock('../task-editor/TaskOptionsSection', () => ({
  default: () => null,
}))

vi.mock('../../hooks/useTaskEditorState', () => ({
  useTaskEditorState: () => ({
    output: '',
    runStatus: null,
    running: false,
    runningTests: false,
    pyodideStatus: 'idle',
    inputPrompt: null,
    iframeSrc: null,
    checkResult: null,
    checkResults: null,
    incorrectCheckResults: null,
    testResults: null,
    htmlPreviewOpen: false,
    quizSelectedAnswer: '',
    iframeRef: { current: null },
    setCheckResults: vi.fn(),
    setRunStatus: vi.fn(),
    setCheckResult: vi.fn(),
    setIframeSrc: vi.fn(),
    setHtmlPreviewOpen: vi.fn(),
    setQuizSelectedAnswer: vi.fn(),
    handleRun: vi.fn(),
    handleRunTests: vi.fn(),
    handleStop: vi.fn(),
    handleTestChecks: vi.fn(),
    handleQuizPreviewSelect: vi.fn(),
    handleInputSubmit: vi.fn(),
    resetRunState: vi.fn(),
  }),
}))

vi.mock('../../../modules/registry', () => ({
  getLessonModule: () => ({
    type: 'python',
    supportsCopyCode: false,
    explainerInlineCodeLanguages: [],
  }),
}))

vi.mock('../../../shared/useLessonStorageAssets', () => ({
  useLessonStorageAssets: () => ({ storageAssets: [] }),
}))

vi.mock('../../../shared/useTypeAssets', () => ({
  useTypeAssets: () => ({ typeStorageAssets: [], defaultSprites: [] }),
}))

function makeInformationTask(overrides = {}) {
  return {
    id: 1,
    title: 'Welcome',
    taskType: 'information',
    informationType: 'standard',
    explainer: 'Hello students',
    intent: 'Warm the class up before the main task.',
    taskActivity: 'Pair-share discussion',
    ...overrides,
  }
}

function makeLesson(overrides = {}) {
  return { id: 'demo-lesson', type: 'python', tasks: [], ...overrides }
}

function openTab(name) {
  fireEvent.click(screen.getByRole('tab', { name: new RegExp(`^${name}`) }))
}

// The tab panel on show (every panel stays mounted; the others are hidden).
function shownPanel() {
  return within(screen.getByRole('tabpanel'))
}

afterEach(() => forgetTaskEditorTab())

// In the Builder the editable authoring metadata is the Authoring notes tab (always open there);
// the Content tab keeps TaskPreviewPanel's read-only copy, which still folds by lesson.draft.
// The Classroom's Edit Lesson (sessionEdit) has no tabs: the fields start folded at the bottom.
describe('TaskEditor authoring metadata (Task Activity field + Authoring notes tab)', () => {
  it('renders an editable Task activity field near Authoring intent, seeded from task.taskActivity', () => {
    const task = makeInformationTask()
    render(<TaskEditor task={task} lesson={makeLesson({ draft: true })} onUpdate={vi.fn()} />)
    openTab('Authoring notes')
    expect(shownPanel().getByText('Task activity')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Pair-share discussion')).toBeInTheDocument()
  })

  it('calls onUpdate with the new taskActivity value on edit', () => {
    const task = makeInformationTask()
    const onUpdate = vi.fn()
    render(<TaskEditor task={task} lesson={makeLesson({ draft: true })} onUpdate={onUpdate} />)
    openTab('Authoring notes')
    const input = screen.getByDisplayValue('Pair-share discussion')
    fireEvent.change(input, { target: { value: 'Quick demo' } })
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ taskActivity: 'Quick demo' }))
  })

  it('on a draft, the Content tab shows the read-only preview copy and no editable field', () => {
    const task = makeInformationTask()
    render(<TaskEditor task={task} lesson={makeLesson({ draft: true })} onUpdate={vi.fn()} />)
    expect(shownPanel().getAllByText('Authoring metadata', { exact: false })).toHaveLength(1)
    expect(shownPanel().queryByDisplayValue('Pair-share discussion')).not.toBeInTheDocument()
  })

  it('when the lesson is not a draft, the preview copy folds but the Authoring notes tab is open', () => {
    const task = makeInformationTask()
    render(<TaskEditor task={task} lesson={makeLesson({ draft: false })} onUpdate={vi.fn()} />)
    expect(shownPanel().queryByText('Task activity')).not.toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Show authoring metadata' })).toHaveLength(1)

    openTab('Authoring notes')
    expect(screen.getByDisplayValue('Pair-share discussion')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Collapse authoring metadata' })).toBeNull()
  })

  it('in the Classroom’s Edit Lesson, has no tabs and starts folded below Priority, even on a draft', () => {
    const task = makeInformationTask()
    render(
      <TaskEditor task={task} lesson={makeLesson({ draft: true })} onUpdate={vi.fn()} sessionEdit />
    )
    expect(screen.queryByRole('tab')).toBeNull()
    expect(screen.queryByDisplayValue('Pair-share discussion')).not.toBeInTheDocument()
    const priority = screen.getByLabelText('Priority')
    const [editorMeta] = screen
      .getAllByRole('button', { name: 'Show authoring metadata' })
      .filter((button) => priority.compareDocumentPosition(button) & 4)
    expect(editorMeta).toBeTruthy()
  })

  it('shows the audit times as readable dates, not raw timestamps', () => {
    const task = { ...makeInformationTask(), intentLastChangedAt: '2026-10-15T14:01:59.909Z' }
    render(<TaskEditor task={task} lesson={makeLesson({ draft: true })} onUpdate={vi.fn()} />)
    openTab('Authoring notes')
    expect(screen.queryByText(/2026-10-15T14:01:59/)).not.toBeInTheDocument()
    expect(screen.getByText(/Intent updated: 15 Oct 2026/)).toBeInTheDocument()
  })
})

describe('TaskEditor block brackets toggle', () => {
  const codeTask = (overrides = {}) => ({
    id: 1,
    title: 'Nest it',
    explainer: 'Indent the inner print.',
    starterCode: 'if a:\n    print(1)\n',
    check: { type: 'output_contains', value: '1' },
    ...overrides,
  })

  it('is checked by default for a Python code task', () => {
    render(<TaskEditor task={codeTask()} lesson={makeLesson()} onUpdate={vi.fn()} />)
    openTab('Settings')
    expect(screen.getByRole('checkbox', { name: /coloured brackets/i })).toBeChecked()
  })

  it('stores showBlocks: false when unticked, and removes it when ticked again', () => {
    const onUpdate = vi.fn()
    const { rerender } = render(
      <TaskEditor task={codeTask()} lesson={makeLesson()} onUpdate={onUpdate} />
    )
    openTab('Settings')
    fireEvent.click(screen.getByRole('checkbox', { name: /coloured brackets/i }))
    expect(onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({ showBlocks: false }))

    rerender(
      <TaskEditor
        task={codeTask({ showBlocks: false })}
        lesson={makeLesson()}
        onUpdate={onUpdate}
      />
    )
    fireEvent.click(screen.getByRole('checkbox', { name: /coloured brackets/i }))
    expect(onUpdate.mock.lastCall[0]).not.toHaveProperty('showBlocks')
  })

  it('is not offered on an HTML lesson', () => {
    render(
      <TaskEditor task={codeTask()} lesson={makeLesson({ type: 'html' })} onUpdate={vi.fn()} />
    )
    openTab('Settings')
    expect(screen.queryByRole('checkbox', { name: /coloured brackets/i })).not.toBeInTheDocument()
  })
})
