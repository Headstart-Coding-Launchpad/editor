import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PythonEditor from '../PythonEditor'

// CodeMirror's EditorView is not unit-tested (see docs/TESTING.md "What NOT
// to Test") — mocked here as a forwardRef stub exposing the same
// insertAtCursor imperative API the real CodeEditor provides, so PythonEditor's
// symbol-bar wiring can be exercised without mounting a real editor.
const insertAtCursor = vi.fn()
vi.mock('../../../shared/CodeEditor', () => ({
  CodeEditor: React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => ({ insertAtCursor }))
    return <div data-testid="code-editor" />
  }),
}))

let touchDevice = false
vi.mock('../../../shared/useIsTouchDevice', () => ({
  useIsTouchDevice: () => touchDevice,
}))

describe('PythonEditor — touch symbol bar', () => {
  beforeEach(() => {
    touchDevice = false
    insertAtCursor.mockClear()
  })

  it('does not show the symbol bar on a non-touch device', () => {
    touchDevice = false
    render(<PythonEditor code="" onChange={vi.fn()} />)
    expect(screen.queryByRole('toolbar', { name: /insert python symbol/i })).not.toBeInTheDocument()
  })

  it('shows the symbol bar on a touch device while interactive', () => {
    touchDevice = true
    render(<PythonEditor code="" onChange={vi.fn()} />)
    expect(screen.getByRole('toolbar', { name: /insert python symbol/i })).toBeInTheDocument()
  })

  it('hides the symbol bar on a touch device when read-only', () => {
    touchDevice = true
    render(<PythonEditor code="" onChange={vi.fn()} readOnly />)
    expect(screen.queryByRole('toolbar', { name: /insert python symbol/i })).not.toBeInTheDocument()
  })

  it('inserts the tapped symbol at the cursor via the editor ref', async () => {
    touchDevice = true
    const user = userEvent.setup()
    render(<PythonEditor code="" onChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: ':' }))

    expect(insertAtCursor).toHaveBeenCalledWith(':')
  })
})
