// Ryan, 11 Nov 2026 (usability fix, sketch OK'd): the Python share page looks like the classroom
// editor. Code card with Run in its titled bar, a titled Stage card, and the classroom Output
// panel both before and after Run, so the page does not jump when the viewer presses Run.
import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../pyodide', () => ({
  initPyodide: vi.fn(async () => {}),
  stopPython: vi.fn(),
  provideInput: vi.fn(),
  runPython: vi.fn(() => new Promise(() => {})),
}))

const { default: PythonShareView } = await import('../ShareView.jsx')

const stageJson = JSON.stringify({
  commands: [{ type: 'circle', x: 200, y: 200, r: 90, colour: 'orange' }],
})

describe('Python share page layout', () => {
  it('puts Run in the Code card bar, with the note under it', () => {
    render(<PythonShareView payload={{ code: 'print(1)', output: '1\n', stageJson }} />)
    const code = screen.getByRole('region', { name: 'Code' })
    const bar = within(code).getByText('Code').parentElement
    expect(within(bar).getByRole('button', { name: /Run/ })).toBeInTheDocument()
    expect(within(code).getByText(/Nothing is saved/)).toBeInTheDocument()
  })

  it('shows the drawing in a titled Stage card', () => {
    render(<PythonShareView payload={{ code: 'print(1)', output: '', stageJson }} />)
    const stage = screen.getByRole('region', { name: 'Stage' })
    expect(within(stage).getByText('Stage')).toBeInTheDocument()
    // compact: no Save my picture or Target buttons on a share page.
    expect(within(stage).queryByRole('button')).toBeNull()
  })

  it('shows the saved output in the same Output panel before and after Run', async () => {
    render(<PythonShareView payload={{ code: 'print(1)', output: 'saved output', stageJson }} />)
    const panel = screen.getByTestId('output-panel')
    expect(await within(panel).findByText('saved output')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Run/ }))
    expect(await screen.findByRole('button', { name: 'Stop' })).toBeInTheDocument()
    expect(screen.getByTestId('output-panel')).toBe(panel)
  })

  it('without a drawing, has no Stage card and still shows the Output panel', () => {
    render(<PythonShareView payload={{ code: 'print(1)', output: '' }} />)
    expect(screen.queryByRole('region', { name: 'Stage' })).toBeNull()
    expect(screen.getByTestId('output-panel')).toBeInTheDocument()
  })
})
