import { createEvent, fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { KeyboardStudentView } from '../ui.jsx'
import keyboard from '../definition.js'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'

const EDIT = {
  id: 1,
  taskType: 'activity',
  activityType: 'keyboard',
  mode: 'edit_text',
  layout: 'uk',
  items: [{ id: 'a', start: 'Ada  says', target: 'Ada says', requireKeys: ['Delete'] }],
}

function renderEdit(task = EDIT, options = {}) {
  return renderActivityUi(KeyboardStudentView, {
    task,
    initialState: keyboard.initialState(task),
    ...options,
  })
}

const press = (element, key, init = {}) => fireEvent.keyDown(element, { key, ...init })

describe('Keyboard UI: edit_text', () => {
  it('shows the target and the line to fix', () => {
    renderEdit()
    expect(screen.getByText('Fix the mistakes in this line')).toBeInTheDocument()
    expect(screen.getByText('Make it say:').parentElement).toHaveTextContent(
      'Make it say: Ada says'
    )
    expect(screen.getByTestId('keyboard-edit')).toHaveTextContent('Ada  says', {
      normalizeWhitespace: false,
    })
  })

  it('edits in place with the arrow keys and Delete, then marks the task', () => {
    const { state, onSubmit } = renderEdit()
    const box = screen.getByTestId('keyboard-edit')
    for (let i = 0; i < 6; i++) press(box, 'ArrowLeft', { code: 'ArrowLeft' })
    expect(state().items.a).toMatchObject({ caret: 3, done: false })
    press(box, 'Delete', { code: 'Delete' })
    expect(state().items.a).toMatchObject({
      text: 'Ada says',
      orig: '11111111',
      used: ['ArrowLeft', 'Delete'],
      source: 'hardware',
      done: true,
    })
    expect(keyboard.grade(EDIT, state()).passed).toBe(true)
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(screen.getByText('✓ Well done!')).toBeInTheDocument()
  })

  it('spots a retyped line and lets the student try again', () => {
    const { state } = renderEdit()
    const box = screen.getByTestId('keyboard-edit')
    press(box, 'a', { code: 'KeyA', ctrlKey: true })
    for (const char of 'Ada says') press(box, char)
    expect(state().items.a).toMatchObject({ text: 'Ada says', done: true })
    expect(
      screen.getByText(/You typed it all again. Try moving the cursor to the mistake/)
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(state().items.a).toEqual({})
    expect(screen.getByTestId('keyboard-edit')).toHaveTextContent('Ada  says', {
      normalizeWhitespace: false,
    })
  })

  it('clicking a letter puts the cursor before it', () => {
    const { state } = renderEdit()
    fireEvent.pointerDown(screen.getAllByText('s')[0])
    expect(state().items.a).toMatchObject({ caret: 5, text: 'Ada  says' })
  })

  it('blocks paste into the edit box', () => {
    renderEdit()
    const box = screen.getByTestId('keyboard-edit')
    const paste = createEvent.paste(box)
    fireEvent(box, paste)
    expect(paste.defaultPrevented).toBe(true)
  })

  it('can hide the target', () => {
    renderEdit({ ...EDIT, showTarget: false })
    expect(screen.queryByText('Make it say:')).toBeNull()
  })

  it('needs a real keyboard: no on-screen keyboard, a note instead', () => {
    renderEdit(EDIT, { device: { virtualKeyboard: true } })
    expect(screen.getByTestId('keyboard-needs-keyboard')).toBeInTheDocument()
    expect(screen.queryByTestId('on-screen-keyboard')).toBeNull()
    expect(screen.queryByTestId('keyboard-edit')).toBeNull()
  })

  it('read-only (teacher) view shows the line without a cursor or buttons', () => {
    const state = { v: 1, items: { a: { text: 'Ada says', orig: '11111111', done: true } } }
    const { container } = renderEdit(EDIT, { readOnly: true, initialState: state })
    expect(screen.getByTestId('keyboard-edit')).toHaveTextContent('Ada says')
    expect(container.querySelector('.act-caret')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Check my work' })).toBeNull()
  })
})
