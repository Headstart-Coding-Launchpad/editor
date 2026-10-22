import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import definition from '../definition.js'
import ui from '../ui.jsx'
import { strokesToFlat } from '../classifier.js'
import { renderBuilderEditor } from '../../../test/activityBuilderHarness.jsx'

const errorsOf = (task) => definition.validateTask(task, { n: 1 }).errors
const start = () => definition.defaultTask({ id: 1, title: 'Classifier' })

function drawOn(pad, points) {
  const [first, ...rest] = points
  fireEvent.pointerDown(pad, { pointerId: 1, clientX: first[0], clientY: first[1] })
  for (const [x, y] of rest) fireEvent.pointerMove(pad, { pointerId: 1, clientX: x, clientY: y })
  fireEvent.pointerUp(pad, { pointerId: 1 })
}

describe('Classifier BuilderEditor', () => {
  it('starts from a valid default task', () => {
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    expect(errorsOf(task())).toEqual([])
    expect(screen.getByLabelText('Class names')).toHaveValue('circle, square')
  })

  it('edits the class names', () => {
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    fireEvent.change(screen.getByLabelText('Class names'), {
      target: { value: 'cat, fish, rocket' },
    })
    expect(task().classes).toEqual(['cat', 'fish', 'rocket'])
    // Clearing the box keeps the box (an empty list is "students name their own").
    fireEvent.change(screen.getByLabelText('Class names'), { target: { value: '' } })
    expect(task().classes).toEqual([])
    expect(screen.getByLabelText('Class names')).toBeInTheDocument()
  })

  it('lets students name their own classes', async () => {
    const user = userEvent.setup()
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    await user.click(screen.getByRole('radio', { name: /Students name their own/ }))
    expect(task().classes).toEqual([])
    expect(screen.queryByLabelText('Class names')).not.toBeInTheDocument()
    expect(errorsOf(task())).toEqual([])
    await user.click(screen.getByRole('radio', { name: /I set the classes/ }))
    expect(task().classes).toEqual(['circle', 'square'])
  })

  it('sets the numbers', () => {
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    fireEvent.change(screen.getByLabelText('Drawings needed per class'), {
      target: { value: '10' },
    })
    fireEvent.change(screen.getByLabelText('Target accuracy (%)'), { target: { value: '90' } })
    expect(task().minExamplesPerClass).toBe(10)
    expect(task().targetAccuracy).toBe(0.9)
    fireEvent.change(screen.getByLabelText('Target accuracy (%)'), { target: { value: '' } })
    expect(task().targetAccuracy).toBeUndefined()
  })

  it('shows a validation message next to the fields', () => {
    renderBuilderEditor(ui.BuilderEditor, { ...start(), minExamplesPerClass: 3 })
    expect(screen.getByRole('alert')).toHaveTextContent(
      /held_out needs minExamplesPerClass of at least 4/
    )
  })

  it('switches to live testing and keeps held-out tasks valid', async () => {
    const user = userEvent.setup()
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    await user.click(screen.getByRole('radio', { name: /Live/ }))
    expect(task().testSet).toBe('live')
    fireEvent.change(screen.getByLabelText('Number of live test drawings'), {
      target: { value: '8' },
    })
    expect(task().liveTestSize).toBe(8)
    expect(errorsOf(task())).toEqual([])
    fireEvent.change(screen.getByLabelText('Drawings needed per class'), { target: { value: '2' } })
    await user.click(screen.getByRole('radio', { name: /Kept back/ }))
    expect(task().testSet).toBe('held_out')
    expect(task().minExamplesPerClass).toBe(4)
    expect(task().liveTestSize).toBeUndefined()
    expect(errorsOf(task())).toEqual([])
  })

  it('draws test drawings for a teacher test set and removes them', async () => {
    const user = userEvent.setup()
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    await user.click(screen.getByRole('radio', { name: /My test drawings/ }))
    expect(task().testSet).toBe('teacher')
    expect(task().testItems).toEqual([])
    expect(screen.getByRole('button', { name: '+ Add test drawing' })).toBeDisabled()

    drawOn(screen.getByTestId('classifier-pad'), [
      [0.1, 0.5],
      [0.9, 0.5],
    ])
    await user.click(screen.getByRole('button', { name: '+ Add test drawing' }))
    await user.selectOptions(screen.getByLabelText('Class of the new test drawing'), 'square')
    drawOn(screen.getByTestId('classifier-pad'), [
      [0.2, 0.2],
      [0.8, 0.8],
    ])
    await user.click(screen.getByRole('button', { name: '+ Add test drawing' }))
    expect(task().testItems).toEqual([
      { label: 'circle', strokes: [[0.1, 0.5, 0.9, 0.5]] },
      { label: 'square', strokes: [[0.2, 0.2, 0.8, 0.8]] },
    ])
    expect(errorsOf(task())).toEqual([])

    await user.click(screen.getByRole('button', { name: 'Remove test drawing 1' }))
    expect(task().testItems).toHaveLength(1)
    // Back to another test set drops the test drawings.
    await user.click(screen.getByRole('radio', { name: /Live/ }))
    expect(task().testItems).toBeUndefined()
  })

  it('writes strokes as flat x, y lists to three decimals', () => {
    expect(
      strokesToFlat([
        [
          [0.123456, 0.5],
          [1, 0],
        ],
        [],
      ])
    ).toEqual([[0.123, 0.5, 1, 0]])
  })
})
