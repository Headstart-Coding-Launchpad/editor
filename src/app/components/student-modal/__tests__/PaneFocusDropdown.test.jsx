import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import PaneFocusDropdown, { getPaneOptionsForLessonType } from '../PaneFocusDropdown'

describe('getPaneOptionsForLessonType', () => {
  it('offers only Instructions for lesson types without module-specific wiring (e.g. python, html, filesystem)', () => {
    for (const type of ['python', 'html', 'filesystem', 'arcade', undefined]) {
      expect(getPaneOptionsForLessonType(type)).toEqual([{ id: 'instructions', label: 'Instructions' }])
    }
  })

  it('offers Breadboard/MicroPython in addition to Instructions for electronics', () => {
    expect(getPaneOptionsForLessonType('electronics').map(o => o.id)).toEqual(['instructions', 'breadboard', 'code'])
  })

  it('offers Blocks/Stage in addition to Instructions for scratch', () => {
    expect(getPaneOptionsForLessonType('scratch').map(o => o.id)).toEqual(['instructions', 'blocks', 'stage'])
  })
})

describe('PaneFocusDropdown', () => {
  it('starts with only Instructions checked, and disables both actions once nothing is checked', async () => {
    const user = userEvent.setup()
    const onHighlight = vi.fn()
    const onForce = vi.fn()
    render(<PaneFocusDropdown lessonType="electronics" onHighlight={onHighlight} onForce={onForce} />)

    await user.click(screen.getByRole('button', { name: /Focus/ }))
    expect(screen.getByRole('checkbox', { name: 'Instructions' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Breadboard' })).not.toBeChecked()

    await user.click(screen.getByRole('checkbox', { name: 'Instructions' }))
    expect(screen.getByRole('button', { name: /Highlight/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Switch to this/ })).toBeDisabled()
  })

  it('calls onHighlight with exactly the checked panes and closes the dropdown', async () => {
    const user = userEvent.setup()
    const onHighlight = vi.fn()
    render(<PaneFocusDropdown lessonType="electronics" onHighlight={onHighlight} onForce={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: /Focus/ }))
    await user.click(screen.getByRole('checkbox', { name: 'Breadboard' }))
    await user.click(screen.getByRole('button', { name: /Highlight/ }))

    expect(onHighlight).toHaveBeenCalledWith(expect.arrayContaining(['instructions', 'breadboard']))
    expect(onHighlight.mock.calls[0][0]).toHaveLength(2)
    expect(screen.queryByRole('checkbox', { name: 'Breadboard' })).not.toBeInTheDocument()
  })

  it('uses a custom label when provided (e.g. the whole-class "Focus Class" control)', () => {
    render(<PaneFocusDropdown lessonType="python" label="Focus Class" onHighlight={vi.fn()} onForce={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Focus Class/ })).toBeInTheDocument()
  })
})
