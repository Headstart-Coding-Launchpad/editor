import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CheckEditor from '../CheckEditor.jsx'

describe('Turtle CheckEditor', () => {
  it('adds a default segment-count check', () => {
    const onUpdate = vi.fn()
    render(<CheckEditor task={{ check: null }} onUpdate={onUpdate} />)
    fireEvent.click(screen.getByText('+ Add turtle check'))
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        check: [{ type: 'turtle_segment_count', operator: 'greater_than_or_equal', value: '1' }],
      })
    )
  })

  it('switching the check type resets to that type’s fields', () => {
    const onUpdate = vi.fn()
    const task = { check: [{ type: 'turtle_segment_count', operator: 'equals', value: '4' }] }
    render(<CheckEditor task={task} onUpdate={onUpdate} />)
    fireEvent.change(screen.getByDisplayValue('Number of lines drawn'), {
      target: { value: 'turtle_color_used' },
    })
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ check: [{ type: 'turtle_color_used', kind: 'pen', color: 'red' }] })
    )
  })

  it('removes a check', () => {
    const onUpdate = vi.fn()
    const task = { check: [{ type: 'turtle_position', x: '0', y: '0', tolerance: '2' }] }
    render(<CheckEditor task={task} onUpdate={onUpdate} />)
    fireEvent.click(screen.getByTitle('Remove check'))
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ check: null }))
  })

  it('uses the onChange/checks prop pair when embedded in a feedback editor', () => {
    const onChange = vi.fn()
    render(
      <CheckEditor
        task={{}}
        checks={[{ type: 'turtle_command_used', command: 'forward', minCount: '1' }]}
        onChange={onChange}
        feedbackEditor
      />
    )
    fireEvent.click(screen.getByTitle('Remove check'))
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
