import React, { useState } from 'react'
import { act, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CalmAsideSlot, useCalmAside } from '../calmAside'
import TaskSlideTransition, { TASK_TRANSITION_MS } from '../TaskSlideTransition'

// A slot inside a child that changes on its own (like ScratchWorkspace showing `calm.aside` only
// once it has loaded): the parent does not re-render when it appears or goes.
let setChildSlotShown = null
function ChildWithSlot({ aside }) {
  const [shown, setShown] = useState(false)
  setChildSlotShown = setShown
  return shown ? <CalmAsideSlot aside={aside} testId="slot-child" /> : null
}

function Harness({ where = 'a', wanted = true, children }) {
  const { aside, orphaned, portal } = useCalmAside(wanted)
  return (
    <>
      <div>{where === 'a' && <CalmAsideSlot aside={aside} testId="slot-a" />}</div>
      <div>{where === 'b' && <CalmAsideSlot aside={aside} testId="slot-b" />}</div>
      <div>{where === 'child' && <ChildWithSlot aside={aside} />}</div>
      {orphaned && <div data-testid="inline">{children}</div>}
      {portal(children)}
    </>
  )
}

function Card({ withFrame = false }) {
  return (
    <div data-testid="card" style={{ overflow: 'auto' }}>
      <button type="button">Fold</button>
      <input aria-label="Answer" defaultValue="hello world" />
      <p data-testid="words">Make the cat say hello</p>
      {withFrame && <iframe title="Video" data-testid="frame" />}
    </div>
  )
}

describe('calm aside host', () => {
  it('moves the same card between slots (no remount) and keeps its scroll', () => {
    const { rerender } = render(<Harness where="a">{<Card />}</Harness>)
    const card = screen.getByTestId('card')
    expect(within(screen.getByTestId('slot-a')).getByTestId('card')).toBe(card)
    card.scrollTop = 80
    rerender(<Harness where="b">{<Card />}</Harness>)
    expect(within(screen.getByTestId('slot-b')).getByTestId('card')).toBe(card)
    expect(card.scrollTop).toBe(80)
  })

  it('keeps focus on the focused control through a move', () => {
    const { rerender } = render(<Harness where="a">{<Card />}</Harness>)
    screen.getByRole('button', { name: 'Fold' }).focus()
    rerender(<Harness where="b">{<Card />}</Harness>)
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fold' }))
  })

  it('keeps a focused text box’s selection through a move', () => {
    const { rerender } = render(<Harness where="a">{<Card />}</Harness>)
    const input = screen.getByRole('textbox', { name: 'Answer' })
    input.focus()
    input.setSelectionRange(2, 7)
    rerender(<Harness where="b">{<Card />}</Harness>)
    expect(document.activeElement).toBe(input)
    expect([input.selectionStart, input.selectionEnd]).toEqual([2, 7])
  })

  it('keeps a text selection inside the card through a move', () => {
    const { rerender } = render(<Harness where="a">{<Card />}</Harness>)
    const text = screen.getByTestId('words').firstChild
    const range = document.createRange()
    range.setStart(text, 9)
    range.setEnd(text, 12)
    window.getSelection().removeAllRanges()
    window.getSelection().addRange(range)
    rerender(<Harness where="b">{<Card />}</Harness>)
    expect(window.getSelection().toString()).toBe('cat')
  })

  it('re-renders a card holding an iframe in its new slot instead of carrying the iframe over', () => {
    const { rerender } = render(<Harness where="a">{<Card withFrame />}</Harness>)
    const frame = screen.getByTestId('frame')
    rerender(<Harness where="b">{<Card withFrame />}</Harness>)
    const slotB = screen.getByTestId('slot-b')
    expect(within(slotB).getByTestId('frame')).not.toBe(frame)
    expect(screen.getAllByTestId('card')).toHaveLength(1)
  })

  it('with no slot on screen the card renders inline (never into a detached node)', () => {
    const { rerender } = render(<Harness where="none">{<Card />}</Harness>)
    expect(within(screen.getByTestId('inline')).getByTestId('card')).toBeInTheDocument()
    expect(screen.getAllByTestId('card')).toHaveLength(1)
    rerender(<Harness where="a">{<Card />}</Harness>)
    expect(screen.queryByTestId('inline')).not.toBeInTheDocument()
    expect(within(screen.getByTestId('slot-a')).getByTestId('card')).toBeInTheDocument()
  })

  it('follows a slot that a child shows or drops on its own', () => {
    render(<Harness where="child">{<Card />}</Harness>)
    expect(within(screen.getByTestId('inline')).getByTestId('card')).toBeInTheDocument()
    act(() => setChildSlotShown(true))
    expect(within(screen.getByTestId('slot-child')).getByTestId('card')).toBeInTheDocument()
    expect(screen.queryByTestId('inline')).not.toBeInTheDocument()
    act(() => setChildSlotShown(false))
    expect(within(screen.getByTestId('inline')).getByTestId('card')).toBeInTheDocument()
  })

  it('is never orphaned while not wanted', () => {
    render(
      <Harness where="none" wanted={false}>
        {null}
      </Harness>
    )
    expect(screen.queryByTestId('inline')).not.toBeInTheDocument()
  })
})

describe('calm aside host across a task slide', () => {
  it('keeps the card in the new task after the leaving slide goes (Scratch to Scratch)', () => {
    vi.useFakeTimers()
    try {
      function Panel({ task }) {
        const { aside, portal } = useCalmAside(true)
        return (
          <>
            <TaskSlideTransition transitionKey={task} order={task}>
              <CalmAsideSlot aside={aside} testId={`slot-${task}`} />
            </TaskSlideTransition>
            {portal(<Card />)}
          </>
        )
      }
      const { rerender } = render(<Panel task={1} />)
      rerender(<Panel task={2} />)
      act(() => {
        vi.advanceTimersByTime(TASK_TRANSITION_MS + 50)
      })
      expect(within(screen.getByTestId('slot-2')).getByTestId('card')).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
