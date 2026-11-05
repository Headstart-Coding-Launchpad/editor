import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CopyCodeEditDialog from '../CopyCodeEditDialog'

vi.mock('../../../shared/CodeEditor', () => ({
  CodeEditor: ({ value, onChange, language }) => (
    <textarea
      data-testid="code-editor"
      data-language={language}
      value={value ?? ''}
      onChange={(event) => onChange?.(event.target.value)}
    />
  ),
}))

describe('CopyCodeEditDialog', () => {
  it('edits the Type this out text in the shared code editor, so indents work', () => {
    const onSave = vi.fn()
    render(
      <CopyCodeEditDialog
        studentName="Jamie"
        taskTitle="Loops"
        initialText="for i in range(3):"
        language="python"
        hasOwnOverride={false}
        onSave={onSave}
        onClearStudent={() => {}}
        onClose={() => {}}
      />
    )
    const editor = screen.getByTestId('code-editor')
    expect(editor).toHaveAttribute('data-language', 'python')
    expect(editor).toHaveValue('for i in range(3):')
    fireEvent.change(editor, { target: { value: 'for i in range(3):\n    print(i)' } })
    fireEvent.click(screen.getByTestId('copy-code-save-class'))
    expect(onSave).toHaveBeenCalledWith('class', 'for i in range(3):\n    print(i)')
  })

  it('closes on Escape, but not when the editor already used it (autocomplete popup)', () => {
    const onClose = vi.fn()
    render(
      <CopyCodeEditDialog
        studentName="Jamie"
        taskTitle="Loops"
        initialText=""
        hasOwnOverride={false}
        onSave={() => {}}
        onClearStudent={() => {}}
        onClose={onClose}
      />
    )
    const editor = screen.getByTestId('code-editor')
    editor.addEventListener('keydown', (e) => e.preventDefault())
    fireEvent.keyDown(editor, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
