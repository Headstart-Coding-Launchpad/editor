// Ryan, 11 Nov 2026 (usability fix, sketch OK'd): the Python share page looks like the classroom
// editor. Code card with Run in its titled bar, a titled Stage card, and the classroom Output
// panel both before and after Run, so the page does not jump when the viewer presses Run.
import React from 'react'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../pyodide', () => ({
  initPyodide: vi.fn(async () => {}),
  stopPython: vi.fn(),
  provideInput: vi.fn(),
  runPython: vi.fn(() => new Promise(() => {})),
}))

const py = await import('../pyodide')
const { default: PythonShareView } = await import('../ShareView.jsx')

const stageJson = JSON.stringify({
  commands: [{ type: 'circle', x: 200, y: 200, r: 90, colour: 'orange' }],
})

function codeBar() {
  return screen.getByRole('heading', { level: 2, name: 'Code' }).parentElement
}

const desktopWidth = window.innerWidth
afterEach(() => {
  window.innerWidth = desktopWidth
})

describe('Python share page layout', () => {
  it('puts Run in the Code card bar under an h2, with the note under it', () => {
    render(<PythonShareView payload={{ code: 'print(1)', output: '1\n', stageJson }} />)
    const code = screen.getByRole('region', { name: 'Code' })
    expect(within(codeBar()).getByRole('button', { name: /Run/ })).toBeInTheDocument()
    expect(within(code).getByText(/Nothing is saved/)).toBeInTheDocument()
  })

  it('shows the drawing in a Stage card titled with an h2', () => {
    render(<PythonShareView payload={{ code: 'print(1)', output: '', stageJson }} />)
    const stage = screen.getByRole('region', { name: 'Stage' })
    expect(within(stage).getByRole('heading', { level: 2, name: 'Stage' })).toBeInTheDocument()
    // compact: no Save my picture or Target buttons on a share page.
    expect(within(stage).queryByRole('button')).toBeNull()
  })

  it('switches to the Stage layout only when there is a drawing', () => {
    const { container, unmount } = render(
      <PythonShareView payload={{ code: 'print(1)', output: '', stageJson }} />
    )
    expect(container.firstChild).toHaveClass('share-py', 'share-py--stage')
    unmount()
    const { container: plain } = render(<PythonShareView payload={{ code: 'x', output: '' }} />)
    expect(plain.firstChild).toHaveClass('share-py')
    expect(plain.firstChild).not.toHaveClass('share-py--stage')
  })

  it('shows the saved output at once, before Run, in a named Output region', () => {
    render(<PythonShareView payload={{ code: 'print(1)', output: 'saved output', stageJson }} />)
    const region = screen.getByRole('region', { name: 'Output' })
    // No typing delay on first paint: the saved output is there straight away.
    expect(within(region).getByText('saved output')).toBeInTheDocument()
    expect(within(region).getByTestId('output-panel')).toBeInTheDocument()
  })

  it('keeps the same Output panel and the saved drawing while a run is going', async () => {
    render(<PythonShareView payload={{ code: 'print(1)', output: 'saved output', stageJson }} />)
    const panel = screen.getByTestId('output-panel')
    await userEvent.click(screen.getByRole('button', { name: /Run/ }))
    // Stop sits in the Code bar, beside Run.
    expect(await within(codeBar()).findByRole('button', { name: 'Stop' })).toBeInTheDocument()
    expect(screen.getByTestId('output-panel')).toBe(panel)
    expect(screen.getByRole('region', { name: 'Stage' })).toBeInTheDocument()
  })

  it('keeps the saved drawing when a run ends without drawing (error or Stop)', async () => {
    py.runPython.mockImplementationOnce(async () => ({ status: 'error' }))
    const { container } = render(
      <PythonShareView payload={{ code: 'oops(', output: 'saved output', stageJson }} />
    )
    await userEvent.click(screen.getByRole('button', { name: /Run/ }))
    expect(await screen.findByRole('button', { name: /Run/ })).toBeEnabled()
    expect(screen.getByRole('region', { name: 'Stage' })).toBeInTheDocument()
    expect(container.firstChild).toHaveClass('share-py--stage')
  })

  it('keeps the saved drawing when Python falls asleep before running', async () => {
    py.initPyodide.mockImplementationOnce(async () => {
      throw new Error('Python fell asleep')
    })
    render(<PythonShareView payload={{ code: 'print(1)', output: '', stageJson }} />)
    await userEvent.click(screen.getByRole('button', { name: /Run/ }))
    expect(await screen.findByRole('button', { name: /Run/ })).toBeEnabled()
    expect(screen.getByRole('region', { name: 'Stage' })).toBeInTheDocument()
  })

  it("shows a run's own drawing once it draws one", async () => {
    const drawn = { commands: [{ type: 'rect', x: 0, y: 0, w: 10, h: 10, colour: 'red' }] }
    py.runPython.mockImplementationOnce(async () => ({ status: 'success', stage: drawn }))
    render(<PythonShareView payload={{ code: 'print(1)', output: '' }} />)
    expect(screen.queryByRole('region', { name: 'Stage' })).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: /Run/ }))
    expect(await screen.findByRole('region', { name: 'Stage' })).toBeInTheDocument()
  })

  it('without a drawing, has no Stage card and still shows the Output panel', () => {
    render(<PythonShareView payload={{ code: 'print(1)', output: '' }} />)
    expect(screen.queryByRole('region', { name: 'Stage' })).toBeNull()
    expect(screen.getByTestId('output-panel')).toBeInTheDocument()
  })

  it('on a phone, opens the Output right under the Run bar, above the code (#301)', () => {
    window.innerWidth = 390
    render(<PythonShareView payload={{ code: 'print(1)', output: 'saved output', stageJson }} />)
    const code = screen.getByRole('region', { name: 'Code' })
    const output = within(code).getByRole('region', { name: 'Output' })
    const run = within(codeBar()).getByRole('button', { name: /Run/ })
    const editor = code.querySelector('.share-py-editor')
    // Document order: Run bar, then Output, then the editor.
    expect(run.compareDocumentPosition(output) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(output.compareDocumentPosition(editor) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('on a PC, keeps the Output outside the Code card (right column)', () => {
    render(<PythonShareView payload={{ code: 'print(1)', output: '', stageJson }} />)
    const code = screen.getByRole('region', { name: 'Code' })
    expect(within(code).queryByRole('region', { name: 'Output' })).toBeNull()
    expect(screen.getByRole('region', { name: 'Output' })).toBeInTheDocument()
  })

  it("types a run's live output, not the saved output", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      render(<PythonShareView payload={{ code: 'print(1)', output: 'saved output' }} />)
      expect(screen.getByText('saved output')).toBeInTheDocument()
      await act(async () => {
        screen.getByRole('button', { name: /Run/ }).click()
      })
      await act(async () => {
        py.runPython.mock.calls.at(-1)[1].onOutput('hello from the run')
      })
      // The run's output types in: not all there on the first frame.
      expect(screen.queryByText('hello from the run')).toBeNull()
      await act(async () => {
        vi.advanceTimersByTime(2000)
      })
      expect(screen.getByText('hello from the run')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
