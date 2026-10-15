import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { KeyboardStudentView } from '../ui.jsx'
import keyboard from '../definition.js'

const TASK = {
  id: 1,
  taskType: 'activity',
  activityType: 'keyboard',
  mode: 'type_code',
  language: 'python',
  showHistory: true,
  items: [{ id: 'a', code: 'print("Ready")' }],
}

const HISTORY = {
  byMode: {
    type_code: {
      last: { cpm: 62, accuracy: 0.91, date: 3 },
      best: { cpm: 75, accuracy: 0.9, date: 2 },
      first: { cpm: 40, accuracy: 0.8, date: 1 },
      sessions: 3,
    },
  },
}

function renderView(task, state, history) {
  return render(
    <KeyboardStudentView
      task={task}
      state={state ?? keyboard.initialState(task)}
      onChange={() => {}}
      onSubmit={() => {}}
      history={history}
    />
  )
}

describe('Keyboard showHistory', () => {
  it('shows the last and best score beside the item', () => {
    renderView(TASK, null, HISTORY)
    expect(screen.getByTestId('keyboard-history')).toHaveTextContent(
      'Last time: 62 cpm, 91% · Best: 75 cpm'
    )
    expect(screen.queryByTestId('keyboard-history-trend')).toBeNull()
  })

  it('celebrates the progress once the item is finished', () => {
    const state = {
      v: 1,
      items: {
        a: {
          mode: 'type_code',
          typed: 'print("Ready")',
          accuracy: 1,
          cpm: 70,
          wpm: 14,
          corrections: 0,
          timeMs: 12000,
          done: true,
        },
      },
    }
    renderView(TASK, state, HISTORY)
    expect(screen.getByTestId('keyboard-history-trend')).toHaveTextContent(
      'You went from 40 to 70 characters a minute.'
    )
  })

  it('shows nothing without history or without showHistory', () => {
    const { unmount } = renderView(TASK, null, null)
    expect(screen.queryByTestId('keyboard-history')).toBeNull()
    unmount()
    renderView({ ...TASK, showHistory: undefined }, null, HISTORY)
    expect(screen.queryByTestId('keyboard-history')).toBeNull()
  })
})
