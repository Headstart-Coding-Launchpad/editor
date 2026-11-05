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
    // Marked as you go: the host auto-submits the change that passes; the view has no Check.
    expect(onSubmit).not.toHaveBeenCalled()
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

describe('Keyboard UI: showKey (request 133)', () => {
  const SYMBOLS = {
    ...TYPE,
    mode: 'symbols',
    showKey: true,
    items: [{ id: 'a', char: '(' }],
  }
  const lit = (picture) =>
    [...picture.querySelectorAll('.act-osk__key--highlight')].map((key) => key.dataset.code)

  it('Fun moment: the symbol is big and its key and both Shift keys glow before any press', () => {
    const { state } = renderKeyboard(SYMBOLS)
    expect(screen.getByTestId('keyboard-target-symbol')).toHaveTextContent('(')
    expect(screen.getByTestId('keyboard-target-keys')).toHaveTextContent('Shift + 9')
    const picture = screen.getByTestId('keyboard-picture')
    expect(lit(picture).sort()).toEqual(['Digit9', 'ShiftLeft', 'ShiftRight'])
    press(screen.getByTestId('keyboard-practice'), '(', { code: 'Digit9', shiftKey: true })
    expect(screen.getByText('Got it!')).toBeInTheDocument()
    expect(state().items.a).toMatchObject({ typedChar: '(', shift: true, tries: 1 })
  })

  it('without showKey nothing is lit until two misses (old lessons do not change)', () => {
    const { showKey: _omit, ...task } = SYMBOLS
    renderKeyboard(task)
    expect(screen.queryByTestId('keyboard-target-symbol')).toBeNull()
    const picture = screen.getByTestId('keyboard-picture')
    const area = screen.getByTestId('keyboard-practice')
    expect(lit(picture)).toEqual([])
    press(area, '8', { code: 'Digit8' })
    expect(screen.getByText('You typed 8.')).toBeInTheDocument()
    expect(lit(picture)).toEqual([])
    press(area, '7', { code: 'Digit7' })
    expect(lit(picture).sort()).toEqual(['Digit9', 'ShiftLeft', 'ShiftRight'])
  })

  it('says calmly to hold Shift when the right key is pressed without it', () => {
    renderKeyboard(SYMBOLS)
    const area = screen.getByTestId('keyboard-practice')
    press(area, '9', { code: 'Digit9' })
    expect(screen.getByText('Hold Shift, then press 9')).toBeInTheDocument()
    press(area, '8', { code: 'Digit8' })
    expect(screen.getByText('That was 8. Press the glowing keys.')).toBeInTheDocument()
    expect(screen.queryByText(/wrong|error|mistake/i)).toBeNull()
    // The glow stays on after a miss.
    const picture = screen.getByTestId('keyboard-picture')
    expect(lit(picture).sort()).toEqual(['Digit9', 'ShiftLeft', 'ShiftRight'])
  })

  it('saves the tries an item took once, when it finishes', () => {
    const { state } = renderKeyboard(SYMBOLS)
    const area = screen.getByTestId('keyboard-practice')
    press(area, '9', { code: 'Digit9' })
    press(area, '8', { code: 'Digit8' })
    expect(state().items.a).toEqual({})
    press(area, '(', { code: 'Digit9', shiftKey: true })
    expect(state().items.a).toEqual({ typedChar: '(', shift: true, source: 'hardware', tries: 3 })
    expect(keyboard.summarize(SYMBOLS, state()).text).toMatch(/\( took 3 tries/)
  })

  it('find_key lights the key from the start and shows its name big', () => {
    renderKeyboard({ ...TYPE, mode: 'find_key', showKey: true, items: [{ id: 'a', key: 'q' }] })
    expect(screen.getByTestId('keyboard-target-symbol')).toHaveTextContent('Q')
    expect(lit(screen.getByTestId('keyboard-picture'))).toEqual(['KeyQ'])
    press(screen.getByTestId('keyboard-practice'), 'w', { code: 'KeyW' })
    expect(screen.getByText('That was w. Press the glowing key.')).toBeInTheDocument()
  })

  it('the tutor read-only view shows the same big symbol and lit keys', () => {
    renderKeyboard(SYMBOLS, { readOnly: true })
    expect(screen.getByTestId('keyboard-target-symbol')).toHaveTextContent('(')
    expect(lit(screen.getByTestId('keyboard-picture')).sort()).toEqual([
      'Digit9',
      'ShiftLeft',
      'ShiftRight',
    ])
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

  it('counts Shift with a non-typing key, including Shift+Tab', async () => {
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
    // Shift+Tab is practised in a row of fields, and focus is left free to move back one. The
    // round moves on to it by itself after the first item's done moment.
    expect(
      await screen.findByTestId('keyboard-tab-fields', {}, { timeout: 3000 })
    ).toBeInTheDocument()
    const fields = screen.getAllByRole('textbox')
    expect(fields).toHaveLength(3)
    expect(document.activeElement).toBe(fields[2])
    const notCancelled = fireEvent.keyDown(fields[2], { key: 'Tab', code: 'Tab', shiftKey: true })
    expect(notCancelled).toBe(true)
    expect(state().items.b).toEqual({ performed: true, via: 'keyboard', source: 'hardware' })
  })

  it('catches the shortcut pressed outside the practice box, but not copy', async () => {
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
    // Ctrl+S anywhere on the page counts and never opens the browser's save dialog. Wait for the
    // round to move on to it after the first item's done moment.
    await screen.findByText('Save', {}, { timeout: 3000 })
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
