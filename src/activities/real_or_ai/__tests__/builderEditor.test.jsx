import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import definition from '../definition.js'
import ui from '../ui.jsx'
import { renameTell } from '../RealOrAiBuilderEditor.jsx'
import { renderBuilderEditor } from '../../../test/activityBuilderHarness.jsx'

const errorsOf = (task) => definition.validateTask(task, { n: 1 }).errors
const start = () => definition.defaultTask({ id: 1, title: 'Spot the AI' })

describe('Real or AI BuilderEditor', () => {
  it('adds, renames and removes clues, and a rename keeps the pairs pointing at it', async () => {
    const user = userEvent.setup()
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    fireEvent.change(screen.getByLabelText('Clue 1'), { target: { value: 'weird_detail' } })
    expect(task().tells[0]).toBe('weird_detail')
    expect(task().items[0].tell).toBe('weird_detail')
    await user.click(screen.getByRole('button', { name: '+ Add clue' }))
    expect(task().tells).toHaveLength(4)
    await user.click(screen.getByRole('button', { name: 'Remove clue 4' }))
    expect(task().tells).toHaveLength(3)
    expect(errorsOf(task())).toEqual([])
    expect(renameTell({ tells: ['x', 'y'], items: [{ tell: 'x' }] }, 0, 'z').items[0].tell).toBe(
      'z'
    )
  })

  it('edits a pair: kind, sides, alt text, answer, clue, reliable and reveal', () => {
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    fireEvent.change(screen.getByLabelText('Item 1 kind'), { target: { value: 'image' } })
    fireEvent.change(screen.getByLabelText('Item 1 side A image'), {
      target: { value: 'images/real.jpg' },
    })
    fireEvent.change(screen.getByLabelText('Item 1 side B image'), {
      target: { value: 'images/ai.jpg' },
    })
    fireEvent.change(screen.getByLabelText('Item 1 alt text A'), { target: { value: 'A cat' } })
    fireEvent.change(screen.getByLabelText('Item 1 answer'), { target: { value: 'a' } })
    fireEvent.change(screen.getByLabelText('Item 1 clue'), { target: { value: 'too_smooth' } })
    fireEvent.click(screen.getByLabelText('Item 1 clue is reliable'))
    fireEvent.change(screen.getByLabelText('Item 1 reveal text'), { target: { value: 'Why.' } })
    expect(task().items[0]).toMatchObject({
      kind: 'image',
      a: 'images/real.jpg',
      b: 'images/ai.jpg',
      altA: 'A cat',
      answer: 'a',
      tell: 'too_smooth',
      reliable: true,
      reveal: 'Why.',
    })
    expect(errorsOf(task())).toEqual([])
  })

  it('adds, reorders and removes pairs', async () => {
    const user = userEvent.setup()
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    await user.click(screen.getByRole('button', { name: '+ Add pair' }))
    expect(task().items.map((item) => item.id)).toEqual(['a', 'pa'])
    await user.click(screen.getByRole('button', { name: 'Move item 2 up' }))
    expect(task().items.map((item) => item.id)).toEqual(['pa', 'a'])
    await user.click(screen.getByRole('button', { name: 'Remove item 1' }))
    expect(task().items.map((item) => item.id)).toEqual(['a'])
  })

  it('shows validation inline for an incomplete pair', async () => {
    const user = userEvent.setup()
    renderBuilderEditor(ui.BuilderEditor, start())
    await user.click(screen.getByRole('button', { name: '+ Add pair' }))
    expect(screen.getByText('a is required.')).toBeInTheDocument()
    expect(screen.getByText('reveal is required.')).toBeInTheDocument()
  })
})
