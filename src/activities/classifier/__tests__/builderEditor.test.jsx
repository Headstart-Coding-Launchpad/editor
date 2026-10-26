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
  it('starts from a valid default task: three emoji things, the round, the fool-it panel', () => {
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    expect(errorsOf(task())).toEqual([])
    expect(screen.getByLabelText('Class names')).toHaveValue('🐱 cat, 🐟 fish, 🚀 rocket')
    expect(task().minExamplesPerClass).toBe(3)
    expect(task().testSet).toBeUndefined()
    expect(task().panels).toEqual(['fool'])
    expect(screen.getByLabelText('Drawings needed per thing')).toHaveValue(3)
  })

  it('edits the names', () => {
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

  it('lets students name their own things', async () => {
    const user = userEvent.setup()
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    await user.click(screen.getByRole('radio', { name: /Students name their own/ }))
    expect(task().classes).toEqual([])
    expect(screen.queryByLabelText('Class names')).not.toBeInTheDocument()
    expect(errorsOf(task())).toEqual([])
    await user.click(screen.getByRole('radio', { name: /I set the things/ }))
    expect(task().classes).toEqual(['🐱 cat', '🐟 fish', '🚀 rocket'])
  })

  it('switches the extra panels on and off', async () => {
    const user = userEvent.setup()
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    const fool = screen.getByRole('checkbox', { name: 'Fool it and fix it' })
    expect(fool).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'What it sees' })).not.toBeChecked()
    await user.click(screen.getByRole('checkbox', { name: 'What it sees' }))
    expect(task().panels).toEqual(['grid', 'fool'])
    await user.click(screen.getByRole('checkbox', { name: 'How sure is it?' }))
    expect(task().panels).toEqual(['grid', 'sure', 'fool'])
    await user.click(screen.getByRole('checkbox', { name: 'Fool it and fix it' }))
    expect(task().panels).toEqual(['grid', 'sure'])
    expect(errorsOf(task())).toEqual([])
  })

  it('sets the numbers for the round', () => {
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    fireEvent.change(screen.getByLabelText('Drawings needed per thing'), {
      target: { value: '5' },
    })
    fireEvent.change(screen.getByLabelText('Tries in the round'), { target: { value: '8' } })
    expect(task().minExamplesPerClass).toBe(5)
    expect(task().liveTestSize).toBe(8)
    expect(errorsOf(task())).toEqual([])
    // Target accuracy belongs to the Test button versions only.
    expect(screen.queryByLabelText('Target accuracy (%)')).not.toBeInTheDocument()
  })

  it('shows a validation message next to the fields', () => {
    renderBuilderEditor(ui.BuilderEditor, {
      ...start(),
      testSet: 'held_out',
      minExamplesPerClass: 3,
    })
    expect(screen.getByRole('alert')).toHaveTextContent(
      /held_out needs minExamplesPerClass of at least 4/
    )
  })

  it('switches to a kept-back test and back to the round', async () => {
    const user = userEvent.setup()
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    await user.click(screen.getByRole('radio', { name: /Kept back/ }))
    expect(task().testSet).toBe('held_out')
    expect(task().minExamplesPerClass).toBe(4)
    expect(task().liveTestSize).toBeUndefined()
    expect(errorsOf(task())).toEqual([])
    fireEvent.change(screen.getByLabelText('Target accuracy (%)'), { target: { value: '90' } })
    expect(task().targetAccuracy).toBe(0.9)
    fireEvent.change(screen.getByLabelText('Target accuracy (%)'), { target: { value: '' } })
    expect(task().targetAccuracy).toBeUndefined()
    await user.click(screen.getByRole('radio', { name: /The round/ }))
    expect(task().testSet).toBe('live')
    expect(errorsOf(task())).toEqual([])
  })

  it('draws test drawings for a teacher test set and removes them', async () => {
    const user = userEvent.setup()
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    await user.click(screen.getByRole('radio', { name: /My test drawings/ }))
    expect(task().testSet).toBe('teacher')
    expect(task().testItems).toEqual([])
    expect(screen.getByRole('button', { name: '+ Add test drawing' })).toBeDisabled()

    drawOn(screen.getByLabelText(/New test drawing pad/), [
      [0.1, 0.5],
      [0.9, 0.5],
    ])
    await user.click(screen.getByRole('button', { name: '+ Add test drawing' }))
    await user.selectOptions(screen.getByLabelText('Class of the new test drawing'), '🐟 fish')
    drawOn(screen.getByLabelText(/New test drawing pad/), [
      [0.2, 0.2],
      [0.8, 0.8],
    ])
    await user.click(screen.getByRole('button', { name: '+ Add test drawing' }))
    expect(task().testItems).toEqual([
      { label: '🐱 cat', strokes: [[0.1, 0.5, 0.9, 0.5]] },
      { label: '🐟 fish', strokes: [[0.2, 0.2, 0.8, 0.8]] },
    ])
    expect(errorsOf(task())).toEqual([])

    await user.click(screen.getByRole('button', { name: 'Remove test drawing 1' }))
    expect(task().testItems).toHaveLength(1)
    // Back to the round drops the test drawings.
    await user.click(screen.getByRole('radio', { name: /The round/ }))
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
