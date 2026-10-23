import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import definition from '../definition.js'
import ui from '../ui.jsx'
import { renderBuilderEditor } from '../../../test/activityBuilderHarness.jsx'

const errorsOf = (task) => definition.validateTask(task, { n: 1 }).errors
const start = () => definition.defaultTask({ id: 1, title: 'Spot the AI' })

describe('Real or AI BuilderEditor', () => {
  it('has no clues list any more', () => {
    renderBuilderEditor(ui.BuilderEditor, start())
    expect(screen.queryByLabelText('Clue 1')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '+ Add clue' })).not.toBeInTheDocument()
  })

  it('edits a pair: kind, sides, alt text, answer, tell, reliable and the extra note', () => {
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
    fireEvent.change(screen.getByLabelText('Item 1 tell'), { target: { value: 'too smooth' } })
    fireEvent.change(screen.getByLabelText('Item 1 tell is reliable'), { target: { value: 'yes' } })
    fireEvent.change(screen.getByLabelText('Item 1 reveal text'), { target: { value: 'Why.' } })
    expect(task().items[0]).toMatchObject({
      kind: 'image',
      a: 'images/real.jpg',
      b: 'images/ai.jpg',
      altA: 'A cat',
      answer: 'a',
      tell: 'too smooth',
      reliable: true,
      reveal: 'Why.',
    })
    expect(errorsOf(task())).toEqual([])
    // Clearing the tell, reliability and note leaves a valid pair with none of them.
    fireEvent.change(screen.getByLabelText('Item 1 tell'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Item 1 tell is reliable'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Item 1 reveal text'), { target: { value: '' } })
    expect(task().items[0].tell).toBeUndefined()
    expect(task().items[0].reliable).toBeUndefined()
    expect(task().items[0].reveal).toBeUndefined()
    expect(errorsOf(task())).toEqual([])
  })

  it('sets and clears the core pairs', () => {
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    fireEvent.change(screen.getByLabelText('Core items'), { target: { value: '1' } })
    expect(task().coreItems).toBe(1)
    fireEvent.change(screen.getByLabelText('Core items'), { target: { value: '' } })
    expect('coreItems' in task()).toBe(false)
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
    expect(screen.queryByText('reveal is required.')).not.toBeInTheDocument()
  })
})
