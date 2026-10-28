import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import definition from '../definition.js'
import ui from '../ui.jsx'
import { renderBuilderEditor } from '../../../test/activityBuilderHarness.jsx'

const errorsOf = (task) => definition.validateTask(task, { n: 1 }).errors
const start = () => definition.defaultTask({ id: 1, title: 'Network' })

describe('Network Playground BuilderEditor', () => {
  it('starts from a valid default task', () => {
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    expect(errorsOf(task())).toEqual([])
    expect(screen.getByLabelText('Starting layers')).toHaveValue('3')
    expect(screen.getByLabelText('Most neurons in a layer')).toHaveValue(6)
    expect(screen.getByLabelText('Accuracy to pass')).toHaveValue(0.9)
  })

  it('picks the dots and the numbers', () => {
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    fireEvent.click(screen.getByRole('radio', { name: /Spiral/ }))
    expect(task().dataset).toBe('spiral')
    fireEvent.change(screen.getByLabelText('Most neurons in a layer'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('Accuracy to pass'), { target: { value: '0.8' } })
    expect(task()).toMatchObject({ maxNeurons: 4, target: 0.8 })
    fireEvent.click(screen.getByLabelText('Students can add a layer'))
    expect(task().allowAddLayer).toBe(false)
  })

  it('reads the starting layers when the box is left', () => {
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    const box = screen.getByLabelText('Starting layers')
    fireEvent.change(box, { target: { value: '4, 3' } })
    fireEvent.blur(box)
    expect(task().layers).toEqual([4, 3])
  })

  it('shows validation messages', () => {
    renderBuilderEditor(ui.BuilderEditor, { ...start(), target: 2 })
    expect(screen.getByText(/target must be a number above 0.5/)).toBeInTheDocument()
  })
})
