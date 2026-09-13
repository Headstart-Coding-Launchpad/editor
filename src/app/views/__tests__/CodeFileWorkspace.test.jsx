import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CodeFileWorkspace from '../CodeFileWorkspace'

const mocks = vi.hoisted(() => ({
  runPython: vi.fn(),
}))

vi.mock('../../../shared/useIsMobile', () => ({ useIsMobile: () => false }))
vi.mock('../../components/TopBar', () => ({
  default: ({ lessonTitle, right }) => (
    <div>
      {lessonTitle}
      {right}
    </div>
  ),
}))
vi.mock('../../components/OutputPanel', () => ({
  default: ({ output, runStatus }) => (
    <div>
      {output} {runStatus}
    </div>
  ),
}))
vi.mock('../../../modules/python/PythonEditor', () => ({
  default: ({ code, onChange }) => (
    <textarea aria-label="Python code" value={code} onChange={(e) => onChange(e.target.value)} />
  ),
}))
vi.mock('../../../modules/python/pyodide', () => ({
  initPyodide: vi.fn(() => Promise.resolve()),
  isPyodideReady: () => true,
  provideInput: vi.fn(),
  runPython: (...args) => mocks.runPython(...args),
  stopPython: vi.fn(),
}))

const codeFile = {
  format: 'headstart-launchpad-code',
  version: 1,
  language: 'python',
  tasks: [
    { id: 1, title: 'Print hello', code: 'print("hello")' },
    { id: 2, title: 'Loop challenge', code: 'print("loop")' },
  ],
}

function renderWorkspace() {
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/code', state: { codeFile } }]}>
      <Routes>
        <Route path="/code" element={<CodeFileWorkspace />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('CodeFileWorkspace', () => {
  beforeEach(() => {
    mocks.runPython.mockReset()
    mocks.runPython.mockImplementation(async (_code, { onOutput }) => {
      onOutput('done\n')
      return { status: 'success' }
    })
  })

  it('lets a learner select a task from a multi-task code file and run it', async () => {
    renderWorkspace()

    fireEvent.click(screen.getByRole('tab', { name: 'Loop challenge' }))
    fireEvent.click(screen.getByRole('button', { name: 'Run' }))

    expect(mocks.runPython).toHaveBeenCalledWith('print("loop")', expect.any(Object))
    expect(await screen.findByText(/done/)).toBeInTheDocument()
  })

  it('makes the browser-only backup warning visible', () => {
    renderWorkspace()
    expect(screen.getByText(/saved only on this device/i)).toBeInTheDocument()
  })
})
