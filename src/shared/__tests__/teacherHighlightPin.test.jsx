// Fun moment (sketch OK'd 26 Nov 2026, "Tutor highlights + a new Pin"): the tutor's words
// appear right where the child needs to type, stay while they type there, and go only when the
// child presses "Got it ✓".
import { describe, expect, it, vi } from 'vitest'
import { EditorView } from '@codemirror/view'
import { CodeEditor } from '../CodeEditor'
import { mapThroughText, noteMarginLeft } from '../teacherHighlightsEditor'

const code = 'def cheer(player):\n    print("Well done " + player + "!")\n\n    return 10\n'
const pinAt = code.indexOf('\n\n') + 1 // the blank line 3

async function renderEditor(props) {
  const { render } = await import('@testing-library/react')
  const utils = render(<CodeEditor value={code} {...props} />)
  const view = EditorView.findFromDOM(utils.container.querySelector('.cm-editor'))
  return { ...utils, view }
}

const noteRows = (container) => [...container.querySelectorAll('.cm-teacherNote')]

describe('Fun moment: the tutor pins words right where the child types', () => {
  it('shows the pin note under its line, keeps it while the child types there, and Got it dismisses it', async () => {
    const onHighlightDismiss = vi.fn()
    const pin = {
      id: 'p1',
      kind: 'pin',
      from: pinAt,
      to: pinAt,
      emoji: '📌',
      note: 'Write this here',
    }
    const { container, view } = await renderEditor({ teacherHighlights: [pin], onHighlightDismiss })

    // The words are on screen (not a hover tooltip), in their own row after the pinned line.
    const [row] = noteRows(container)
    expect(row).toBeTruthy()
    expect(row.textContent).toContain('Write this here')
    expect(row.closest('.cm-line')).toBeNull()
    expect(container.querySelector('.cm-teacherPin')).toBeTruthy()

    // The child types at the pin: the pin stays, after what they typed, and nothing is dismissed.
    view.dispatch({
      changes: { from: pinAt, insert: '    print("Hooray")' },
      selection: { anchor: pinAt + 19 },
      userEvent: 'input.type',
    })
    expect(onHighlightDismiss).not.toHaveBeenCalled()
    expect(noteRows(container)[0].textContent).toContain('Write this here')
    const pinPos = view.posAtDOM(container.querySelector('.cm-teacherPin'))
    expect(pinPos).toBe(pinAt + 19)

    // Clicking the words does nothing; "Got it ✓" dismisses it.
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.mouseDown(noteRows(container)[0].querySelector('.cm-teacherNoteText'))
    expect(onHighlightDismiss).not.toHaveBeenCalled()
    const gotIt = noteRows(container)[0].querySelector('button')
    expect(gotIt.textContent).toBe('Got it ✓')
    fireEvent.mouseDown(gotIt)
    expect(onHighlightDismiss).toHaveBeenCalledWith('p1')
  })

  it('gives every highlight, even one with no note, the same Got it button and no ✕', async () => {
    const at = code.indexOf('player +')
    const { container } = await renderEditor({
      teacherHighlights: [
        { id: 'h1', from: at, to: at + 6, emoji: '❓', note: 'Check this name' },
        { id: 'h2', from: 0, to: 3, emoji: '⭐', note: null },
      ],
    })
    const rows = noteRows(container)
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.querySelector('button').textContent)).toEqual(['Got it ✓', 'Got it ✓'])
    expect(container.textContent).toContain('Check this name')
    expect(container.textContent).not.toContain('✕')
  })

  it('shows the tutor the same pin and words live in their read-only mirror, with Remove', async () => {
    const onHighlightDismiss = vi.fn()
    const pin = { id: 'p1', kind: 'pin', from: pinAt, to: pinAt, note: 'Write this here' }
    const { container } = await renderEditor({
      readOnly: true,
      teacherHighlights: [pin],
      onHighlightDismiss,
    })
    const [row] = noteRows(container)
    expect(row.textContent).toContain('Write this here')
    expect(container.querySelector('.cm-teacherPin')).toBeTruthy()
    const { fireEvent } = await import('@testing-library/react')
    fireEvent.mouseDown(row.querySelector('button'))
    expect(row.querySelector('button').textContent).toBe('Remove')
    expect(onHighlightDismiss).toHaveBeenCalledWith('p1')
  })

  it('dismisses once from the keyboard and once from a mouse click (mousedown then click)', async () => {
    const { fireEvent } = await import('@testing-library/react')
    const onHighlightDismiss = vi.fn()
    const pin = { id: 'p1', kind: 'pin', from: pinAt, to: pinAt, note: 'Write this here' }
    const { container } = await renderEditor({ teacherHighlights: [pin], onHighlightDismiss })
    const button = noteRows(container)[0].querySelector('button')
    // Enter or Space on a focused button fires a click with detail 0 and no mousedown.
    expect(fireEvent.keyDown(button, { key: 'Enter' })).toBe(true)
    fireEvent.click(button, { detail: 0 })
    expect(onHighlightDismiss).toHaveBeenCalledTimes(1)
    fireEvent.mouseDown(button)
    fireEvent.click(button, { detail: 1 })
    expect(onHighlightDismiss).toHaveBeenCalledTimes(2)
  })

  it('keeps the editor focused and typing working after a press on the words, the row or Got it', async () => {
    const { fireEvent } = await import('@testing-library/react')
    const pin = { id: 'p1', kind: 'pin', from: pinAt, to: pinAt, note: 'Write this here' }
    const { container, view } = await renderEditor({ teacherHighlights: [pin] })
    const row = noteRows(container)[0]
    for (const target of [row.querySelector('.cm-teacherNoteText'), row]) {
      view.contentDOM.blur()
      // A press there must not take focus or the caret away from the code.
      expect(fireEvent.mouseDown(target)).toBe(false)
      expect(view.hasFocus).toBe(true)
    }
    view.contentDOM.blur()
    fireEvent.mouseDown(row.querySelector('button'))
    expect(view.hasFocus).toBe(true)
    // From the keyboard: focus is on the button, and goes back to the code.
    row.querySelector('button').focus()
    fireEvent.click(row.querySelector('button'), { detail: 0 })
    expect(view.hasFocus).toBe(true)
  })
})

