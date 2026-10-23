import React from 'react'
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import definition from '../definition.js'
import ui from '../ui.jsx'
import { renderBuilderEditor } from '../../../test/activityBuilderHarness.jsx'

const errorsOf = (task) => definition.validateTask(task, { n: 1 }).errors
const start = () => definition.defaultTask({ id: 1, title: 'Station' })
const optionValues = (select) => [...select.options].map((o) => o.value)

describe('Station BuilderEditor', () => {
  it('changes the lesson', async () => {
    const user = userEvent.setup()
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    await user.click(screen.getByRole('radio', { name: /2\. Special Delivery/ }))
    expect(task().lesson).toBe(2)
  })

  it('limits the goal list to the lesson', async () => {
    const user = userEvent.setup()
    renderBuilderEditor(ui.BuilderEditor, start())
    const goals = screen.getByLabelText('Item 1 goal')
    expect(optionValues(goals)).toEqual(['power_on', 'pick_colour'])
    await user.click(screen.getByRole('radio', { name: /4\. The Catalogue/ }))
    // The leftover Lesson 1 goal stays visible (flagged) until the author changes it.
    expect(optionValues(screen.getByLabelText('Item 1 goal'))).toEqual([
      'power_on',
      'select',
      'place_part',
      'undo',
      'order_part',
    ])
  })

  it('adds a goal and picks a goal and target', async () => {
    const user = userEvent.setup()
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    await user.click(screen.getByRole('button', { name: '+ Add goal' }))
    expect(task().items[2]).toMatchObject({ id: 'a', goal: 'power_on' })
    fireEvent.change(screen.getByLabelText('Item 3 target'), { target: { value: 'left' } })
    expect(task().items[2].target).toBe('left')
    fireEvent.change(screen.getByLabelText('Item 2 target'), { target: { value: 'lights' } })
    expect(task().items[1].target).toBe('lights')
    fireEvent.change(screen.getByLabelText('Item 3 goal'), { target: { value: 'pick_colour' } })
    expect(task().items[2]).toMatchObject({ goal: 'pick_colour', target: 'hull' })
    expect(errorsOf(task())).toEqual([])
  })

  it('offers the catalogue parts as targets and edits the part list in lessons 3 and 4', async () => {
    const user = userEvent.setup()
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    expect(screen.queryByRole('group', { name: 'Parts on offer' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /3\. Build It/ }))
    fireEvent.change(screen.getByLabelText('Item 1 goal'), { target: { value: 'place_part' } })
    expect(optionValues(screen.getByLabelText('Item 1 target'))).toEqual([
      '',
      'solar',
      'dome',
      'greenhouse',
      'docking-arm',
    ])
    await user.click(screen.getByRole('checkbox', { name: 'Dome' }))
    expect(task().catalogue).toEqual(['solar', 'greenhouse', 'docking-arm'])
    expect(optionValues(screen.getByLabelText('Item 1 target'))).not.toContain('dome')
    await user.click(screen.getByRole('checkbox', { name: 'Dome' }))
    expect(task().catalogue).toBeUndefined()
  })

  it('shows validation under the right goal', () => {
    const { task } = renderBuilderEditor(ui.BuilderEditor, {
      ...start(),
      items: [
        { id: 'a', goal: 'power_on' },
        { id: 'b', goal: 'power_on' },
      ],
    })
    fireEvent.change(screen.getByLabelText('Item 2 goal'), { target: { value: 'pick_colour' } })
    fireEvent.change(screen.getByLabelText('Item 2 target'), { target: { value: 'hull' } })
    expect(errorsOf(task())).toEqual([])
    fireEvent.change(screen.getByLabelText('item 2 id'), { target: { value: 'a' } })
    const row = screen.getByLabelText('Item 2 goal').closest('.te-act-row')
    expect(within(row).getByRole('alert')).toHaveTextContent('id "a" is used more than once')
  })

  it('keeps the prompt optional, with the generated one as placeholder', () => {
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    expect(screen.getByLabelText('Item 1 prompt')).toHaveAttribute(
      'placeholder',
      'Light up the whole station.'
    )
    fireEvent.change(screen.getByLabelText('Item 1 prompt'), { target: { value: 'Go!' } })
    expect(task().items[0].prompt).toBe('Go!')
  })
})
