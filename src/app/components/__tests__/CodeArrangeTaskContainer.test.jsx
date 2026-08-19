import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import CodeArrangeTaskContainer from '../CodeArrangeTaskContainer'

const PYTHON_TASK = {
  id: 1,
  moduleType: 'python',
  lines: [
    { id: 'L1', parts: [{ type: 'slot', id: 'L1', code: 'for i in range(5): print(i * 2)' }] },
    { id: 'L2', parts: [{ type: 'slot', id: 'L2', code: 'print("done")' }] },
  ],
  distractors: [{ id: 'D1', code: 'print("wrong")' }],
  check: { type: 'output', operator: 'equals', value: '0\n2\n4\n6\n8' },
}

const HTML_TASK = {
  id: 2,
  moduleType: 'html',
  entryFile: 'index.html',
  lines: [{ id: 'L1', parts: [{ type: 'slot', id: 'L1', code: '<h1>Hello</h1>' }] }],
  distractors: [{ id: 'D1', code: '<h2>Hello</h2>' }],
  check: { type: 'html_element', operator: 'exists', selector: 'h1' },
}

function makeCs(overrides = {}) {
  return {
    readSavedTaskFile: vi.fn(() => {
      throw new Error('readSavedTaskFile must not be called for a teacher live mirror')
    }),
    readSavedTaskCode: vi.fn(() => null),
    saveTaskAuxFile: vi.fn(),
    handleCodeChange: vi.fn(),
    handleFileChange: vi.fn(),
    handleCodeArrangeSlotsChange: vi.fn(),
    handleRun: vi.fn(),
    handleStop: vi.fn(),
    output: '',
    runStatus: null,
    running: false,
    checkPassed: false,
    checkAttempted: false,
    pyodideStatus: 'ready',
    iframeSrc: null,
    iframeRef: { current: null },
    teacherLiveIframeSrc: null,
    ...overrides,
  }
}

