import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SharedWorkspaceViewer from '../SharedWorkspaceViewer'

// The viewer is judged on what it does NOT do, so the module surfaces are
// stubbed down to something we can type into and assert against.
vi.mock('../../../shared/CodeEditor', () => ({
  CodeEditor: ({ value, onChange, readOnly }) => (
    <textarea
      data-testid="code-editor"
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
}))

vi.mock('../../../modules/scratch/ScratchWorkspace.jsx', () => ({
  default: ({ initialState }) => (
    <div data-testid="scratch-workspace">{JSON.stringify(initialState)}</div>
  ),
}))

vi.mock('../../../modules/html/TeacherLiveView.jsx', () => ({
  default: ({ displayState, onChange }) => (
    <div data-testid="html-view">
      {displayState.files.map((f) => (
        <textarea
          key={f.name}
          aria-label={f.name}
          value={f.content}
          onChange={(e) => onChange(f.name, e.target.value)}
        />
      ))}
    </div>
  ),
}))

vi.mock('../../../modules/arcade/TeacherLiveView.jsx', () => ({ default: () => <div /> }))
vi.mock('../../../modules/electronics/TeacherLiveView.jsx', () => ({ default: () => <div /> }))
vi.mock('../IframePreview', () => ({
  default: ({ src }) => <div data-testid="iframe-preview">{src}</div>,
}))
vi.mock('../OutputPanel', () => ({
  default: ({ output }) => <div data-testid="output">{output}</div>,
}))

const runMock = vi.fn(() => Promise.resolve({ status: 'success' }))
const buildPreviewSrcMock = vi.fn(() => 'blob:preview')

vi.mock('../../../modules/registry', () => ({
  getLessonModule: (type) => {
    if (type === 'python') {
      return {
        type: 'python',
        deserializeState: (raw) => raw,
        runtime: { run: runMock, init: vi.fn(), stop: vi.fn(), provideInput: vi.fn() },
      }
    }
    if (type === 'html') {
      return { type: 'html', runtime: { buildPreviewSrc: buildPreviewSrcMock } }
    }
    if (type === 'scratch') {
      return { type: 'scratch', deserializeState: (raw) => raw, runtime: {} }
    }
    return null
  },
}))

const PYTHON_LESSON = { type: 'python', tasks: [{ id: 1, title: 'Loops' }] }
const HTML_LESSON = { type: 'html', tasks: [{ id: 1, title: 'Page', entryFile: 'index.html' }] }
const SCRATCH_LESSON = { type: 'scratch', tasks: [{ id: 1, title: 'Blocks' }] }

const ENTRY = { shareId: 'share-1', sharerName: 'Jamie', sharerId: 'stu-1' }

function pythonSnapshot(overrides = {}) {
  return {
    lessonType: 'python',
    taskId: 1,
    code: 'print("theirs")',
    files: {},
    output: '',
    runStatus: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  runMock.mockResolvedValue({ status: 'success' })
  buildPreviewSrcMock.mockReturnValue('blob:preview')
})

describe('SharedWorkspaceViewer', () => {
  it('shows whose work it is and reassures the viewer', () => {
    render(
      <SharedWorkspaceViewer lesson={PYTHON_LESSON} entry={ENTRY} snapshot={pythonSnapshot()} />
    )
    expect(screen.getByText(/Jamie's workspace/)).toBeInTheDocument()
    expect(screen.getByText(/your own work is safe and unchanged/i)).toBeInTheDocument()
  })

  it('loads the shared code into an editable editor', () => {
    render(
      <SharedWorkspaceViewer lesson={PYTHON_LESSON} entry={ENTRY} snapshot={pythonSnapshot()} />
    )
    const editor = screen.getByTestId('code-editor')
    expect(editor).toHaveValue('print("theirs")')
    expect(editor).not.toHaveAttribute('readonly')
  })

  // The whole point of the feature: editing and running someone else's work
  // must not reach localStorage or Firebase by any path.
  it('writes nothing to localStorage when edited and run', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    render(
      <SharedWorkspaceViewer lesson={PYTHON_LESSON} entry={ENTRY} snapshot={pythonSnapshot()} />
    )

    await userEvent.type(screen.getByTestId('code-editor'), 'X')
    await userEvent.click(screen.getByRole('button', { name: /run/i }))
    await waitFor(() => expect(runMock).toHaveBeenCalled())

    expect(setItem).not.toHaveBeenCalled()
    setItem.mockRestore()
  })

  it('runs the shared code and shows its output without touching the task', async () => {
    runMock.mockImplementation(async (_code, _task, cbs) => {
      cbs.onOutput('hello from Jamie')
      return { status: 'success' }
    })
    render(
      <SharedWorkspaceViewer lesson={PYTHON_LESSON} entry={ENTRY} snapshot={pythonSnapshot()} />
    )

    await userEvent.click(screen.getByRole('button', { name: /run/i }))
    expect(await screen.findByTestId('output')).toHaveTextContent('hello from Jamie')
  })

  it('runs the edited copy, not the original snapshot', async () => {
    render(
      <SharedWorkspaceViewer lesson={PYTHON_LESSON} entry={ENTRY} snapshot={pythonSnapshot()} />
    )
    await userEvent.clear(screen.getByTestId('code-editor'))
    await userEvent.type(screen.getByTestId('code-editor'), 'print(1)')
    await userEvent.click(screen.getByRole('button', { name: /run/i }))

    await waitFor(() => expect(runMock).toHaveBeenCalledWith('print(1)', expect.anything(), expect.anything()))
  })

  it('closes back to the student own work', async () => {
    const onClose = vi.fn()
    render(
      <SharedWorkspaceViewer
        lesson={PYTHON_LESSON}
        entry={ENTRY}
        snapshot={pythonSnapshot()}
        onClose={onClose}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /back to my work/i }))
    expect(onClose).toHaveBeenCalled()
  })

  describe('copy to my editor', () => {
    it('is offered only for the task the student is on', () => {
      const { rerender } = render(
        <SharedWorkspaceViewer
          lesson={PYTHON_LESSON}
          entry={ENTRY}
          snapshot={pythonSnapshot()}
          copyTargetTaskId={1}
          onCopyToMyEditor={vi.fn()}
        />
      )
      expect(screen.getByRole('button', { name: /copy to my editor/i })).toBeInTheDocument()

      rerender(
        <SharedWorkspaceViewer
          lesson={PYTHON_LESSON}
          entry={ENTRY}
          snapshot={pythonSnapshot()}
          copyTargetTaskId={7}
          onCopyToMyEditor={vi.fn()}
        />
      )
      expect(screen.queryByRole('button', { name: /copy to my editor/i })).not.toBeInTheDocument()
    })

    it('warns before overwriting and does nothing if cancelled', async () => {
      const onCopy = vi.fn()
      render(
        <SharedWorkspaceViewer
          lesson={PYTHON_LESSON}
          entry={ENTRY}
          snapshot={pythonSnapshot()}
          copyTargetTaskId={1}
          onCopyToMyEditor={onCopy}
        />
      )
      await userEvent.click(screen.getByRole('button', { name: /copy to my editor/i }))
      expect(screen.getByRole('alertdialog')).toHaveTextContent(/replaces your own code/i)

      await userEvent.click(screen.getByRole('button', { name: /^cancel$/i }))
      expect(onCopy).not.toHaveBeenCalled()
    })

    it('copies the edited copy once confirmed', async () => {
      const onCopy = vi.fn()
      render(
        <SharedWorkspaceViewer
          lesson={PYTHON_LESSON}
          entry={ENTRY}
          snapshot={pythonSnapshot()}
          copyTargetTaskId={1}
          onCopyToMyEditor={onCopy}
        />
      )
      await userEvent.clear(screen.getByTestId('code-editor'))
      await userEvent.type(screen.getByTestId('code-editor'), 'mine now')
      await userEvent.click(screen.getByRole('button', { name: /copy to my editor/i }))
      await userEvent.click(screen.getByRole('button', { name: /replace my work/i }))

      expect(onCopy).toHaveBeenCalledWith(
        expect.objectContaining({ code: 'mine now', moduleType: 'python' })
      )
    })
  })

  describe('per-module rendering', () => {
    it('renders an HTML share with its files and previews on run', async () => {
      render(
        <SharedWorkspaceViewer
          lesson={HTML_LESSON}
          entry={ENTRY}
          snapshot={{
            lessonType: 'html',
            taskId: 1,
            code: '',
            files: { 'index.html': '<p>hi</p>' },
          }}
        />
      )
      expect(screen.getByLabelText('index.html')).toHaveValue('<p>hi</p>')

      await userEvent.click(screen.getByRole('button', { name: /run/i }))
      expect(await screen.findByTestId('iframe-preview')).toHaveTextContent('blob:preview')
    })

    it('renders a Scratch share in a workspace keyed to the share', () => {
      render(
        <SharedWorkspaceViewer
          lesson={SCRATCH_LESSON}
          entry={ENTRY}
          snapshot={{ lessonType: 'scratch', taskId: 1, code: '{"blocks":1}', files: {} }}
        />
      )
      expect(screen.getByTestId('scratch-workspace')).toHaveTextContent('"blocks":1')
      // Scratch runs inside its own workspace — no external Run button.
      expect(screen.queryByRole('button', { name: /^▶ Run$/ })).not.toBeInTheDocument()
    })

    // A share outlives its task, so in a composed lesson it may be a different
    // module from whatever the class is on now.
    it('renders by the snapshot own module, not the current lesson type', () => {
      render(
        <SharedWorkspaceViewer
          lesson={PYTHON_LESSON}
          entry={ENTRY}
          snapshot={{ lessonType: 'scratch', taskId: 1, code: '{"blocks":2}', files: {} }}
        />
      )
      expect(screen.getByTestId('scratch-workspace')).toBeInTheDocument()
      expect(screen.queryByTestId('code-editor')).not.toBeInTheDocument()
    })
  })
  // It replaces the workspace in place rather than floating over it, so it
  // reads as the same surface the student already knows.
  it('renders inline rather than as a fixed overlay dialog', () => {
    const { container } = render(
      <SharedWorkspaceViewer lesson={PYTHON_LESSON} entry={ENTRY} snapshot={pythonSnapshot()} />
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(container.firstChild).not.toHaveStyle({ position: 'fixed' })
  })
})
