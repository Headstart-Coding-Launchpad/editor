import { fireEvent, screen } from '@testing-library/react'
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

const CODE = {
  id: 1,
  taskType: 'activity',
  activityType: 'keyboard',
  mode: 'type_code',
  language: 'python',
  items: [{ id: 'a', code: 'if x:\n    y()\n' }],
}

function press(element, key, init = {}) {
  fireEvent.keyDown(element, { key, ...init })
}

function typeText(element, text) {
  for (const char of text) press(element, char === '\n' ? 'Enter' : char)
}

describe('Keyboard UI: type_code', () => {
  it('types a block with Enter and Tab, records the typing result and marks the task', () => {
    const { state, onSubmit } = renderKeyboard(CODE)
    const area = screen.getByTestId('keyboard-type-code')
    typeText(area, 'if x:\n')
    press(area, 'Tab')
    expect(state().items.a).toMatchObject({ mode: 'type_code', typed: 'if x:\n    ', done: false })
    typeText(area, 'y()')
    expect(state().items.a).toMatchObject({
      mode: 'type_code',
      typed: 'if x:\n    y()',
      accuracy: 1,
      corrections: 0,
      source: 'hardware',
      done: true,
    })
    expect(state().items.a).toHaveProperty('cpm')
    expect(state().items.a).toHaveProperty('wpm')
    expect(state().items.a).toHaveProperty('timeMs')
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Well done!')).toBeInTheDocument()
  })

  it('marks wrong characters and counts Backspace as a correction', () => {
    const { state } = renderKeyboard(CODE)
    const area = screen.getByTestId('keyboard-type-code')
    typeText(area, 'iff')
    expect(area.querySelectorAll('[data-mark="bad"]')).toHaveLength(1)
    press(area, 'Backspace')
    expect(state().items.a).toMatchObject({ typed: 'if', corrections: 1 })
    expect(screen.getByTestId('type-code-stats')).toHaveTextContent('Corrections 1')
  })

  it('shows indentation and line ends as visible marks', () => {
    renderKeyboard(CODE)
    const block = screen.getByTestId('type-code-block')
    expect(block.textContent).toContain('↵')
    expect(block.textContent).toContain('····y()')
  })

  it('needs a real keyboard: the on-screen keyboard is not offered', () => {
    renderKeyboard(CODE, { device: { virtualKeyboard: true } })
    expect(screen.getByTestId('keyboard-needs-keyboard')).toBeInTheDocument()
    expect(screen.queryByTestId('on-screen-keyboard')).toBeNull()
  })

  it('shows the student result read-only for the teacher', () => {
    const state = {
      v: 1,
      items: { a: { mode: 'type_code', typed: 'if x:', accuracy: 1, cpm: 40, done: false } },
    }
    renderActivityUi(KeyboardStudentView, { task: CODE, initialState: state, readOnly: true })
    expect(screen.getByTestId('type-code-stats')).toHaveTextContent('40 characters a minute')
    expect(screen.queryByRole('button', { name: 'Check my work' })).toBeNull()
  })
})

const FALLING = {
  id: 2,
  taskType: 'activity',
  activityType: 'keyboard',
  mode: 'falling_words',
  durationSeconds: 30,
  words: ['print(', '</p>'],
}

describe('Keyboard UI: falling_words', () => {
  it('starts a round and writes a not-done result', () => {
    const { state } = renderKeyboard(FALLING)
    fireEvent.click(screen.getByTestId('falling-start'))
    expect(screen.getByTestId('falling-area')).toBeInTheDocument()
    expect(state().items.round).toMatchObject({
      mode: 'falling_words',
      cleared: 0,
      missed: 0,
      done: false,
    })
  })

  it('shows the typed buffer', () => {
    renderKeyboard(FALLING)
    fireEvent.click(screen.getByTestId('falling-start'))
    const area = screen.getByTestId('falling-area')
    press(area, 'q')
    expect(screen.getByTestId('falling-buffer')).toHaveTextContent('q')
  })

  it('needs a real keyboard', () => {
    renderKeyboard(FALLING, { device: { virtualKeyboard: true } })
    expect(screen.getByTestId('keyboard-needs-keyboard')).toBeInTheDocument()
  })

  it('shows the round result read-only for the teacher', () => {
    const state = {
      v: 1,
      items: { round: { mode: 'falling_words', cleared: 7, missed: 2, score: 80, done: true } },
    }
    renderActivityUi(KeyboardStudentView, { task: FALLING, initialState: state, readOnly: true })
    expect(screen.getByTestId('falling-stats')).toHaveTextContent('Cleared 7')
    expect(screen.queryByTestId('falling-start')).toBeNull()
  })
})
