import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { KeyboardStudentView } from '../ui.jsx'
import keyboard from '../definition.js'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'

// A keyboard task is one round: no in-task navigation, items move on by themselves, marked as
// you go, with core reps then bonus reps.

const TASK = {
  id: 1,
  taskType: 'activity',
  activityType: 'keyboard',
  mode: 'find_key',
  layout: 'uk',
  items: [
    { id: 'a', key: 'q' },
    { id: 'b', key: 'w' },
    { id: 'c', key: 'e' },
  ],
}

const MOMENT = { timeout: 3000 }

function renderKeyboard(task, options = {}) {
  return renderActivityUi(KeyboardStudentView, {
    task,
    initialState: keyboard.initialState(task),
    ...options,
  })
}

const pressKey = (key, code) =>
  fireEvent.keyDown(screen.getByTestId('keyboard-practice'), { key, code })

describe('Keyboard UI: one round', () => {
  it('has no Check button and no in-task navigation, only a progress strip', () => {
    renderKeyboard(TASK)
    expect(screen.queryByRole('button', { name: 'Check my work' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Next|Previous|Step|Line|Block/ })).toBeNull()
    expect(screen.getByRole('progressbar', { name: 'Round progress' })).toBeInTheDocument()
    expect(screen.getByText('0 of 3 done')).toBeInTheDocument()
  })

  it('ticks the item, then moves to the next by itself', async () => {
    const { onSubmit } = renderKeyboard(TASK)
    expect(screen.getByText('Find and press the Q key')).toBeInTheDocument()
    pressKey('q', 'KeyQ')
    expect(screen.getByText('1 of 3 done')).toBeInTheDocument()
    // The done moment: still the finished item, with its tick.
    expect(screen.getByText('Find and press the Q key')).toBeInTheDocument()
    expect(await screen.findByText('Find and press the W key', {}, MOMENT)).toBeInTheDocument()
    // The view never submits: the host marks the task when the core is done.
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('ignores keys during the done moment', async () => {
    const { state } = renderKeyboard(TASK)
    pressKey('q', 'KeyQ')
    pressKey('w', 'KeyW')
    expect(state().items.b ?? {}).toEqual({})
    await screen.findByText('Find and press the W key', {}, MOMENT)
  })

  it('a wrong key is only a nudge: nothing is marked wrong or submitted', () => {
    const { onSubmit, state } = renderKeyboard(TASK)
    pressKey('x', 'KeyX')
    expect(screen.getByText('You pressed x.')).toBeInTheDocument()
    expect(state().items.a ?? {}).toEqual({})
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('passes at the core, then labels the rest as a bonus round', async () => {
    const task = { ...TASK, coreItems: 2 }
    const { state } = renderKeyboard(task)
    pressKey('q', 'KeyQ')
    await screen.findByText('Find and press the W key', {}, MOMENT)
    expect(screen.queryByText('Done! ⭐ Bonus round')).not.toBeInTheDocument()
    pressKey('w', 'KeyW')
    expect(keyboard.grade(task, state()).passed).toBe(true)
    expect(screen.getByText('Done! ⭐ Bonus round')).toBeInTheDocument()
    expect(await screen.findByText('Find and press the E key', {}, MOMENT)).toBeInTheDocument()
    expect(screen.getByText('Bonus')).toBeInTheDocument()
    expect(screen.getByText('2 of 2 done')).toBeInTheDocument()
  })

  it('finishes with a card; Play again clears the items and never submits', async () => {
    const task = { ...TASK, coreItems: 2 }
    const { state, onSubmit } = renderKeyboard(task, {
      initialState: keyboard.solutionState(task),
    })
    expect(screen.getByText('You did it! 3 done')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Play again' }))
    expect(state().items).toEqual({})
    expect(onSubmit).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByText('Find and press the Q key')).toBeInTheDocument())
  })

  it('shows a tutor every item through the tutor-only picker', () => {
    renderKeyboard(TASK, {
      readOnly: true,
      initialState: {
        v: 1,
        items: { a: { pressed: true, source: 'hardware' }, b: {}, c: {} },
      },
    })
    // Follows the student to the first item not done, and any item can be opened.
    expect(screen.getByText('Find and press the W key')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Item 1, done' }))
    expect(screen.getByText('Find and press the Q key')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Play again' })).not.toBeInTheDocument()
  })
})
