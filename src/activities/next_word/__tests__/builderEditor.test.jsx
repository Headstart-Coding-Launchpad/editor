import React from 'react'
import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import definition from '../definition.js'
import ui from '../ui.jsx'
import { answerHint } from '../NextWordBuilderEditor.jsx'
import { renderBuilderEditor } from '../../../test/activityBuilderHarness.jsx'

const errorsOf = (task) => definition.validateTask(task, { n: 1 }).errors
const start = () => definition.defaultTask({ id: 1, title: 'Next word' })

describe('Next Word BuilderEditor', () => {
  it('is registered on the activity UI', () => {
    expect(typeof ui.BuilderEditor).toBe('function')
  })

  it('edits texts: title, body with a character count, add and remove', async () => {
    const user = userEvent.setup()
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    fireEvent.change(screen.getByLabelText('Text 1 title'), { target: { value: 'Match' } })
    fireEvent.change(screen.getByLabelText('Text 1 body'), { target: { value: 'a b a b' } })
    expect(screen.getByText('7 of 4000 characters')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '+ Add text' }))
    expect(task().texts[0]).toEqual({ title: 'Match', body: 'a b a b' })
    expect(task().texts).toHaveLength(2)
    await user.click(screen.getByRole('button', { name: 'Remove text 2' }))
    expect(task().texts).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Remove text 1' })).toBeDisabled()
  })

  it('toggles paste and temperature', async () => {
    const user = userEvent.setup()
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    await user.click(screen.getByLabelText(/Let students paste/))
    await user.click(screen.getByLabelText('Show the temperature slider'))
    expect(task().allowPaste).toBe(true)
    expect(task().showTemperature).toBe(false)
  })

  it('edits items and shows the likeliest next word for the prompt', async () => {
    const user = userEvent.setup()
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    expect(screen.getByTestId('next_word-hint-1')).toHaveTextContent('net: 3 of 7 times')
    await user.click(screen.getByRole('button', { name: '+ Add item' }))
    fireEvent.change(screen.getByLabelText('Item 2 prompt'), { target: { value: 'the keeper' } })
    fireEvent.change(screen.getByLabelText('Item 2 answer'), { target: { value: 'looks' } })
    expect(task().items[1]).toEqual({ id: 'b', prompt: 'the keeper', answer: 'looks' })
    expect(screen.getByTestId('next_word-hint-2')).toHaveTextContent('looks: 1 of 1 time')
    expect(errorsOf(task())).toEqual([])
  })

  it('shows a validation message beside a wrong answer', () => {
    renderBuilderEditor(ui.BuilderEditor, start())
    fireEvent.change(screen.getByLabelText('Item 1 answer'), { target: { value: 'ball' } })
    expect(screen.getByRole('alert')).toHaveTextContent(/not the most likely word/)
  })
})

describe('answerHint', () => {
  const task = { texts: [{ title: 'T', body: 'a b a c' }] }
  it('names tied words, missing words and empty input', () => {
    expect(answerHint(task, 'a')).toMatch(/b: 1 of 2 times \/ c: 1 of 2 times.*tied/)
    expect(answerHint(task, 'c')).toMatch(/Nothing comes after “c”/)
    expect(answerHint(task, '')).toMatch(/Type a prompt/)
    expect(answerHint({ texts: [{ body: '' }] }, 'a')).toMatch(/Add a body/)
  })
})
