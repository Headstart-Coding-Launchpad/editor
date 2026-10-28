import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import definition from '../definition.js'
import ui from '../ui.jsx'
import { renderBuilderEditor } from '../../../test/activityBuilderHarness.jsx'

const errorsOf = (task) => definition.validateTask(task, { n: 1 }).errors
const start = () => definition.defaultTask({ id: 1, title: 'Game agent' })

describe('Game agent BuilderEditor', () => {
  it('starts from a valid default task', () => {
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    expect(errorsOf(task())).toEqual([])
    expect(screen.getByLabelText('Map')).toHaveValue('#####\n#R..#\n#.#T#\n#####')
    expect(screen.getByLabelText('Treasure reward')).toHaveValue(10)
    expect(screen.getByLabelText('Tries per Train')).toHaveValue(50)
  })

  it('edits the map one row per line', () => {
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    fireEvent.change(screen.getByLabelText('Map'), { target: { value: 'R.T\n...\n' } })
    expect(task().map).toEqual(['R.T', '...'])
    expect(errorsOf(task())).toEqual([])
  })

  it('shows a map mistake inline', () => {
    renderBuilderEditor(ui.BuilderEditor, start())
    fireEvent.change(screen.getByLabelText('Map'), { target: { value: 'R..' } })
    expect(screen.getByRole('alert')).toHaveTextContent('map needs exactly one T')
  })

  it('edits rewards, tries and the learning curve', () => {
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    fireEvent.change(screen.getByLabelText('Step reward'), { target: { value: '-3' } })
    expect(task().rewards).toEqual({ treasure: 10, step: -3, wall: -5, pit: -10 })
    fireEvent.change(screen.getByLabelText('Tries per Train'), { target: { value: '120' } })
    expect(task().episodes).toBe(120)
    fireEvent.click(screen.getByLabelText('Show the learning curve'))
    expect(task().showLearning).toBe(false)
    fireEvent.click(screen.getByLabelText('Show the learning curve'))
    expect(task().showLearning).toBeUndefined()
    fireEvent.change(screen.getByLabelText('Tries per Train'), { target: { value: '0' } })
    expect(errorsOf(task())).toEqual(['Task 1: episodes must be a whole number from 1 to 500.'])
  })
})
