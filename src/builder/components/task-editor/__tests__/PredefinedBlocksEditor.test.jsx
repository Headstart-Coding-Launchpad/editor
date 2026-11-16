import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PrebuiltStacksEditor } from '../../../../modules/scratch/scratchEditors'

describe('PrebuiltStacksEditor', () => {
  it('adds a stack immediately when a block type is selected from the picker', () => {
    const onChange = vi.fn()
    render(<PrebuiltStacksEditor prebuiltStacks={[]} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /\+ add stack/i }))
    fireEvent.click(screen.getByRole('option', { name: 'say' }))

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        label: '💬 say',
        stack: expect.objectContaining({ type: 'looks_say' }),
      }),
    ])
  })

  it('offers a block type that is not present in the task toolbox', () => {
    const onChange = vi.fn()
    render(<PrebuiltStacksEditor prebuiltStacks={[]} onChange={onChange} />)

    fireEvent.click(screen.getByRole('button', { name: /\+ add stack/i }))
    fireEvent.click(screen.getByRole('option', { name: /repeat until/i }))

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({
        stack: expect.objectContaining({ type: 'control_repeat_until' }),
      }),
    ])
  })
})
