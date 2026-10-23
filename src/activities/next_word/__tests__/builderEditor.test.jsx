import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import definition from '../definition.js'
import ui from '../ui.jsx'
import { renderBuilderEditor } from '../../../test/activityBuilderHarness.jsx'

const errorsOf = (task) => definition.validateTask(task, { n: 1 }).errors
const start = () => definition.defaultTask({ id: 1, title: 'Next word' })

describe('Next Word BuilderEditor', () => {
  it('is registered on the activity UI', () => {
    expect(typeof ui.BuilderEditor).toBe('function')
  })

  it('edits texts: title, emoji, body with a character count, add and remove', async () => {
    const user = userEvent.setup()
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    fireEvent.change(screen.getByLabelText('Text 1 title'), { target: { value: 'Match' } })
    fireEvent.change(screen.getByLabelText('Text 1 emoji'), { target: { value: 'G' } })
    fireEvent.change(screen.getByLabelText('Text 1 body'), { target: { value: 'a b a b' } })
    expect(screen.getByText('7 of 4000 characters')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '+ Add text' }))
    expect(task().texts[0]).toEqual({ title: 'Match', emoji: 'G', body: 'a b a b' })
    expect(task().texts).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Remove text 2' }))
    expect(task().texts).toHaveLength(1)
  })

  it('sets the number of guesses', () => {
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    fireEvent.change(screen.getByLabelText('Guesses'), { target: { value: '3' } })
    expect(task().guesses).toBe(3)
    fireEvent.change(screen.getByLabelText('Guesses'), { target: { value: '99' } })
    expect(errorsOf(task())).toEqual([expect.stringMatching(/guesses must be a whole number/)])
  })

  it('ticks panels on and off, keeping them in a fixed order', async () => {
    const user = userEvent.setup()
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    expect(task().panels).toEqual(['stats'])
    await user.click(screen.getByLabelText(/^Voices:/))
    expect(task().panels).toEqual(['stats', 'voices'])
    await user.click(screen.getByLabelText(/^Silly:/))
    expect(task().panels).toEqual(['stats', 'silly', 'voices'])
    await user.click(screen.getByLabelText(/^Stats:/))
    expect(task().panels).toEqual(['silly', 'voices'])
  })
})