describe("the tutor's pin spot before Drop pin", () => {
  it('shows a pending pin as a marker only: no note row, no button', async () => {
    const pending = { id: 'pending-pin', kind: 'pin', pending: true, from: pinAt, to: pinAt }
    const { container } = await renderEditor({ readOnly: true, teacherHighlights: [pending] })
    expect(container.querySelector('.cm-teacherPin.cm-teacherPinPending')).toBeTruthy()
    expect(noteRows(container)).toHaveLength(0)
  })
})

describe('noteMarginLeft (the note stays inside the visible editor)', () => {
  it('puts the pill under the arrow, but never past the left edge or the visible right edge', () => {
    expect(noteMarginLeft(100, 120, 600)).toBe(76)
    expect(noteMarginLeft(10, 120, 600)).toBe(0)
    expect(noteMarginLeft(560, 120, 600)).toBe(472)
    expect(noteMarginLeft(300, 700, 600)).toBe(0)
  })
})

describe('mapThroughText (a pending spot or range follows the mirrored code)', () => {
  it('moves like the editor: text typed at a pin goes before it; a deleted range is gone', () => {
    const pin = { kind: 'pin', from: 3, to: 3 }
    expect(mapThroughText(pin, 'abcdef', 'XXabcdef')).toEqual({ ...pin, from: 5, to: 5 })
    expect(mapThroughText(pin, 'abcdef', 'abcZdef')).toEqual({ ...pin, from: 4, to: 4 })
    expect(mapThroughText(pin, 'abcdef', 'abcdefZ')).toEqual(pin)
    const range = { from: 1, to: 4 }
    expect(mapThroughText(range, 'abcdef', '#abcdef')).toEqual({ from: 2, to: 5 })
    expect(mapThroughText(range, 'abcdef', 'af')).toBeNull()
  })
})
