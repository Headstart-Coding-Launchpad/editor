import React from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import StudentWorkspace from '../StudentWorkspace'

// The calm code screen's code row: Code · 😊 · Topic library · Blocks · Reset Code · Run, with
// Run's Stop and "Getting Python ready..." in the same slot; and the Type this out text as the
// one "What to change" box.
const baseCs = {
  code: 'from stage import *\nbackground("black")',
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

const copyTask = {
  id: 36,
  title: '🪐 Design Your Planet',
  copyCode: 'circle(90, "orange", x=100, y=250)',
  copyAfter: 'background("black")',
}

// LessonTaskContent (the calm host) always passes whatToChange; other hosts pass none.
const calmHost = { folded: false, onToggle: () => {} }

function renderWorkspace({ task = copyTask, cs = {}, whatToChange = calmHost, ...props } = {}) {
  return render(
    <StudentWorkspace
      task={task}
      cs={{ ...baseCs, ...cs }}
      lessonId="lesson-1"
      identityId="student-1"
      viewingTaskId={null}
      isSandbox={false}
      isViewingPrev={false}
      isForcedTeacherLive={false}
      isMobile={false}
      isTeacherEditing={false}
      teacherLiveCode=""
      whatToChange={whatToChange}
      {...props}
    />
  )
}

describe('Python StudentWorkspace calm code row', () => {
  it('has Code, the 😊 Emoji button (44px), Blocks, Reset Code and Run', () => {
    renderWorkspace()
    const row = screen.getByRole('group', { name: 'Code' })
    const emoji = screen.getByRole('button', { name: 'Insert emoji' })
    expect(row).toContainElement(emoji)
    expect(emoji).toHaveTextContent('😊')
    expect(emoji.style.height).toBe('44px')
    expect(row).toContainElement(screen.getByRole('button', { name: /Blocks/ }))
    expect(row).toContainElement(screen.getByRole('button', { name: /Reset/ }))
    const run = screen.getByRole('button', { name: 'Run' })
    expect(row).toContainElement(run)
    expect(run).toHaveAttribute('data-highlight-target', 'run stop')
    expect(run.style.minHeight).toBe('44px')
  })

  it('still hides Blocks for a task with showBlocks: false', () => {
    renderWorkspace({ task: { ...copyTask, showBlocks: false } })
    expect(screen.queryByRole('button', { name: /Blocks/ })).not.toBeInTheDocument()
  })

  it('keeps Stop and "Getting Python ready..." in the Run slot', () => {
    const { unmount } = renderWorkspace({ cs: { running: true } })
    expect(screen.getByRole('button', { name: 'Stop' })).toHaveAttribute(
      'data-highlight-target',
      'run stop'
    )
    unmount()
    renderWorkspace({ cs: { pyodideStatus: 'loading' } })
    expect(screen.getByRole('button', { name: 'Getting Python ready...' })).toHaveAttribute(
      'data-highlight-target',
      'run stop'
    )
  })

  it('the Topic library chip in the code row opens the library', async () => {
    const user = userEvent.setup()
    const onOpenTopicLibrary = vi.fn()
    renderWorkspace({ onOpenTopicLibrary })
    await user.click(screen.getByRole('button', { name: /Topic library/ }))
    expect(onOpenTopicLibrary).toHaveBeenCalledTimes(1)
  })

  it('has no Topic library chip in the code row when the explainer keeps its own', () => {
    renderWorkspace()
    expect(screen.queryByRole('button', { name: /Topic library/ })).not.toBeInTheDocument()
  })
})

describe('Python StudentWorkspace "What to change" box (Type this out)', () => {
  it('shows the lines to type in one "What to change" box, open on first view', () => {
    renderWorkspace()
    const box = screen.getByRole('region', { name: 'What to change' })
    expect(box).toHaveTextContent('circle(90, "orange", x=100, y=250)')
    expect(screen.queryByText('⌨️ Type this out')).not.toBeInTheDocument()
  })

  it('folded, it is one readable line that reopens on tap', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    renderWorkspace({ whatToChange: { folded: true, onToggle } })
    const reopen = screen.getByRole('button', { name: /Show what to change/ })
    expect(reopen).toHaveTextContent('circle(90, "orange", x=100, y=250)')
    expect(parseFloat(reopen.style.fontSize)).toBeGreaterThanOrEqual(13)
    expect(screen.queryByLabelText(/unchanged anchor/)).not.toBeInTheDocument()
    await user.click(reopen)
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('gives way to the Complete stage change view (no second copy of the same lines)', () => {
    renderWorkspace({ whatToChange: { hideCopyCode: true } })
    expect(screen.queryByRole('region', { name: 'What to change' })).not.toBeInTheDocument()
  })
})

describe('Python StudentWorkspace code row stays one row', () => {
  it('ends with Run, with Run Tests before it', () => {
    renderWorkspace({ task: { ...copyTask, tests: [{ input: '', expected: '' }] } })
    const buttons = within(screen.getByRole('group', { name: 'Code' })).getAllByRole('button')
    expect(buttons.at(-1).textContent).toBe('Run')
    expect(buttons.at(-2).textContent).toBe('Run Tests')
  })

  it("predict mode's lock note sits under the row, so Run stays last in it", () => {
    renderWorkspace({
      cs: { predictRunLock: { message: 'Fill in your predictions', missing: ['x'] } },
    })
    const row = screen.getByRole('group', { name: 'Code' })
    const note = screen.getByRole('button', { name: /Fill in your predictions/ })
    expect(row).not.toContainElement(note)
    expect(within(row).getAllByRole('button').at(-1).textContent).toBe('Run')
  })

  it('has its own spacing class, and the CSS gives it real spacing', () => {
    renderWorkspace()
    expect(screen.getByRole('group', { name: 'Code' })).toHaveClass('ui-tabs--code-row')
    const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')
    expect(css).toMatch(/\.ui-tabs--editor\.ui-tabs--code-row\s*\{[^}]*padding:[^}]*!important/)
    expect(css).toMatch(/\.ui-tabs--editor\.ui-tabs--code-row\s*\{[^}]*gap:[^}]*!important/)
  })
})

describe('Python StudentWorkspace outside the calm host', () => {
  it('without the calm pieces (teacher view, Builder, share view) keeps the editor toolbar and Type this out', () => {
    renderWorkspace({ whatToChange: null })
    expect(screen.getByText('⌨️ Type this out')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'What to change' })).not.toBeInTheDocument()
    const row = screen.getByRole('group', { name: 'Code' })
    expect(within(row).queryByRole('button', { name: 'Insert emoji' })).not.toBeInTheDocument()
    expect(within(row).queryByRole('button', { name: /Blocks/ })).not.toBeInTheDocument()
    const tools = screen.getByRole('toolbar', { name: 'Python editor tools' })
    expect(within(tools).getByRole('button', { name: /Blocks/ })).toBeInTheDocument()
    expect(within(row).getByRole('button', { name: 'Run' })).toBeInTheDocument()
  })
})
