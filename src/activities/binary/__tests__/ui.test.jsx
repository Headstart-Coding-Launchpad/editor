import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BinaryStudentView } from '../ui.jsx'
import binary from '../definition.js'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'

const MAKE = {
  id: 1,
  taskType: 'activity',
  activityType: 'binary',
  mode: 'make_number',
  bits: 4,
  items: [
    { id: 'a', target: 5 },
    { id: 'b', target: 3 },
  ],
}

// The done moment (~700 ms) plus slack on a slow machine.
const MOMENT = { timeout: 3000 }

function renderBinary(task, options = {}) {
  return renderActivityUi(BinaryStudentView, {
    task,
    initialState: binary.initialState(task),
    ...options,
  })
}

// Makes 5 (0101) on the first question.
function makeFive() {
  fireEvent.click(screen.getByRole('switch', { name: 'Bits 4 column' }))
  fireEvent.click(screen.getByRole('switch', { name: 'Bits 1 column' }))
}

describe('Binary UI', () => {
  it('toggles bit tiles as switches with place values and a live decimal', () => {
    const { state } = renderBinary(MAKE)
    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(4)
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('Make the number 5')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch', { name: 'Bits 4 column' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Bits 1 column' }))
    expect(screen.getByRole('switch', { name: 'Bits 4 column' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(screen.getByTestId('live-decimal')).toHaveTextContent('5')
    expect(state().items.a.bits).toBe('0101')
    expect(state().items.b.bits).toBe('0000')
  })

  it('hides the running total in to_binary mode', () => {
    renderBinary({ ...MAKE, mode: 'to_binary' })
    expect(screen.getByText('Write 5 in binary')).toBeInTheDocument()
    expect(screen.queryByTestId('live-decimal')).not.toBeInTheDocument()
  })

  it('has no Check button and no in-task navigation, just a progress strip', () => {
    renderBinary(MAKE)
    expect(screen.queryByRole('button', { name: 'Check my work' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Next|Previous/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Question/ })).not.toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Round progress' })).toHaveAttribute(
      'aria-valuenow',
      '0'
    )
    expect(screen.getByText('0 of 2 done')).toBeInTheDocument()
  })

  it('says only "Not yet" for a wrong entry: no hint, no wrong mark, no submit', () => {
    const { onSubmit } = renderBinary(MAKE)
    fireEvent.click(screen.getByRole('switch', { name: 'Bits 8 column' }))
    expect(screen.getByText('Not yet')).toBeInTheDocument()
    expect(screen.queryByText(/too big/)).not.toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('ticks a number the moment the bits make it, then moves on by itself', async () => {
    renderBinary(MAKE)
    makeFive()
    // Straight away: a tick on the item and the strip counts it. The tiles are locked meanwhile.
    expect(screen.getByText('Correct')).toBeInTheDocument()
    expect(screen.getByText('1 of 2 done')).toBeInTheDocument()
    expect(screen.getByText('Make the number 5')).toBeInTheDocument()
    for (const tile of screen.getAllByRole('switch')) expect(tile).toBeDisabled()
    // Then it advances to the next question without any click.
    expect(await screen.findByText('Make the number 3', {}, MOMENT)).toBeInTheDocument()
    expect(screen.queryByText('Correct')).not.toBeInTheDocument()
  })

  it('starts on the first question not done and follows a teacher edit without writing back', () => {
    const onChange = vi.fn()
    const start = binary.initialState(MAKE)
    const { rerender } = render(<BinaryStudentView task={MAKE} state={start} onChange={onChange} />)
    expect(screen.getByText('Make the number 5')).toBeInTheDocument()
    // The teacher finishes question 2 while the student is still on question 1.
    const edited = { ...start, items: { ...start.items, b: { ...start.items.b, bits: '0011' } } }
    rerender(<BinaryStudentView task={MAKE} state={edited} onChange={onChange} />)
    expect(screen.getByText('Make the number 5')).toBeInTheDocument()
    expect(screen.getByText('1 of 2 done')).toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('moves focus between tiles with the arrow keys', () => {
    renderBinary(MAKE)
    const [first, second] = screen.getAllByRole('switch')
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(second)
  })

  it('accepts only digits for to_decimal answers', () => {
    const task = { ...MAKE, mode: 'to_decimal', items: [{ id: 'a', value: '0110' }] }
    const { state } = renderBinary(task)
    fireEvent.change(screen.getByLabelText('Your answer in decimal'), {
      target: { value: '6x' },
    })
    expect(state().items.a.answer).toBe('6')
  })

  it('adds with a carry row whose rightmost column is never used', async () => {
    const task = {
      ...MAKE,
      mode: 'add',
      items: [{ id: 'a', a: '0011', b: '0001' }],
    }
    const { state } = renderBinary(task)
    expect(screen.getAllByRole('switch', { name: /Carries/ })).toHaveLength(3)
    fireEvent.click(screen.getByRole('switch', { name: 'Carries 2 column' }))
    fireEvent.click(screen.getByRole('switch', { name: 'Answer 4 column' }))
    expect(state().items.a).toEqual({ bits: '0100', carries: '0010' })
    await waitFor(() => expect(binary.grade(task, state()).passed).toBe(true))
  })

  it('is read-only for a teacher view, and the tutor can pick any question', () => {
    renderBinary(MAKE, { readOnly: true, initialState: binary.solutionState(MAKE) })
    for (const tile of screen.getAllByRole('switch')) expect(tile).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Check my work' })).not.toBeInTheDocument()
    expect(screen.getByText('Correct')).toBeInTheDocument()
    // Tutor-only picker: look at question 1 after the student has moved on.
    fireEvent.click(screen.getByRole('button', { name: 'Item 1, done' }))
    expect(screen.getByText('Make the number 5')).toBeInTheDocument()
    expect(screen.queryByText('Play again')).not.toBeInTheDocument()
  })
})

describe('Binary UI: core and bonus rounds', () => {
  const task = { ...MAKE, coreItems: 1 }

  it('shows the bonus moment once the core is done and labels later items Bonus', async () => {
    const { onSubmit } = renderBinary(task)
    expect(screen.queryByTestId('round-bonus')).not.toBeInTheDocument()
    makeFive()
    expect(screen.getByText('Done! ⭐ Bonus round')).toBeInTheDocument()
    expect(await screen.findByText('Make the number 3', {}, MOMENT)).toBeInTheDocument()
    expect(screen.getByText('Bonus')).toBeInTheDocument()
    expect(screen.getByText('1 of 1 done')).toBeInTheDocument()
    // The host marks the task; the view never submits.
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('shows the finish card when everything is done, and Play again clears it locally', async () => {
    const { onSubmit, state } = renderBinary(task, { initialState: binary.solutionState(task) })
    expect(screen.getByText('You did it! 2 done')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(binary.grade(task, state()).passed).toBe(false)
    // A clear is never a submit: nothing is logged and the task is not un-passed by the view.
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('Make the number 5')).toBeInTheDocument()
    expect(screen.getByText('0 of 1 done')).toBeInTheDocument()
  })
})
