// Ryan, 2026-10-22: a shared Python link "shows the code... But it doesn't run it!" Run runs the
// shared code in the viewer's browser and answers input() in the output panel.
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

const py = vi.hoisted(() => ({ provideInput: vi.fn(), resolveRun: null, callbacks: null }))
vi.mock('../pyodide', () => ({
  initPyodide: vi.fn(async () => {}),
  stopPython: vi.fn(),
  provideInput: (...args) => py.provideInput(...args),
  runPython: vi.fn((code, callbacks) => {
    py.callbacks = callbacks
    return new Promise((resolve) => {
      py.resolveRun = resolve
    })
  }),
}))

const { default: PythonShareView } = await import('../ShareView.jsx')

describe('Python share link Run', () => {
  it('shows the saved output until Run, then runs the code and takes input', async () => {
    render(<PythonShareView payload={{ code: 'name = input("Name? ")', output: 'saved output' }} />)
    expect(screen.getByText('saved output')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Run/ }))
    expect(await screen.findByRole('button', { name: 'Stop' })).toBeInTheDocument()
    py.callbacks.onOutput('Name? ')
    py.callbacks.onInputRequired('Name? ')
    const input = await screen.findByPlaceholderText('Type your input…')
    await userEvent.type(input, 'Ava{Enter}')
    expect(py.provideInput).toHaveBeenCalledWith('Ava')
    py.callbacks.onOutput('Hi Ava\n')
    py.resolveRun({ status: 'success' })
    expect(await screen.findByText(/Hi Ava/)).toBeInTheDocument()
    expect(screen.queryByText('saved output')).toBeNull()
  })
})
