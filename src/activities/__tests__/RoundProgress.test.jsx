import React, { useState } from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RoundProgress, { BonusBanner, RoundFinished } from '../ui/RoundProgress.jsx'
import TutorItemPicker from '../ui/TutorItemPicker.jsx'
import { DONE_MOMENT_MS, useRoundFlow } from '../ui/useRoundFlow.js'

describe('RoundProgress', () => {
  it('shows one dot per rep and the same "3 of 5 done" wording', () => {
    render(<RoundProgress done={3} total={5} />)
    const bar = screen.getByRole('progressbar', { name: 'Round progress' })
    expect(bar).toHaveAttribute('aria-valuenow', '3')
    expect(bar).toHaveAttribute('aria-valuemax', '5')
    expect(bar.children).toHaveLength(5)
    expect(bar.querySelectorAll('.act-round__dot--done')).toHaveLength(3)
    expect(screen.getByText('3 of 5 done')).toHaveAttribute('aria-live', 'polite')
  })

  it('is not interactive: no buttons and no numbered controls', () => {
    render(<RoundProgress done={1} total={4} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('counts against the core and draws bonus reps after it', () => {
    const { rerender } = render(<RoundProgress done={2} total={5} core={3} />)
    expect(screen.getByText('2 of 3 done')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '3')
    expect(document.querySelectorAll('.act-round__dot--bonus')).toHaveLength(2)
    rerender(<RoundProgress done={4} total={5} core={3} />)
    expect(screen.getByText('3 of 3 done · +1 bonus')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '3')
  })

  it('renders nothing for a single rep', () => {
    const { container } = render(<RoundProgress done={0} total={1} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe('round moments', () => {
  it('shows the bonus line and a finish card with Play again', () => {
    render(<BonusBanner />)
    expect(screen.getByText('Done! ⭐ Bonus round')).toBeInTheDocument()
    const onPlayAgain = vi.fn()
    render(<RoundFinished total={4} onPlayAgain={onPlayAgain} />)
    expect(screen.getByText('You did it! 4 done')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(onPlayAgain).toHaveBeenCalledTimes(1)
  })

  it('says a custom message instead of "You did it!" when given one', () => {
    render(<RoundFinished total={3} message="Round done! You spotted 0 of 3" />)
    expect(screen.getByText('Round done! You spotted 0 of 3')).toBeInTheDocument()
    expect(screen.queryByText(/You did it/)).not.toBeInTheDocument()
  })

  it('has no Play again for a read-only view', () => {
    render(<RoundFinished total={2} onPlayAgain={() => {}} readOnly />)
    expect(screen.queryByRole('button', { name: 'Play again' })).not.toBeInTheDocument()
  })
})

describe('TutorItemPicker', () => {
  it('lets a tutor pick any item and shows its state', () => {
    const onSelect = vi.fn()
    const items = [{ id: 'a' }, { id: 'b' }]
    render(
      <TutorItemPicker
        items={items}
        currentId="b"
        onSelect={onSelect}
        statusFor={(item) => (item.id === 'a' ? 'done' : null)}
      />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Item 1, done' }))
    expect(onSelect).toHaveBeenCalledWith('a')
    expect(screen.getByRole('button', { name: 'Item 2' })).toHaveAttribute('aria-current', 'step')
  })
})

// A tiny round: each button marks the shown item done.
function Round({ readOnly = false, momentMs }) {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  const [done, setDone] = useState({})
  const flow = useRoundFlow(items, (item) => !!done[item.id], { readOnly, momentMs })
  return (
    <div>
      <p data-testid="shown">{flow.current ? flow.current.id : 'none'}</p>
      <p data-testid="lingering">{String(flow.lingering)}</p>
      <p data-testid="finished">{String(flow.finished)}</p>
      <p data-testid="count">{flow.doneCount}</p>
      <button
        type="button"
        onClick={() => setDone((prev) => ({ ...prev, [flow.current.id]: true }))}
      >
        finish
      </button>
      <button type="button" onClick={() => setDone({})}>
        clear
      </button>
    </div>
  )
}

describe('useRoundFlow (auto-advance)', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const shown = () => screen.getByTestId('shown').textContent

  it('keeps a finished item on screen for the done moment, then moves on by itself', () => {
    render(<Round />)
    expect(shown()).toBe('a')
    fireEvent.click(screen.getByText('finish'))
    // Straight away: still the finished item, marked lingering, already counted.
    expect(shown()).toBe('a')
    expect(screen.getByTestId('lingering')).toHaveTextContent('true')
    expect(screen.getByTestId('count')).toHaveTextContent('1')
    act(() => vi.advanceTimersByTime(DONE_MOMENT_MS - 50))
    expect(shown()).toBe('a')
    act(() => vi.advanceTimersByTime(100))
    expect(shown()).toBe('b')
    expect(screen.getByTestId('lingering')).toHaveTextContent('false')
  })

  it('with an infinite moment stays on the finished item until skipped', () => {
    render(<Round momentMs={Infinity} />)
    fireEvent.click(screen.getByText('finish'))
    act(() => vi.advanceTimersByTime(60 * 1000))
    expect(shown()).toBe('a')
    expect(screen.getByTestId('lingering')).toHaveTextContent('true')
  })

  it('finishes after the last item, and Play again (clear) starts over without lingering', () => {
    render(<Round />)
    for (const expected of ['a', 'b', 'c']) {
      expect(shown()).toBe(expected)
      fireEvent.click(screen.getByText('finish'))
      act(() => vi.advanceTimersByTime(DONE_MOMENT_MS + 50))
    }
    expect(screen.getByTestId('finished')).toHaveTextContent('true')
    expect(shown()).toBe('none')
    fireEvent.click(screen.getByText('clear'))
    expect(screen.getByTestId('finished')).toHaveTextContent('false')
    expect(shown()).toBe('a')
    expect(screen.getByTestId('lingering')).toHaveTextContent('false')
  })

  it('does not finish until the last done moment has passed', () => {
    render(<Round />)
    for (let i = 0; i < 2; i++) {
      fireEvent.click(screen.getByText('finish'))
      act(() => vi.advanceTimersByTime(DONE_MOMENT_MS + 50))
    }
    fireEvent.click(screen.getByText('finish'))
    expect(screen.getByTestId('finished')).toHaveTextContent('false')
    expect(shown()).toBe('c')
    act(() => vi.advanceTimersByTime(DONE_MOMENT_MS + 50))
    expect(screen.getByTestId('finished')).toHaveTextContent('true')
  })
})
