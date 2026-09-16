import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import HtmlEditor from '../HtmlEditor'

const insertAtCursor = vi.fn()
vi.mock('../../../shared/CodeEditor', () => ({
  CodeEditor: React.forwardRef(function MockCodeEditor(props, ref) {
    React.useImperativeHandle(ref, () => ({ insertAtCursor }))
    return <div data-testid="code-editor" />
  }),
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

const files = [{ name: 'index.html', content: '<p>hi</p>', type: 'html' }]

describe('HtmlEditor — emoji button', () => {
  beforeEach(() => {
    insertAtCursor.mockClear()
  })

  it('shows the emoji button while interactive', () => {
    render(<HtmlEditor files={files} activeFile="index.html" />)
    expect(screen.getByRole('button', { name: 'emoji-picker' })).toBeInTheDocument()
  })

  it('hides the emoji button when read-only', () => {
    render(<HtmlEditor files={files} activeFile="index.html" readOnly />)
    expect(screen.queryByRole('button', { name: 'emoji-picker' })).not.toBeInTheDocument()
  })

  it('inserts the picked emoji at the cursor via the editor ref', async () => {
    const user = userEvent.setup()
    render(<HtmlEditor files={files} activeFile="index.html" />)

    await user.click(screen.getByRole('button', { name: 'emoji-picker' }))

    expect(insertAtCursor).toHaveBeenCalledWith('🎉')
  })
})
