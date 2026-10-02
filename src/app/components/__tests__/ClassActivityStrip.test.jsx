import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import ClassActivityStrip from '../ClassActivityStrip'

const entries = [
  { group: 'looking', icon: '👀', text: '2 looking at Sam’s work', studentIds: ['a', 'b'] },
]

describe('ClassActivityStrip', () => {
  it('shows nothing when nobody is doing anything', () => {
    const { container } = render(
      <ClassActivityStrip entries={[]} names={{}} onHighlight={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('names the students on hover and toggles the highlight on click', () => {
    const onHighlight = vi.fn()
    const { rerender } = render(
      <ClassActivityStrip
        entries={entries}
        names={{ a: 'Ali', b: 'Bea' }}
        onHighlight={onHighlight}
      />
    )
    const item = screen.getByRole('button', { name: '👀 2 looking at Sam’s work' })
    expect(item).toHaveAttribute('title', 'Ali, Bea')
    fireEvent.click(item)
    expect(onHighlight).toHaveBeenCalledWith('looking')
    rerender(
      <ClassActivityStrip
        entries={entries}
        names={{ a: 'Ali', b: 'Bea' }}
        highlighted="looking"
        onHighlight={onHighlight}
      />
    )
    fireEvent.click(screen.getByRole('button', { pressed: true }))
    expect(onHighlight).toHaveBeenLastCalledWith(null)
  })
})
