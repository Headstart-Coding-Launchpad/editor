import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import definition from '../definition.js'
import ui from '../ui.jsx'
import { renderBuilderEditor } from '../../../test/activityBuilderHarness.jsx'

const start = () => definition.defaultTask({ id: 1, title: 'My feed' })
const errorsOf = (task) => definition.validateTask(task, { n: 1 }).errors

describe('Recommender BuilderEditor', () => {
  it('edits an item: emoji, label and group', () => {
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    fireEvent.change(screen.getByLabelText('Item 1 emoji'), { target: { value: '🏀' } })
    fireEvent.change(screen.getByLabelText('Item 1 label'), { target: { value: 'Basketball' } })
    fireEvent.change(screen.getByLabelText('Item 1 group'), { target: { value: 'sports' } })
    expect(task().items[0]).toMatchObject({ emoji: '🏀', label: 'Basketball', group: 'sports' })
    expect(errorsOf(task())).toEqual([])
  })

  it('sets and clears minRated and toggles the two switches', () => {
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    fireEvent.change(screen.getByLabelText('Minimum rated'), { target: { value: '8' } })
    expect(task().minRated).toBe(8)
    fireEvent.change(screen.getByLabelText('Minimum rated'), { target: { value: '' } })
    expect('minRated' in task()).toBe(false)
    fireEvent.click(screen.getByLabelText('Show Why? buttons'))
    expect(task().showWhy).toBe(false)
    fireEvent.click(screen.getByLabelText('Show the bubble meter'))
    expect(task().bubble).toBe(false)
  })

  it('adds, reorders and removes items, and shows validation inline', async () => {
    const user = userEvent.setup()
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    await user.click(screen.getByRole('button', { name: '+ Add item' }))
    expect(task().items).toHaveLength(13)
    expect(screen.getByText('emoji is required.')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Move item 13 up' }))
    await user.click(screen.getByRole('button', { name: 'Remove item 12' }))
    expect(task().items).toHaveLength(12)
  })
})
