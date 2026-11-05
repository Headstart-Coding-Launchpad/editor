import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PythonEditor from '../PythonEditor'
import { PYTHON_KEY_SYMBOLS } from '../keyRow.js'
import pythonDefinition from '../definition.js'

// CodeMirror's EditorView is not unit-tested (see docs/TESTING.md "What NOT
// to Test") — mocked here as a forwardRef stub exposing the same
// insertAtCursor imperative API the real CodeEditor provides, so PythonEditor's
// symbol-bar wiring can be exercised without mounting a real editor.
const insertAtCursor = vi.fn()
const indentAtCursor = vi.fn()
vi.mock('../../../shared/CodeEditor', () => ({
  CodeEditor: React.forwardRef(function MockCodeEditor(props, ref) {
    React.useImperativeHandle(ref, () => ({ insertAtCursor, indentAtCursor }))
    return (
      <div
        data-testid="code-editor"
        data-block-guides={String(props.blockGuides)}
        data-line-wrapping={String(!!props.lineWrapping)}
      />
    )
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

  it('shows every Python symbol on a touch device with no Keys tap', () => {
    touchDevice = true
    render(<PythonEditor code="" onChange={vi.fn()} />)
    for (const sym of [...'()[]{}"\',:=#+-*/<>!._']) {
      expect(screen.getByRole('button', { name: sym })).toBeInTheDocument()
    }
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

describe('PythonEditor — Tab / indent key (request #125)', () => {
  beforeEach(() => {
    indentAtCursor.mockClear()
    insertAtCursor.mockClear()
  })

  it('shows an "Indent (Tab)" key right after the colon on touch, 44px', () => {
    touchDevice = true
    render(<PythonEditor code="" onChange={vi.fn()} />)
    const tab = screen.getByRole('button', { name: 'Indent (Tab)' })
    expect(tab).toHaveTextContent('⇥')
    expect(tab.style.height).toBe('44px')
    expect(tab.previousSibling).toHaveTextContent(':')
  })

  it('indents with the editor, not by inserting text', async () => {
    touchDevice = true
    const user = userEvent.setup()
    render(<PythonEditor code="" onChange={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Indent (Tab)' }))
    expect(indentAtCursor).toHaveBeenCalledTimes(1)
    expect(insertAtCursor).not.toHaveBeenCalled()
  })

  it('is not shown without a touch screen', () => {
    touchDevice = false
    render(<PythonEditor code="" onChange={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Indent (Tab)' })).not.toBeInTheDocument()
  })
})

describe('PythonEditor — tutor key highlight targets (request #126)', () => {
  it('marks each touch key so a key:<symbol> highlight can find it', () => {
    touchDevice = true
    const { container } = render(<PythonEditor code="" onChange={vi.fn()} />)
    const keyFamily = pythonDefinition.capabilities.highlightTargets.find((t) => t.id === 'key')
    // One list: the highlight targets are exactly the keys the row draws, in its order.
    expect(keyFamily.options).toEqual(PYTHON_KEY_SYMBOLS)
    const drawn = [...container.querySelectorAll('[data-highlight-target^="key:"]')].map((el) =>
      el.getAttribute('data-highlight-target').slice(4)
    )
    expect(drawn).toEqual(PYTHON_KEY_SYMBOLS)
    for (const key of PYTHON_KEY_SYMBOLS) {
      const button = [...container.querySelectorAll('[data-highlight-target]')].find(
        (el) => el.getAttribute('data-highlight-target') === `key:${key}`
      )
      expect(button?.textContent).toBe(key === 'Tab' ? '⇥' : key)
    }
  })
})

describe('PythonEditor — long lines', () => {
  it('wraps long lines on a touch device (no visible sideways scroll on a tablet)', () => {
    touchDevice = true
    render(<PythonEditor code="" onChange={vi.fn()} />)
    expect(screen.getByTestId('code-editor')).toHaveAttribute('data-line-wrapping', 'true')
  })

  it('keeps long lines unwrapped with a mouse and keyboard', () => {
    touchDevice = false
    render(<PythonEditor code="" onChange={vi.fn()} />)
    expect(screen.getByTestId('code-editor')).toHaveAttribute('data-line-wrapping', 'false')
  })
})

describe('PythonEditor — emoji button', () => {
  beforeEach(() => {
    touchDevice = false
    insertAtCursor.mockClear()
  })

  it('on touch the emoji key sits in the always-visible row and there is no Keys toggle', () => {
    touchDevice = true
    render(<PythonEditor code="" onChange={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Keys' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: ':' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'emoji-picker' })).toBeInTheDocument()
  })

  it('puts the colon first and makes touch keys 44px', () => {
    touchDevice = true
    render(<PythonEditor code="" onChange={vi.fn()} />)
    const toolbar = screen.getByRole('toolbar', { name: /python editor tools/i })
    expect(toolbar.firstChild).toHaveTextContent(':')
    expect(screen.getByRole('button', { name: ':' }).style.height).toBe('44px')
    expect(screen.getByRole('button', { name: ':' }).style.minWidth).toBe('44px')
  })

  it('shows the emoji button on a non-touch device while interactive', async () => {
    const user = userEvent.setup()
    render(<PythonEditor code="" onChange={vi.fn()} />)
    await user.click(screen.getByRole('button', { name: 'Keys' }))
    expect(screen.getByRole('button', { name: 'emoji-picker' })).toBeInTheDocument()
  })

  it('hides the emoji button when read-only', () => {
    render(<PythonEditor code="" onChange={vi.fn()} readOnly />)
    expect(screen.queryByRole('button', { name: 'emoji-picker' })).not.toBeInTheDocument()
  })

  it('inserts the picked emoji at the cursor via the editor ref', async () => {
    const user = userEvent.setup()
    render(<PythonEditor code="" onChange={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Keys' }))
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

describe('PythonEditor — run counts read aloud (P6-26)', () => {
  const mark = (line, extra) => ({ key: `L${line}`, line, value: '', editable: false, ...extra })

  it('says each count after a Run in a polite live region', () => {
    render(
      <PythonEditor
        code=""
        onChange={vi.fn()}
        runCounts={{
          mode: 'predict',
          readOnly: false,
          marks: [
            mark(2, { value: '3', count: 3, correct: true }),
            mark(3, { value: '3', count: 1, correct: false }),
          ],
        }}
      />
    )
    const region = screen.getByTestId('run-count-announcement')
    expect(region).toHaveAttribute('aria-live', 'polite')
    expect(region.textContent).toBe(
      'Line 2 ran 3 times. You predicted 3: right. Line 3 ran 1 time. You predicted 3: not quite.'
    )
  })

  it('is empty before a Run, and absent on a task without run counts', () => {
    const { rerender } = render(
      <PythonEditor
        code=""
        onChange={vi.fn()}
        runCounts={{ mode: 'predict', marks: [mark(2, { count: null, editable: true })] }}
      />
    )
    expect(screen.getByTestId('run-count-announcement').textContent).toBe('')
    rerender(<PythonEditor code="" onChange={vi.fn()} />)
    expect(screen.queryByTestId('run-count-announcement')).not.toBeInTheDocument()
  })
})
