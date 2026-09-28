import React from 'react'
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import definition from '../definition.js'
import ui from '../ui.jsx'
import { renameMouseTarget } from '../MouseBuilderEditor.jsx'
import { renderBuilderEditor } from '../../../test/activityBuilderHarness.jsx'

const errorsOf = (task) => definition.validateTask(task, { n: 1 }).errors
const start = () => definition.defaultTask({ id: 1, title: 'Mouse' })

describe('Mouse BuilderEditor', () => {
  it('sets the touch policy', async () => {
    const user = userEvent.setup()
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    await user.click(screen.getByRole('radio', { name: /Needs a mouse/ }))
    expect(task().touch).toBe('block')
    expect(errorsOf(task())).toEqual([])
  })

  it('edits and adds targets, and renaming a target keeps the items pointing at it', async () => {
    const user = userEvent.setup()
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())

    fireEvent.change(screen.getByLabelText('target 1 id'), { target: { value: 'sun' } })
    fireEvent.change(screen.getByLabelText('Target 1 emoji'), { target: { value: '🌞' } })
    fireEvent.change(screen.getByLabelText('Target 1 x'), { target: { value: '0.2' } })
    fireEvent.change(screen.getByLabelText('Target 1 size'), { target: { value: 'small' } })
    await user.click(screen.getByRole('button', { name: '+ Add target' }))

    expect(task().targets[0]).toMatchObject({ id: 'sun', emoji: '🌞', x: 0.2, size: 'small' })
    expect(task().targets[2]).toMatchObject({ id: 'target3', x: 0.5, y: 0.5 })
    expect(task().items).toEqual([
      { id: 'a', action: 'click', target: 'sun' },
      { id: 'b', action: 'drag', target: 'sun', to: 'box' },
    ])
    expect(errorsOf(task())).toEqual([])
  })

  it('edits items: a drag gets a "to" target, other actions drop it', () => {
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    fireEvent.change(screen.getByLabelText('Item 1 action'), { target: { value: 'drag' } })
    expect(task().items[0]).toMatchObject({ action: 'drag', target: 'star', to: 'box' })
    fireEvent.change(screen.getByLabelText('Item 1 drop target'), { target: { value: 'star' } })
    fireEvent.change(screen.getByLabelText('Item 1 action'), { target: { value: 'double_click' } })
    expect(task().items[0].to).toBeUndefined()
    fireEvent.change(screen.getByLabelText('Item 1 target'), { target: { value: 'box' } })
    expect(task().items[0]).toMatchObject({ action: 'double_click', target: 'box' })
    expect(errorsOf(task())).toEqual([])
  })

  it('shows validation inline: a removed target and a hover warning', async () => {
    const user = userEvent.setup()
    renderBuilderEditor(ui.BuilderEditor, start())
    fireEvent.change(screen.getByLabelText('Item 1 action'), { target: { value: 'hover' } })
    const itemRow = screen.getByLabelText('Item 1 action').closest('.te-act-row')
    expect(within(itemRow).getByText(/touch screens can't hover/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Remove target 2' }))
    const dragRow = screen.getByLabelText('Item 2 action').closest('.te-act-row')
    expect(within(dragRow).getByRole('alert')).toHaveTextContent(
      'a drag needs a "to" target that is on the stage.'
    )
  })

  it('places the selected target where the stage is clicked', async () => {
    const user = userEvent.setup()
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    const stage = screen.getByTestId('mouse-placement-preview')
    stage.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 100 })

    await user.click(within(stage).getByRole('button', { name: /Select box/ }))
    fireEvent.click(stage, { clientX: 150, clientY: 25 })
    expect(task().targets[1]).toMatchObject({ id: 'box', x: 0.75, y: 0.25 })
  })

  it('renameMouseTarget leaves items alone while another target still has the old id', () => {
    const task = {
      targets: [
        { id: 'a', x: 0, y: 0 },
        { id: 'a', x: 1, y: 1 },
      ],
      items: [{ id: 'i', action: 'click', target: 'a' }],
    }
    expect(renameMouseTarget(task, 1, 'a', 'b').items[0].target).toBe('a')
  })
})
