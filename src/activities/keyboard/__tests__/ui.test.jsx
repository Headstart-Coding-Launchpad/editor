import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { KeyboardStudentView } from '../ui.jsx'
import keyboard from '../definition.js'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'

function renderKeyboard(task, options = {}) {
  return renderActivityUi(KeyboardStudentView, {
    task,
    initialState: keyboard.initialState(task),
    ...options,
  })
}

const TYPE = {
  id: 1,
  taskType: 'activity',
  activityType: 'keyboard',
  mode: 'type_text',
  layout: 'uk',
  requireShiftForCapitals: true,
  items: [{ id: 'a', text: 'Hi' }],
}

function press(element, key, init = {}) {
  fireEvent.keyDown(element, { key, ...init })
}

describe('Keyboard UI: type_text', () => {
  it('records typed text, accuracy and Shift capitals, then marks the task', () => {
    const { state, onSubmit } = renderKeyboard(TYPE)
    const area = screen.getByTestId('keyboard-practice')
    press(area, 'Shift', { code: 'ShiftLeft', shiftKey: true })
    press(area, 'H', { code: 'KeyH', shiftKey: true })
    expect(state().items.a).toMatchObject({ typed: 'H', done: false })
    press(area, 'i', { code: 'KeyI' })
    expect(state().items.a).toMatchObject({
      typed: 'Hi',
      accuracy: 1,
      shiftCapitals: 1,
      capsLockCapitals: 0,
      source: 'hardware',
      done: true,
    })
    expect(keyboard.grade(TYPE, state()).passed).toBe(true)
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Well done!')).toBeInTheDocument()
  })

  it('handles Backspace and lets the student try a line again', () => {
    const { state } = renderKeyboard(TYPE)
    const area = screen.getByTestId('keyboard-practice')
    press(area, 'h', { code: 'KeyH' })
    press(area, 'Backspace', { code: 'Backspace' })
    expect(state().items.a.typed).toBe('')
    press(area, 'h', { code: 'KeyH' })
    press(area, 'i', { code: 'KeyI' })
    expect(screen.getByText(/Check your typing matches the line exactly/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(state().items.a).toEqual({})
  })

  it('types with the on-screen keyboard when there is no physical keyboard', () => {
    const { state } = renderKeyboard(TYPE, { device: { virtualKeyboard: true } })
    const osk = screen.getByTestId('on-screen-keyboard')
    fireEvent.click(within(osk).getAllByRole('button', { name: '⇧ Shift' })[0])
    fireEvent.click(within(osk).getByRole('button', { name: 'H' }))
    fireEvent.click(within(osk).getByRole('button', { name: 'i' }))
    expect(state().items.a).toMatchObject({
      typed: 'Hi',
      shiftCapitals: 1,
      source: 'virtual',
      done: true,
    })
  })
})

describe('Keyboard UI: find_key and symbols', () => {
  const FIND = { ...TYPE, mode: 'find_key', items: [{ id: 'a', key: 'q' }] }

  it('lights up the key on the keyboard picture after two misses', () => {
    const { state } = renderKeyboard(FIND)
    const area = screen.getByTestId('keyboard-practice')
    const picture = screen.getByTestId('keyboard-picture')
    press(area, 'w', { code: 'KeyW' })
    expect(screen.getByText('You pressed w.')).toBeInTheDocument()
    expect(picture.querySelector('.act-osk__key--highlight')).toBeNull()
    press(area, 'e', { code: 'KeyE' })
    expect(picture.querySelector('[data-code="KeyQ"]')).toHaveClass('act-osk__key--highlight')
    expect(screen.getByText(/Look for Q/)).toBeInTheDocument()
    press(area, 'q', { code: 'KeyQ' })
    expect(state().items.a).toEqual({ pressed: true, source: 'hardware' })
  })

  it('records Shift for a UK symbol', () => {
    const task = { ...TYPE, mode: 'symbols', items: [{ id: 'a', char: '£' }] }
    const { state } = renderKeyboard(task)
    const area = screen.getByTestId('keyboard-practice')
    press(area, '3', { code: 'Digit3' })
    press(area, '£', { code: 'Digit3', shiftKey: true })
    expect(state().items.a).toEqual({ typedChar: '£', shift: true, source: 'hardware' })
    expect(keyboard.grade(task, state()).passed).toBe(true)
  })
})

describe('Keyboard UI: shortcuts', () => {
  const SHORTCUT = {
    ...TYPE,
    mode: 'shortcuts',
    items: [{ id: 'a', combo: 'Ctrl+C', prompt: 'Copy the text' }],
  }

  it('counts the combo pressed in the practice box', () => {
    const { state } = renderKeyboard(SHORTCUT)
    const box = screen.getByRole('textbox', { name: /Practice box/ })
    press(box, 'x', { code: 'KeyX', ctrlKey: true })
    expect(screen.getByText('You pressed Ctrl + X.')).toBeInTheDocument()
    press(box, 'c', { code: 'KeyC', ctrlKey: true })
    expect(state().items.a).toEqual({ performed: true, via: 'keyboard', source: 'hardware' })
  })

  it("records a copy made without the keys as 'menu' and asks for the keys", () => {
    const { state } = renderKeyboard(SHORTCUT)
    fireEvent.copy(screen.getByRole('textbox', { name: /Practice box/ }))
    expect(state().items.a).toEqual({ performed: true, via: 'menu', source: 'hardware' })
    expect(screen.getByText(/Use the keys this time: Ctrl \+ C/)).toBeInTheDocument()
  })

  it('counts Shift with a non-typing key, including Shift+Tab', () => {
    const task = {
      ...SHORTCUT,
      items: [
        { id: 'a', combo: 'Shift+ArrowLeft', prompt: 'Select a letter' },
        { id: 'b', combo: 'Shift+Tab', prompt: 'Go back a field' },
      ],
    }
    const { state } = renderKeyboard(task)
    const box = screen.getByRole('textbox', { name: /Practice box/ })
    press(box, 'ArrowLeft', { code: 'ArrowLeft', shiftKey: true })
    expect(state().items.a).toEqual({ performed: true, via: 'keyboard', source: 'hardware' })
    // Shift+Tab is practised in a row of fields, and focus is left free to move back one.
    const fields = screen.getAllByRole('textbox')
    expect(screen.getByTestId('keyboard-tab-fields')).toBeInTheDocument()
    expect(fields).toHaveLength(3)
    expect(document.activeElement).toBe(fields[2])
    const notCancelled = fireEvent.keyDown(fields[2], { key: 'Tab', code: 'Tab', shiftKey: true })
    expect(notCancelled).toBe(true)
    expect(state().items.b).toEqual({ performed: true, via: 'keyboard', source: 'hardware' })
  })

  it('catches the shortcut pressed outside the practice box, but not copy', () => {
    const task = {
      ...SHORTCUT,
      items: [
        { id: 'a', combo: 'Ctrl+C', prompt: 'Copy' },
        { id: 'b', combo: 'Ctrl+S', prompt: 'Save' },
      ],
    }
    const { state } = renderKeyboard(task)
    // Copy acts on text, so outside the box it is left to the browser and not counted.
    const copyOutside = fireEvent.keyDown(document.body, { key: 'c', code: 'KeyC', ctrlKey: true })
    expect(copyOutside).toBe(true)
    expect(state().items.a ?? {}).not.toHaveProperty('performed')
    press(screen.getByRole('textbox', { name: /Practice box/ }), 'c', {
      code: 'KeyC',
      ctrlKey: true,
    })
    // Ctrl+S anywhere on the page counts and never opens the browser's save dialog.
    const saveOutside = fireEvent.keyDown(document.body, { key: 's', code: 'KeyS', ctrlKey: true })
    expect(saveOutside).toBe(false)
    expect(state().items.b).toEqual({ performed: true, via: 'keyboard', source: 'hardware' })
  })

  it('stops the browser acting on a non-text shortcut', () => {
    const task = { ...SHORTCUT, items: [{ id: 'a', combo: 'Ctrl+S', prompt: 'Save' }] }
    renderKeyboard(task)
    const box = screen.getByRole('textbox', { name: /Practice box/ })
    const notCancelled = fireEvent.keyDown(box, { key: 's', code: 'KeyS', ctrlKey: true })
    expect(notCancelled).toBe(false)
  })
})

describe('Keyboard UI: read-only teacher view', () => {
  it('shows the typed overlay without accepting input', () => {
    renderKeyboard(TYPE, {
      readOnly: true,
      initialState: { v: 1, items: { a: { typed: 'Hx', accuracy: 0.5, done: true } } },
    })
    expect(screen.getByLabelText('Type: Hi')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Check my work' })).not.toBeInTheDocument()
    expect(document.querySelector('.act-char--bad')).toHaveTextContent('i')
  })
})
