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
  CodeEditor: React.forwardRef(function MockCodeEditor(props, ref) {
    React.useImperativeHandle(ref, () => ({ insertAtCursor }))
    return <div data-testid="code-editor" data-block-guides={String(props.blockGuides)} />
  }),
}))

let touchDevice = false
vi.mock('../../../shared/useIsTouchDevice', () => ({
  useIsTouchDevice: () => touchDevice,
}))

vi.mock('../../../shared/EmojiPickerButton', () => ({
  default: function MockEmojiPickerButton({ onInsert }) {
    return (
      <button type="button" onClick={() => onInsert('🎉')}>
        emoji-picker
      </button>
    )
  },
}))

describe('PythonEditor — touch symbol bar', () => {
  beforeEach(() => {
    touchDevice = false
    insertAtCursor.mockClear()
  })

  it('does not show the punctuation symbol buttons on a non-touch device', () => {
    touchDevice = false
    render(<PythonEditor code="" onChange={vi.fn()} />)
    expect(screen.queryByRole('button', { name: ':' })).not.toBeInTheDocument()
  })

  it('shows the symbol bar on a touch device while interactive', () => {
    touchDevice = true
    render(<PythonEditor code="" onChange={vi.fn()} />)
    expect(screen.getByRole('toolbar', { name: /python editor tools/i })).toBeInTheDocument()
  })

  it('hides the symbol buttons on a touch device when read-only', () => {
    touchDevice = true
    render(<PythonEditor code="" onChange={vi.fn()} readOnly />)
    expect(screen.queryByRole('button', { name: ':' })).not.toBeInTheDocument()
  })

  it('inserts the tapped symbol at the cursor via the editor ref', async () => {
    touchDevice = true
    const user = userEvent.setup()
    render(<PythonEditor code="" onChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: ':' }))

    expect(insertAtCursor).toHaveBeenCalledWith(':')
  })
})

describe('PythonEditor — emoji button', () => {
  beforeEach(() => {
    touchDevice = false
    insertAtCursor.mockClear()
  })

  it('shows the emoji button on a non-touch device while interactive', () => {
    render(<PythonEditor code="" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'emoji-picker' })).toBeInTheDocument()
  })

  it('hides the emoji button when read-only', () => {
    render(<PythonEditor code="" onChange={vi.fn()} readOnly />)
    expect(screen.queryByRole('button', { name: 'emoji-picker' })).not.toBeInTheDocument()
  })

  it('inserts the picked emoji at the cursor via the editor ref', async () => {
    const user = userEvent.setup()
    render(<PythonEditor code="" onChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'emoji-picker' }))

    expect(insertAtCursor).toHaveBeenCalledWith('🎉')
  })
})

describe('PythonEditor — Blocks button', () => {
  beforeEach(() => {
    touchDevice = false
    window.localStorage.clear()
  })

  it('shows block brackets by default, with the Blocks button pressed', () => {
    render(<PythonEditor code="" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: /blocks/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('code-editor')).toHaveAttribute('data-block-guides', 'true')
  })

  it('turns the brackets off and remembers it on this device', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<PythonEditor code="" onChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /blocks/i }))

    expect(screen.getByRole('button', { name: /blocks/i })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByTestId('code-editor')).toHaveAttribute('data-block-guides', 'false')
    expect(window.localStorage.getItem('headstart_block_guides_off')).toBe('1')

    unmount()
    render(<PythonEditor code="" onChange={vi.fn()} />)
    expect(screen.getByTestId('code-editor')).toHaveAttribute('data-block-guides', 'false')
  })

  it('keeps the Blocks button for read-only viewers', () => {
    render(<PythonEditor code="" readOnly />)
    expect(screen.getByRole('button', { name: /blocks/i })).toBeInTheDocument()
  })

  it('hides the brackets and the button when the task turns them off', () => {
    render(<PythonEditor code="" onChange={vi.fn()} showBlocks={false} />)
    expect(screen.queryByRole('button', { name: /blocks/i })).not.toBeInTheDocument()
    expect(screen.getByTestId('code-editor')).toHaveAttribute('data-block-guides', 'false')
  })
})
