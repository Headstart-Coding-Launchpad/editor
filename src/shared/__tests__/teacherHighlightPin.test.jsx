// Fun moment (sketch OK'd 26 Nov 2026, "Tutor highlights + a new Pin"): the tutor's words
// appear right where the child needs to type, stay while they type there, and go only when the
// child presses "Got it ✓".
import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { EditorView } from '@codemirror/view'
import { CodeEditor } from '../CodeEditor'

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
})
