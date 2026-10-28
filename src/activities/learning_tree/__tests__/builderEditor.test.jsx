import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import definition from '../definition.js'
import ui from '../ui.jsx'
import { renderBuilderEditor } from '../../../test/activityBuilderHarness.jsx'

const start = () => definition.defaultTask({ id: 1, title: 'Grow a tree' })

describe('Learning Tree BuilderEditor', () => {
  it('edits the features and labels as comma lists', () => {
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    fireEvent.change(screen.getByLabelText('Features'), { target: { value: 'has_fur, can_fly' } })
    fireEvent.change(screen.getByLabelText('Labels'), { target: { value: 'pet, wild, farm' } })
    expect(task().features).toEqual(['has_fur', 'can_fly'])
    expect(task().labels).toEqual(['pet', 'wild', 'farm'])
  })

  it('sets and clears the numbers', () => {
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    fireEvent.change(screen.getByLabelText('Max depth'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Pass at'), { target: { value: '0.6' } })
    expect(task()).toMatchObject({ maxDepth: 2, passAt: 0.6 })
    fireEvent.change(screen.getByLabelText('Max depth'), { target: { value: '' } })
    expect(task().maxDepth).toBeUndefined()
  })

  it('edits, adds and removes test items', () => {
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    fireEvent.change(screen.getByLabelText('Test item 1 name'), { target: { value: 'Rabbit' } })
    fireEvent.change(screen.getByLabelText('Test item 1 label'), { target: { value: 'wild' } })
    fireEvent.click(screen.getByLabelText('Test item 1 can_fly'))
    expect(task().testItems[0]).toEqual({
      name: 'Rabbit',
      yes: ['has_fur', 'can_fly'],
      label: 'wild',
    })
    fireEvent.click(screen.getByLabelText('Test item 1 can_fly'))
    expect(task().testItems[0].yes).toEqual(['has_fur'])
    fireEvent.click(screen.getByRole('button', { name: '+ Add test item' }))
    expect(task().testItems).toHaveLength(6)
    fireEvent.click(screen.getByRole('button', { name: 'Remove test item 6' }))
    expect(task().testItems).toHaveLength(5)
  })

  it('shows validation messages', () => {
    renderBuilderEditor(ui.BuilderEditor, { ...start(), labels: ['pet'] })
    expect(screen.getByText(/labels must be 2 to 6/)).toBeInTheDocument()
  })
})
