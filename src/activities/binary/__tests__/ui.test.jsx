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

function renderBinary(task, options = {}) {
  return renderActivityUi(BinaryStudentView, {
    task,
    initialState: binary.initialState(task),
    ...options,
  })
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

  it('checks, shows the hint for a wrong item and jumps to it', async () => {
    const { onSubmit } = renderBinary(MAKE)
    fireEvent.click(screen.getByRole('switch', { name: 'Bits 8 column' }))
    fireEvent.click(screen.getByRole('button', { name: 'Check answers' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(
      await screen.findByText(/Your bits make 8, which is too big. Check the 8 column./)
    ).toBeInTheDocument()
    // The hint clears as soon as the student changes the item.
    fireEvent.click(screen.getByRole('switch', { name: 'Bits 8 column' }))
    expect(screen.queryByText(/too big/)).not.toBeInTheDocument()
  })

  it('drops check marks when the state or the answer changes from outside', async () => {
    const task = { ...MAKE, items: [{ id: 'a', target: 8 }] }
    const checked = { v: 1, items: { a: { bits: '1000' } } }
    const onSubmit = vi.fn(() => Promise.resolve({ passed: true }))
    const { rerender } = render(
      <BinaryStudentView task={task} state={checked} onChange={() => {}} onSubmit={onSubmit} />
    )
    fireEvent.click(screen.getByRole('button', { name: 'Check answers' }))
    expect(await screen.findByText(/Correct/)).toBeInTheDocument()
    // A teacher reset (or Start again) replaces the state without a student edit.
    rerender(
      <BinaryStudentView
        task={task}
        state={binary.initialState(task)}
        onChange={() => {}}
        onSubmit={onSubmit}
      />
    )
    expect(screen.queryByText(/Correct/)).not.toBeInTheDocument()
    // Back to the checked entry, but the author has changed the answer.
    rerender(
      <BinaryStudentView
        task={{ ...task, items: [{ id: 'a', target: 4 }] }}
        state={checked}
        onChange={() => {}}
        onSubmit={onSubmit}
      />
    )
    expect(screen.queryByText(/Correct/)).not.toBeInTheDocument()
  })

  it('navigates between questions', () => {
    renderBinary(MAKE)
    expect(screen.getByText('Question 1 of 2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    expect(screen.getByText('Question 2 of 2')).toBeInTheDocument()
    expect(screen.getByText('Make the number 3')).toBeInTheDocument()
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

  it('is read-only for a teacher view', () => {
    renderBinary(MAKE, { readOnly: true, initialState: binary.solutionState(MAKE) })
    for (const tile of screen.getAllByRole('switch')) expect(tile).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Check answers' })).not.toBeInTheDocument()
    expect(screen.getByText('✓ Correct')).toBeInTheDocument()
  })
})
