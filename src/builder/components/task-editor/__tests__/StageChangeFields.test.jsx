import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StageMetadataEditor } from '../TaskEditorFields'
import { normalizeTasksForExport } from '../../../lessonUtils'

// Platform request 134: the Builder fields for a Complete stage's change view and the Copy code
// panel's place line (copyAfter / copyBefore).
describe('StageMetadataEditor change view option', () => {
  // A Complete stage shows the change view by default: off stores show: full, on removes it.
  it('is on for a Complete stage with no show field; turning it off stores show: full', () => {
    const onChange = vi.fn()
    render(
      <StageMetadataEditor
        stage={{ label: 'Complete', role: 'complete', code: 'x' }}
        onChange={onChange}
        showChangeOption
      />
    )
    expect(screen.getByLabelText('Show only the changes')).toBeChecked()
    fireEvent.click(screen.getByLabelText('Show only the changes'))
    expect(onChange).toHaveBeenCalledWith({
      label: 'Complete',
      role: 'complete',
      code: 'x',
      show: 'full',
    })
  })

  it('turning it back on removes the field', () => {
    const onChange = vi.fn()
    render(
      <StageMetadataEditor
        stage={{ label: 'Complete', role: 'complete', code: 'x', show: 'full' }}
        onChange={onChange}
        showChangeOption
      />
    )
    fireEvent.click(screen.getByLabelText('Show only the changes'))
    expect(onChange).toHaveBeenCalledWith({ label: 'Complete', role: 'complete', code: 'x' })
  })

  it('edits the change note above the change view, and an empty note removes the field', () => {
    const onChange = vi.fn()
    render(
      <StageMetadataEditor
        stage={{ label: 'Complete', role: 'complete', code: 'x', changeNote: 'Add' }}
        onChange={onChange}
        showChangeOption
      />
    )
    const note = screen.getByLabelText('Change note')
    expect(note).toHaveAttribute('maxLength', '120')
    fireEvent.change(note, { target: { value: 'Add a line that prints x.' } })
    expect(onChange).toHaveBeenLastCalledWith({
      label: 'Complete',
      role: 'complete',
      code: 'x',
      changeNote: 'Add a line that prints x.',
    })
    fireEvent.change(note, { target: { value: '' } })
    expect(onChange).toHaveBeenLastCalledWith({ label: 'Complete', role: 'complete', code: 'x' })
  })

  it('offers it on a Support stage too', () => {
    const onChange = vi.fn()
    render(
      <StageMetadataEditor
        stage={{ label: 'Hint', role: 'support', code: 'x' }}
        onChange={onChange}
        showChangeOption
      />
    )
    fireEvent.click(screen.getByLabelText('Show only the changes'))
    expect(onChange).toHaveBeenCalledWith({
      label: 'Hint',
      role: 'support',
      code: 'x',
      show: 'change',
    })
  })

  it('is not offered on a Starter stage or in other modules', () => {
    const { rerender } = render(
      <StageMetadataEditor
        stage={{ label: 'Starter', role: 'starter', code: 'x' }}
        onChange={() => {}}
        showChangeOption
      />
    )
    expect(screen.queryByLabelText('Show only the changes')).not.toBeInTheDocument()
    rerender(
      <StageMetadataEditor
        stage={{ label: 'Complete', role: 'complete', code: 'x' }}
        onChange={() => {}}
      />
    )
    expect(screen.queryByLabelText('Show only the changes')).not.toBeInTheDocument()
  })
})

describe('export of the Copy code place line', () => {
  it('keeps copyAfter with copyCode and drops it without', () => {
    const [kept, dropped, blank] = normalizeTasksForExport([
      { id: 'a', title: 'A', copyCode: 'turn += 10', copyAfter: 'size -= step' },
      { id: 'b', title: 'B', copyCode: '  ', copyBefore: 'speed(0)' },
      { id: 'c', title: 'C', copyCode: 'x', copyAfter: '   ' },
    ])
    expect(kept.copyAfter).toBe('size -= step')
    expect(dropped).not.toHaveProperty('copyBefore')
    expect(blank).not.toHaveProperty('copyAfter')
  })
})
