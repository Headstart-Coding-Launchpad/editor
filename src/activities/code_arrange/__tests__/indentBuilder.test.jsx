import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CodeArrangeEditor from '../CodeArrangeBuilderEditor.jsx'
import {
  INDENT_CODE_ARRANGE_TASK as INDENT_TASK,
  PYTHON_CODE_ARRANGE_TASK,
} from '../../../test/fixtures/legacyActivityTasks.js'

// The Builder's Arrange composer in indent mode: one row per line (code, depth, start, lock).
describe('CodeArrangeEditor indent mode', () => {
  it('switches a tile task to indent mode', () => {
    const onUpdate = vi.fn()
    render(<CodeArrangeEditor task={PYTHON_CODE_ARRANGE_TASK} onUpdate={onUpdate} />)
    fireEvent.click(screen.getByRole('radio', { name: /indent/i }))
    expect(onUpdate.mock.lastCall[0]).toMatchObject({ arrangeMode: 'indent', moduleType: 'python' })
    expect(onUpdate.mock.lastCall[0].lines.every((line) => 'code' in line && 'depth' in line)).toBe(
      true
    )
  })

  it('edits a line depth, start and lock, and hides the tile-only fields', () => {
    const onUpdate = vi.fn()
    render(<CodeArrangeEditor task={INDENT_TASK} onUpdate={onUpdate} />)
    expect(screen.queryByText('Distractor tiles')).not.toBeInTheDocument()
    expect(screen.queryByRole('radio', { name: 'HTML' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Line 6 code')).toHaveValue('print("Heating up!")')

    fireEvent.change(screen.getByLabelText('Line 4 depth'), { target: { value: '2' } })
    expect(onUpdate.mock.lastCall[0].lines[3]).toMatchObject({ id: 'L4', depth: 2 })

    fireEvent.change(screen.getByLabelText('Line 4 starts at'), { target: { value: '3' } })
    expect(onUpdate.mock.lastCall[0].lines[3]).toMatchObject({ start: 3 })

    fireEvent.click(screen.getByLabelText('Lock line 4'))
    expect(onUpdate.mock.lastCall[0].lines[3]).toMatchObject({ locked: true })

    fireEvent.click(screen.getByRole('checkbox', { name: /coloured brackets/i }))
    expect(onUpdate.mock.lastCall[0].showBlocks).toBe(false)
  })
})
