import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StageMetadataEditor } from '../TaskEditorFields'
import { normalizeTasksForExport } from '../../../lessonUtils'

// Platform request 134: the Builder fields for a Complete stage's change view and the Copy code
// panel's place line (copyAfter / copyBefore).
describe('StageMetadataEditor change view option', () => {
  it('offers "Show only the changes" on a Complete stage and stores show: change', () => {
    const onChange = vi.fn()
    render(
      <StageMetadataEditor
        stage={{ label: 'Complete', role: 'complete', code: 'x' }}
        onChange={onChange}
        showChangeOption
      />
    )
    fireEvent.click(screen.getByLabelText('Show only the changes'))
    expect(onChange).toHaveBeenCalledWith({
      label: 'Complete',
      role: 'complete',
      code: 'x',
      show: 'change',
    })
  })

  it('turning it off removes the field', () => {
    const onChange = vi.fn()
    render(
      <StageMetadataEditor
        stage={{ label: 'Complete', role: 'complete', code: 'x', show: 'change' }}
        onChange={onChange}
        showChangeOption
      />
    )
    fireEvent.click(screen.getByLabelText('Show only the changes'))
    expect(onChange).toHaveBeenCalledWith({ label: 'Complete', role: 'complete', code: 'x' })
  })

  it('is not offered on other roles or modules', () => {
    const { rerender } = render(
      <StageMetadataEditor
        stage={{ label: 'Hint', role: 'support', code: 'x' }}
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
