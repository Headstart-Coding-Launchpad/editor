import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PredefinedBlocksEditor, buildScratchToolboxXml } from '../ScratchEditors'

describe('PredefinedBlocksEditor', () => {
  it('clears an in-progress block when the toolbox changes', async () => {
    const onChange = vi.fn()
    const motionToolbox = buildScratchToolboxXml(['motion_movesteps'])
    const looksToolbox = buildScratchToolboxXml(['looks_say'])
    const { rerender } = render(
      <PredefinedBlocksEditor
        predefinedBlocks={[]}
        toolbox={motionToolbox}
        onChange={onChange}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /\+ add predefined block/i }))
    expect(screen.getByRole('combobox')).toHaveValue('motion_movesteps')

    rerender(
      <PredefinedBlocksEditor
        predefinedBlocks={[]}
        toolbox={looksToolbox}
        onChange={onChange}
      />
    )

    await waitFor(() => {
      expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: /\+ add predefined block/i }))
    expect(screen.getByRole('combobox')).toHaveValue('looks_say')
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ type: 'looks_say' }),
    ])
  })
})