describe('CodeArrangeTaskContainer — teacher live mirror', () => {
  it('reconstructs the tile board from displayCode (never local storage) when a teacher is watching a broadcast ("Go Live")', () => {
    const cs = makeCs()
    render(
      <CodeArrangeTaskContainer
        task={PYTHON_TASK}
        cs={cs}
        currentTaskId={1}
        viewingTaskId={null}
        isViewingPrev={false}
        isForcedTeacherLive
        isTeacherEditing={false}
        displayCode={'for i in range(5): print(i * 2)\nprint("done")'}
      />
    )

    expect(screen.queryAllByText('Empty line')).toHaveLength(0)
    expect(screen.getByText('for i in range(5): print(i * 2)')).toBeInTheDocument()
    expect(screen.getByText('print("done")')).toBeInTheDocument()
    expect(cs.readSavedTaskFile).not.toHaveBeenCalled()
  })

  it('reconstructs the tile board from teacherLiveCode (never local storage) during an accepted teacher-edit session', () => {
    const cs = makeCs()
    render(
      <CodeArrangeTaskContainer
        task={PYTHON_TASK}
        cs={cs}
        currentTaskId={1}
        viewingTaskId={null}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        isTeacherEditing
        teacherLiveCode={'print("done")\nfor i in range(5): print(i * 2)'}
      />
    )

    expect(screen.queryAllByText('Empty line')).toHaveLength(0)
    expect(screen.getByText('print("done")')).toBeInTheDocument()
    expect(screen.getByText('for i in range(5): print(i * 2)')).toBeInTheDocument()
    expect(cs.readSavedTaskFile).not.toHaveBeenCalled()
  })

  it('shows an empty, non-crashing board when the synced code does not match any known fragment', () => {
    const cs = makeCs()
    render(
      <CodeArrangeTaskContainer
        task={PYTHON_TASK}
        cs={cs}
        currentTaskId={1}
        viewingTaskId={null}
        isViewingPrev={false}
        isForcedTeacherLive
        isTeacherEditing={false}
        displayCode={'print("this line was never authored as a tile")'}
      />
    )

    expect(screen.getAllByText('Empty line')).toHaveLength(2)
    expect(cs.readSavedTaskFile).not.toHaveBeenCalled()
  })

  it('shows an empty board gracefully when there is no synced code yet', () => {
    const cs = makeCs()
    render(
      <CodeArrangeTaskContainer
        task={PYTHON_TASK}
        cs={cs}
        currentTaskId={1}
        viewingTaskId={null}
        isViewingPrev={false}
        isForcedTeacherLive
        isTeacherEditing={false}
        displayCode={undefined}
      />
    )

    expect(() => screen.getAllByText('Empty line')).not.toThrow()
    expect(screen.getAllByText('Empty line')).toHaveLength(2)
  })

  it('reconstructs an HTML tile board from the matching file in displayFiles', () => {
    const cs = makeCs()
    render(
      <CodeArrangeTaskContainer
        task={HTML_TASK}
        cs={cs}
        currentTaskId={2}
        viewingTaskId={null}
        isViewingPrev={false}
        isForcedTeacherLive
        isTeacherEditing={false}
        displayFiles={[{ name: 'index.html', content: '<h1>Hello</h1>' }]}
      />
    )

    expect(screen.queryAllByText('Empty line')).toHaveLength(0)
    expect(screen.getByText('<h1>Hello</h1>')).toBeInTheDocument()
  })

  it('mirrors displayOutput/displayCheckPassed rather than this browser\'s own cs.output while forced-live', async () => {
    const cs = makeCs({ output: 'stale local output', checkPassed: true })
    const { container } = render(
      <CodeArrangeTaskContainer
        task={PYTHON_TASK}
        cs={cs}
        currentTaskId={1}
        viewingTaskId={null}
        isViewingPrev={false}
        isForcedTeacherLive
        isTeacherEditing={false}
        displayCode={'for i in range(5): print(i * 2)\nprint("done")'}
        displayOutput={'0\n2\n4\n6\n8'}
        displayCheckPassed={false}
      />
    )

    // OutputPanel types output out progressively (real timers), so wait for
    // it to catch up rather than reading the DOM synchronously.
    await waitFor(() => {
      expect(container.querySelector('pre')?.textContent?.replace(/\s+/g, '')).toBe('02468')
    })
    expect(screen.queryByText('stale local output')).not.toBeInTheDocument()
  })

  it('still loads the arrangement from local storage for the student\'s own session (unchanged behaviour)', () => {
    const cs = makeCs({
      readSavedTaskFile: vi.fn(() => JSON.stringify({ L1: 'L1', L2: 'L2' })),
    })
    render(
      <CodeArrangeTaskContainer
        task={PYTHON_TASK}
        cs={cs}
        currentTaskId={1}
        viewingTaskId={null}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        isTeacherEditing={false}
      />
    )

    expect(cs.readSavedTaskFile).toHaveBeenCalledWith(1, '__code_arrange_slots__')
    expect(screen.getByText('for i in range(5): print(i * 2)')).toBeInTheDocument()
    expect(screen.getByText('print("done")')).toBeInTheDocument()
  })

  it('mirrors each tile placement live via cs.handleCodeArrangeSlotsChange, not just on completion', async () => {
    const user = userEvent.setup()
    const cs = makeCs({ readSavedTaskFile: vi.fn(() => null) })
    render(
      <CodeArrangeTaskContainer
        task={PYTHON_TASK}
        cs={cs}
        currentTaskId={1}
        viewingTaskId={null}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        isTeacherEditing={false}
      />
    )

    await user.click(screen.getByText('print("done")'))
    await user.click(screen.getAllByText('Tap to place')[0])

    expect(cs.handleCodeArrangeSlotsChange).toHaveBeenCalledWith({ L1: 'L2' })
    // Only one blank is filled — the assembled code isn't complete yet, so
    // the normal code-sync path must not have fired.
    expect(cs.handleCodeChange).not.toHaveBeenCalled()
  })

  it('never mirrors tile placements live for a teacher live mirror (read-only)', () => {
    const cs = makeCs()
    render(
      <CodeArrangeTaskContainer
        task={PYTHON_TASK}
        cs={cs}
        currentTaskId={1}
        viewingTaskId={null}
        isViewingPrev={false}
        isForcedTeacherLive
        isTeacherEditing={false}
        displayCode={'for i in range(5): print(i * 2)\nprint("done")'}
      />
    )

    expect(cs.handleCodeArrangeSlotsChange).not.toHaveBeenCalled()
  })

  it('shows an input box wired to handleInputSubmit while the student\'s own code is awaiting input()', () => {
    const cs = makeCs({ readSavedTaskFile: vi.fn(() => null), inputPrompt: '', output: 'What is your name?' })
    render(
      <CodeArrangeTaskContainer
        task={PYTHON_TASK}
        cs={cs}
        currentTaskId={1}
        viewingTaskId={null}
        isViewingPrev={false}
        isForcedTeacherLive={false}
        isTeacherEditing={false}
      />
    )

    expect(screen.getByPlaceholderText('Type your input and press Enter')).toBeInTheDocument()
  })

  it('never shows an input box for a teacher live mirror, even if this browser\'s own cs.inputPrompt happens to be set', () => {
    const cs = makeCs({ inputPrompt: '' })
    render(
      <CodeArrangeTaskContainer
        task={PYTHON_TASK}
        cs={cs}
        currentTaskId={1}
        viewingTaskId={null}
        isViewingPrev={false}
        isForcedTeacherLive
        isTeacherEditing={false}
        displayCode={'for i in range(5): print(i * 2)\nprint("done")'}
      />
    )

    expect(screen.queryByPlaceholderText('Type your input and press Enter')).not.toBeInTheDocument()
  })
})
