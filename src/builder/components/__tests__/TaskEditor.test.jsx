import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TaskEditor from '../TaskEditor'

// TaskEditor pulls in CodeMirror, Pyodide, the Scratch VM, and asset-browser machinery through
// its sibling editor components; none of that is exercised by an information task, so it is
// stubbed at the module boundary the same way EditLessonModal.test.jsx stubs TaskEditor itself.
vi.mock('../ExplainerEditor', () => ({
  default: ({ value, onChange }) => (
    <textarea aria-label="Authoring intent editor" value={value ?? ''} onChange={e => onChange(e.target.value)} />
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
    output: '', runStatus: null, running: false, runningTests: false, pyodideStatus: 'idle',
    inputPrompt: null, iframeSrc: null, checkResult: null, checkResults: null,
    incorrectCheckResults: null, testResults: null, htmlPreviewOpen: false, quizSelectedAnswer: '',
    iframeRef: { current: null },
    setCheckResults: vi.fn(), setRunStatus: vi.fn(), setCheckResult: vi.fn(), setIframeSrc: vi.fn(),
    setHtmlPreviewOpen: vi.fn(), setQuizSelectedAnswer: vi.fn(),
    handleRun: vi.fn(), handleRunTests: vi.fn(), handleStop: vi.fn(), handleTestChecks: vi.fn(),
    handleQuizPreviewSelect: vi.fn(), handleInputSubmit: vi.fn(), resetRunState: vi.fn(),
  }),
}))

vi.mock('../../../modules/registry', () => ({
  getLessonModule: () => ({ type: 'python', supportsCopyCode: false, explainerInlineCodeLanguages: [] }),
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

// An information task shows "Authoring metadata" twice by design: once in TaskEditor's own
// editable field (feature 2), and once read-only inside TaskPreviewPanel (feature 1). Both
// collapse independently under the same lesson.draft rule, so these tests disambiguate by
// document order — the editable field is always first — rather than assuming a single instance.
describe('TaskEditor authoring metadata (Task Activity field + collapse)', () => {
  it('renders an editable Task activity field near Authoring intent, seeded from task.taskActivity', () => {
    const task = makeInformationTask()
    render(<TaskEditor task={task} lesson={makeLesson({ draft: true })} onUpdate={vi.fn()} />)
    expect(screen.getAllByText('Task activity').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByDisplayValue('Pair-share discussion')).toBeInTheDocument()
  })

  it('calls onUpdate with the new taskActivity value on edit', () => {
    const task = makeInformationTask()
    const onUpdate = vi.fn()
    render(<TaskEditor task={task} lesson={makeLesson({ draft: true })} onUpdate={onUpdate} />)
    const input = screen.getByDisplayValue('Pair-share discussion')
    fireEvent.change(input, { target: { value: 'Quick demo' } })
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ taskActivity: 'Quick demo' }))
  })

  it('is visible by default when the lesson is a draft, in both the editable field and the read-only preview', () => {
    const task = makeInformationTask()
    render(<TaskEditor task={task} lesson={makeLesson({ draft: true })} onUpdate={vi.fn()} />)
    expect(screen.getAllByText('Authoring metadata', { exact: false })).toHaveLength(2)
    expect(screen.getAllByText('Task activity')).toHaveLength(2)
  })

  it('collapses the editable field by default when the lesson is not a draft, and expands on click', () => {
    const task = makeInformationTask()
    render(<TaskEditor task={task} lesson={makeLesson({ draft: false })} onUpdate={vi.fn()} />)
    // Both the editor's own field and TaskPreviewPanel's read-only section start collapsed.
    expect(screen.queryByText('Task activity')).not.toBeInTheDocument()
    const showButtons = screen.getAllByRole('button', { name: 'Show authoring metadata' })
    expect(showButtons).toHaveLength(2)

    // The first, in document order, is TaskEditor's own editable authoring-metadata field.
    fireEvent.click(showButtons[0])
    expect(screen.getByDisplayValue('Pair-share discussion')).toBeInTheDocument()
    // The preview panel's read-only copy remains collapsed independently.
    expect(screen.getAllByRole('button', { name: 'Show authoring metadata' })).toHaveLength(1)
  })
})
