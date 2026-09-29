import React from 'react'
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import definition from '../definition.js'
import ui from '../ui.jsx'
import { KEYBOARD_MODES } from '../keyboard.js'
import { changeKeyboardMode } from '../KeyboardBuilderEditor.jsx'
import { renderBuilderEditor } from '../../../test/activityBuilderHarness.jsx'

const errorsOf = (task) => definition.validateTask(task, { n: 1 }).errors
const start = () => definition.defaultTask({ id: 1, title: 'Keys' })

describe('Keyboard BuilderEditor', () => {
  it.each(KEYBOARD_MODES)('switching to %s gives a valid task', (mode) => {
    const next = changeKeyboardMode(start(), mode)
    expect(next.mode).toBe(mode)
    expect(errorsOf(next)).toEqual([])
    if (mode !== 'type_text') expect(next.requireShiftForCapitals).toBeUndefined()
  })

  it('edits the typing options and items', async () => {
    const user = userEvent.setup()
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())

    expect(screen.getByText(/UK is the only layout so far/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Minimum accuracy'), { target: { value: '0.9' } })
    fireEvent.change(screen.getByLabelText('Target words a minute'), { target: { value: '12' } })
    await user.click(screen.getByLabelText('Capitals need Shift (not Caps Lock)'))
    fireEvent.change(screen.getByLabelText('Item 1 text'), { target: { value: 'My name is Sam.' } })
    await user.click(screen.getByRole('button', { name: '+ Add item' }))
    const row2 = screen.getAllByText('Real keyboard only')[1].closest('label')
    await user.click(within(row2).getByRole('checkbox'))

    expect(task()).toMatchObject({
      minAccuracy: 0.9,
      targetWpm: 12,
      layout: 'uk',
      items: [
        { id: 'a', text: 'My name is Sam.' },
        { id: 'b', text: 'Hello World', hardwareOnly: true },
      ],
    })
    expect(task().requireShiftForCapitals).toBeUndefined()
    expect(errorsOf(task())).toEqual([])
  })

  it('shows a browser-reserved shortcut error inline under its item', () => {
    const { task } = renderBuilderEditor(ui.BuilderEditor, changeKeyboardMode(start(), 'shortcuts'))
    fireEvent.change(screen.getByLabelText('Item 1 shortcut'), { target: { value: 'Ctrl+W' } })

    const row = screen.getByLabelText('Item 1 shortcut').closest('.te-act-row')
    expect(within(row).getByRole('alert')).toHaveTextContent(
      '"Ctrl+W" is kept by the browser, so students can\'t press it here.'
    )

    fireEvent.change(screen.getByLabelText('Item 1 shortcut'), { target: { value: 'Ctrl+V' } })
    expect(within(row).queryByRole('alert')).toBeNull()
    expect(errorsOf(task())).toEqual([])
  })

  it('shows warnings (a shortcut with no prompt) without blocking', () => {
    renderBuilderEditor(ui.BuilderEditor, changeKeyboardMode(start(), 'shortcuts'))
    fireEvent.change(screen.getByLabelText('Item 1 prompt'), { target: { value: '' } })
    const row = screen.getByLabelText('Item 1 shortcut').closest('.te-act-row')
    expect(within(row).getByText(/add a prompt telling students/)).toBeInTheDocument()
    expect(within(row).queryByRole('alert')).toBeNull()
  })

  it('edits find_key and symbols items', () => {
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())
    fireEvent.change(screen.getByLabelText('Keyboard mode'), { target: { value: 'symbols' } })
    fireEvent.change(screen.getByLabelText('Item 1 symbol'), { target: { value: '£' } })
    expect(task().items[0]).toMatchObject({ id: 'a', char: '£' })
    expect(errorsOf(task())).toEqual([])

    fireEvent.change(screen.getByLabelText('Keyboard mode'), { target: { value: 'find_key' } })
    fireEvent.change(screen.getByLabelText('Item 1 key'), { target: { value: 'Backspace' } })
    expect(task().items[0]).toMatchObject({ id: 'a', key: 'Backspace' })
    expect(errorsOf(task())).toEqual([])
  })
})

describe('Keyboard BuilderEditor: edit_text', () => {
  it('edits start, target, required keys and the editing options', async () => {
    const user = userEvent.setup()
    const { task } = renderBuilderEditor(ui.BuilderEditor, changeKeyboardMode(start(), 'edit_text'))
    fireEvent.change(screen.getByLabelText('Item 1 start'), { target: { value: 'teh cat' } })
    fireEvent.change(screen.getByLabelText('Item 1 target'), { target: { value: 'the cat' } })
    const keys = screen.getByRole('group', { name: 'Item 1 keys to use' })
    await user.click(within(keys).getByLabelText('Delete'))
    await user.click(within(keys).getByLabelText('Shift selection'))
    await user.click(screen.getByLabelText('Show the fixed line to students'))
    fireEvent.change(screen.getByLabelText('Share of original characters to keep'), {
      target: { value: '0.8' },
    })
    expect(task()).toMatchObject({
      mode: 'edit_text',
      showTarget: false,
      minKept: 0.8,
      items: [{ id: 'a', start: 'teh cat', target: 'the cat', requireKeys: ['Delete', 'select'] }],
    })
    expect(errorsOf(task())).toEqual([])
    expect(changeKeyboardMode(task(), 'type_text')).not.toHaveProperty('minKept')
  })
})
