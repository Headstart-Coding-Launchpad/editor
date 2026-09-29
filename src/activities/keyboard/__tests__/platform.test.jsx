import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { KeyboardStudentView } from '../ui.jsx'
import OnScreenKeyboard from '../OnScreenKeyboard.jsx'
import keyboard from '../definition.js'
import { describeItem, gradeKeyboardItem } from '../keyboard.js'
import { applyEditKey, gradeEditItem } from '../editText.js'
import { describeActivityDevice } from '../../device.js'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'

const FIND = (key) => ({
  id: 1,
  taskType: 'activity',
  activityType: 'keyboard',
  mode: 'find_key',
  layout: 'uk',
  items: [{ id: 'a', key }],
})

describe('Keyboard on Mac and Chromebook', () => {
  it('names keys in hints and prompts as the student keyboard does', () => {
    expect(describeItem(FIND('Delete'), { key: 'Delete' }, 'mac')).toBe('fn + delete')
    expect(describeItem(FIND('Delete'), { key: 'Delete' }, 'chromeos')).toBe('Alt + Backspace')
    expect(describeItem({ mode: 'shortcuts' }, { combo: 'ctrl+c' }, 'mac')).toBe('Cmd + C')
    expect(describeItem({ mode: 'shortcuts' }, { combo: 'ctrl+c' }, 'chromeos')).toBe('Ctrl + C')
    const hint = gradeKeyboardItem(FIND('Backspace'), { key: 'Backspace' }, {}, { platform: 'mac' })
    expect(hint.hint).toBe('Look for the delete key.')
    const caps = gradeKeyboardItem(
      { mode: 'type_text', requireShiftForCapitals: true },
      { text: 'Hi' },
      { typed: 'Hi', accuracy: 1, capsLockCapitals: 1 },
      { platform: 'chromeos' }
    )
    expect(caps.hint).toBe(
      'Try holding Shift for capital letters instead of Caps Lock (Alt + Search).'
    )
  })

  it('edit_text hints name Delete and Backspace per platform', () => {
    const item = { start: 'Ada  says', target: 'Ada says', requireKeys: ['Delete'] }
    const done = { text: 'Ada says', orig: '11111111', used: ['Backspace'] }
    expect(gradeEditItem({}, item, done, 'mac').hint).toBe(
      'Put the cursor just before the extra letter and press fn + delete. Delete deletes to the left, fn + delete deletes to the right.'
    )
    expect(gradeEditItem({}, item, done, 'chromeos').hint).toMatch(/press Alt \+ Backspace\./)
  })

  it('edit_text: Cmd + ←/→ jumps to the start/end of the line (a Mac Home/End)', () => {
    const model = { text: 'abc', orig: '111', caret: 1, anchor: null }
    const home = applyEditKey(model, { key: 'ArrowLeft', mods: { meta: true, mod: true } })
    expect(home).toMatchObject({ model: { caret: 0 }, used: 'Home' })
    const selectEnd = applyEditKey(model, {
      key: 'ArrowRight',
      mods: { meta: true, mod: true, shift: true },
    })
    expect(selectEnd).toMatchObject({ model: { caret: 3, anchor: 1 }, used: 'select' })
  })

  it('records the platform and uses the student names, also in the teacher view', () => {
    const task = FIND('Backspace')
    const { state } = renderActivityUi(KeyboardStudentView, {
      task,
      initialState: keyboard.initialState(task),
      device: { platform: 'mac' },
    })
    expect(screen.getByText('Find and press the delete key')).toBeInTheDocument()
    fireEvent.keyDown(screen.getByTestId('keyboard-practice'), { key: 'Backspace' })
    expect(state()).toMatchObject({ device: { platform: 'mac' }, items: { a: { pressed: true } } })
  })

  it('the teacher read-only view names keys for the student platform', () => {
    const task = FIND('Delete')
    renderActivityUi(KeyboardStudentView, {
      task,
      readOnly: true,
      initialState: { v: 1, device: { platform: 'chromeos' }, items: { a: {} } },
      device: { platform: 'windows' },
    })
    expect(screen.getByText('Find and press the Alt + Backspace key')).toBeInTheDocument()
  })

  it('counts a Caps Lock keyup (a Mac turning Caps Lock off sends no keydown)', () => {
    const task = FIND('CapsLock')
    const { state } = renderActivityUi(KeyboardStudentView, {
      task,
      initialState: keyboard.initialState(task),
    })
    fireEvent.keyUp(screen.getByTestId('keyboard-practice'), { key: 'CapsLock' })
    expect(state().items.a).toMatchObject({ pressed: true })
  })

  it('the keyboard picture uses Mac key labels; the on-screen keyboard keeps its own', () => {
    const { unmount } = render(<OnScreenKeyboard platform="mac" />)
    const picture = screen.getByTestId('keyboard-picture')
    expect(within(picture).getByText('⌫ delete')).toBeInTheDocument()
    expect(within(picture).getByText('return ↵')).toBeInTheDocument()
    unmount()
    render(<OnScreenKeyboard platform="mac" interactive onKey={() => {}} />)
    expect(within(screen.getByTestId('on-screen-keyboard')).getByText('⌫ Backspace')).toBeTruthy()
  })

  it('the teacher device badge shows a Mac or Chromebook', () => {
    expect(describeActivityDevice({ device: { platform: 'mac' } })).toMatchObject({ label: 'Mac' })
    expect(describeActivityDevice({ device: { platform: 'chromeos' } })).toMatchObject({
      label: 'Chromebook',
    })
    expect(describeActivityDevice({ device: { platform: 'windows' } })).toBeNull()
    expect(describeActivityDevice({ device: { platform: 'mac', touch: true } })).toMatchObject({
      label: 'Touch screen',
    })
  })
})
