import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ConfidenceSpreadStrip from '../ConfidenceSpreadStrip'
import {
  confidenceGroup,
  confidenceSpreadEntries,
  tallyConfidenceSpread,
} from '../../../shared/confidenceScale'

const STUDENTS = [
  { anonymousId: 'a', currentAnswer: '8' },
  { anonymousId: 'b', currentAnswer: '8' },
  { anonymousId: 'c', currentAnswer: '3' },
  { anonymousId: 'd', currentAnswer: null },
]
const NAMES = { a: 'Ada', b: 'Ben', c: 'Cat', d: 'Dev' }

describe('ConfidenceSpreadStrip', () => {
  it('renders nothing without a spread', () => {
    const { container } = render(
      <ConfidenceSpreadStrip spread={null} names={{}} highlighted={null} onHighlight={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('shows how many chose each level and how many answered', () => {
    render(
      <ConfidenceSpreadStrip
        spread={tallyConfidenceSpread(STUDENTS)}
        names={NAMES}
        highlighted={null}
        onHighlight={vi.fn()}
      />
    )
    expect(screen.getByText(/Class confidence · 3 of 4 answered/)).toBeInTheDocument()
    expect(screen.getByLabelText('2 chose 8')).toHaveAttribute('title', 'Ada, Ben')
    expect(screen.getByLabelText('1 chose 3')).toBeEnabled()
    expect(screen.getByLabelText('0 chose 10')).toBeDisabled()
  })

  it('highlights the students at a level, and clears it on a second click', () => {
    const onHighlight = vi.fn()
    const spread = tallyConfidenceSpread(STUDENTS)
    const { rerender } = render(
      <ConfidenceSpreadStrip
        spread={spread}
        names={NAMES}
        highlighted={null}
        onHighlight={onHighlight}
      />
    )
    fireEvent.click(screen.getByLabelText('2 chose 8'))
    expect(onHighlight).toHaveBeenLastCalledWith(confidenceGroup(8))
    rerender(
      <ConfidenceSpreadStrip
        spread={spread}
        names={NAMES}
        highlighted={confidenceGroup(8)}
        onHighlight={onHighlight}
      />
    )
    fireEvent.click(screen.getByLabelText('2 chose 8'))
    expect(onHighlight).toHaveBeenLastCalledWith(null)
  })

  it('gives the grid highlight entries for the chosen levels only', () => {
    expect(confidenceSpreadEntries(tallyConfidenceSpread(STUDENTS))).toEqual([
      { group: 'confidence:3', studentIds: ['c'] },
      { group: 'confidence:8', studentIds: ['a', 'b'] },
    ])
    expect(confidenceSpreadEntries(null)).toEqual([])
  })
})
