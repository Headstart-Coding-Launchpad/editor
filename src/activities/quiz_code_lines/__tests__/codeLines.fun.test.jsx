import React, { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ActivityView } from '../../ActivityHost.jsx'
import { getActivityUi } from '../../registry.js'
import definition from '../definition.js'

// Fun moment (marked-line quizzes, sketch OK'd by Ryan 24 Nov 2026): a child reads a five-line
// program, taps the line they think is wrong, and Check lights it up: the right line green, a wrong
// pick amber with one line saying why, and Try again. Two-line questions take both picks first.
// The host below behaves like useActivityState: a pick is an in-progress change (mirrored to the
// tutor as currentAnswer), Check is the final answer, graded by the definition.

const TASK = {
  id: 't2',
  title: 'Which line is wrong?',
  taskType: 'quiz',
  quizType: 'code_lines',
  explainer: 'This program should print `Hello, Ava!` but it crashes. Which line is wrong?',
  language: 'python',
  code: 'name = "Ava"\nprint("Hello, " + name)\nprint("Welcome" + 5)\nprint("Bye")\nprint("Done")',
  correctLines: [3],
  explanation: 'Line 3 tries to add a word and a number, and Python cannot.',
  lineFeedback: { 4: 'Line 4 is fine: it prints a word.' },
}

const TWO = {
  ...TASK,
  id: 't3',
  title: 'Which 2 lines are wrong?',
  code: 'name = "Ava"\nage = 10\nprint("Hello, " + name)\nprint("Age: " + age)\nprint("Bye"',
  correctLines: [4, 5],
  lineFeedback: {},
}

function Host({ task, sent = [] }) {
  const [state, setState] = useState('')
  const [result, setResult] = useState(null)
  return (
    <ActivityView
      task={task}
      state={state}
      result={result}
      onChange={(next) => {
        sent.push(next)
        setState(next)
      }}
      onSubmit={(next) => {
        sent.push(next)
        setState(next)
        setResult({ submitted: true, passed: definition.grade(task, next).passed })
      }}
    />
  )
}

const line = (n) => screen.getByRole('option', { name: new RegExp(`^Line ${n}:`) })
const check = () => screen.getByRole('button', { name: 'Check' })

describe('Click-the-line quiz: the fun moment', () => {
  it('shows numbered, tappable lines and keeps Check off until a line is picked', () => {
    render(<Host task={TASK} />)
    const list = screen.getByRole('listbox')
    expect(within(list).getAllByRole('option')).toHaveLength(5)
    expect(line(3)).toHaveAccessibleName('Line 3: print("Welcome" + 5)')
    expect(check()).toBeDisabled()
    expect(screen.getByText('Tap a line to pick it.')).toBeInTheDocument()
  })

  it('tapping a line picks it (outlined, "picked"), and tapping another moves the pick', async () => {
    const user = userEvent.setup()
    render(<Host task={TASK} />)
    await user.click(line(2))
    expect(line(2)).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('You picked line 2.')).toBeInTheDocument()
    await user.click(line(3))
    expect(line(2)).toHaveAttribute('aria-selected', 'false')
    expect(line(3)).toHaveAttribute('aria-selected', 'true')
    expect(within(line(3)).getByText(/picked/)).toBeInTheDocument()
    expect(check()).toBeEnabled()
  })

  it('a wrong pick goes amber, the right line goes green, one line says why, and Try again clears it', async () => {
    const user = userEvent.setup()
    render(<Host task={TASK} />)
    await user.click(line(4))
    await user.click(check())
    expect(line(4)).toHaveAttribute('data-verdict', 'wrong')
    expect(line(3)).toHaveAttribute('data-verdict', 'right')
    expect(within(line(4)).getByText('Your pick')).toBeInTheDocument()
    expect(within(line(3)).getByText(/This is the one/)).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Not quite. Line 4 is fine: it prints a word.'
    )
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(line(3)).not.toHaveAttribute('data-verdict')
    expect(line(4)).toHaveAttribute('aria-selected', 'false')
    expect(check()).toBeDisabled()
  })

  it('the right pick goes green with "Yes!" and the explanation, and the lines lock', async () => {
    const user = userEvent.setup()
    render(<Host task={TASK} />)
    await user.click(line(3))
    await user.click(check())
    expect(line(3)).toHaveAttribute('data-verdict', 'right')
    expect(screen.getByRole('status')).toHaveTextContent(
      'Yes! Line 3 tries to add a word and a number, and Python cannot.'
    )
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
    await user.click(line(1))
    expect(line(1)).toHaveAttribute('aria-selected', 'false')
  })

  it('a two-line question needs both picks before Check, and only both right passes', async () => {
    const user = userEvent.setup()
    render(<Host task={TWO} />)
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-multiselectable', 'true')
    await user.click(line(4))
    expect(screen.getByText('1 of 2 lines picked')).toBeInTheDocument()
    expect(check()).toBeDisabled()
    await user.click(line(5))
    expect(screen.getByText('2 of 2 lines picked')).toBeInTheDocument()
    await user.click(check())
    expect(line(4)).toHaveAttribute('data-verdict', 'right')
    expect(line(5)).toHaveAttribute('data-verdict', 'right')
    expect(screen.getByRole('status')).toHaveTextContent(/^Yes!/)
  })

  it('works from the keyboard: arrows move, Space or Enter picks, Check marks it', async () => {
    render(<Host task={TASK} />)
    line(1).focus()
    fireEvent.keyDown(line(1), { key: 'ArrowDown' })
    fireEvent.keyDown(line(2), { key: 'ArrowDown' })
    expect(line(3)).toHaveFocus()
    fireEvent.keyDown(line(3), { key: ' ' })
    expect(line(3)).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(line(3), { key: 'ArrowUp' })
    fireEvent.keyDown(line(2), { key: 'Enter' })
    expect(line(2)).toHaveAttribute('aria-selected', 'true')
    expect(line(3)).toHaveAttribute('aria-selected', 'false')
  })

  it('Home and End jump to the first and last line, and Tab lands on the row last focused', () => {
    render(<Host task={TASK} />)
    line(1).focus()
    fireEvent.keyDown(line(1), { key: 'End' })
    expect(line(5)).toHaveFocus()
    expect(line(5)).toHaveAttribute('tabindex', '0')
    expect(line(1)).toHaveAttribute('tabindex', '-1')
    fireEvent.keyDown(line(5), { key: 'Home' })
    expect(line(1)).toHaveFocus()
    fireEvent.keyDown(line(1), { key: 'ArrowDown' })
    expect(line(2)).toHaveAttribute('tabindex', '0')
  })

  it('every pick reaches the tutor as the answer payload ("3", or "[4,5]" for two lines)', async () => {
    const user = userEvent.setup()
    const sent = []
    const { unmount } = render(<Host task={TASK} sent={sent} />)
    await user.click(line(3))
    expect(sent).toEqual(['3'])
    unmount()
    const sentTwo = []
    render(<Host task={TWO} sent={sentTwo} />)
    await user.click(line(4))
    await user.click(line(5))
    expect(sentTwo.at(-1)).toBe('[4,5]')
  })
})

describe('Click-the-line quiz: what the tutor sees', () => {
  it("the tutor's live view shows the student's picked line before they press Check", () => {
    render(<ActivityView task={TASK} state="3" readOnly teacher result={null} />)
    expect(line(3)).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByRole('button', { name: 'Check' })).not.toBeInTheDocument()
  })

  it('the tutor sees the answer line marked and the pick as "not checked yet"', () => {
    render(<ActivityView task={TASK} state="4" readOnly teacher result={null} />)
    expect(line(3)).toHaveAttribute('data-answer')
    expect(within(line(3)).getByText('answer')).toBeInTheDocument()
    expect(line(4)).not.toHaveAttribute('data-verdict')
    expect(screen.getByRole('status')).toHaveTextContent('Picked line 4 (not checked yet)')
  })

  it('after Try again the host clears submitted, so a new pick is a draft on the tutor screen', () => {
    // A wrong Check of line 4, then Try again and line 2: useActivityState (retryClearsCheck)
    // clears the run status, so the mirrored result is no longer submitted.
    const { rerender } = render(
      <ActivityView
        task={TASK}
        state="4"
        readOnly
        teacher
        result={{ submitted: true, passed: false }}
      />
    )
    expect(line(4)).toHaveAttribute('data-verdict', 'wrong')
    rerender(<ActivityView task={TASK} state="2" readOnly teacher result={null} />)
    expect(line(2)).not.toHaveAttribute('data-verdict')
    expect(line(3)).not.toHaveAttribute('data-verdict')
    expect(screen.getByRole('status')).toHaveTextContent('Picked line 2 (not checked yet)')
  })

  it('the tutor view marks a checked answer right or wrong', () => {
    render(
      <ActivityView
        task={TASK}
        state="4"
        readOnly
        teacher
        result={{ submitted: true, passed: false }}
      />
    )
    expect(line(4)).toHaveAttribute('data-verdict', 'wrong')
    expect(line(3)).toHaveAttribute('data-verdict', 'right')
  })

  it('the student card names the picked line', () => {
    const { CardSummary } = getActivityUi('quiz_code_lines')
    const { rerender } = render(<CardSummary task={TASK} raw="3" state="3" />)
    expect(screen.getByText(/Line 3/)).toBeInTheDocument()
    rerender(<CardSummary task={TWO} raw="[4,5]" state="[4,5]" />)
    expect(screen.getByText(/Lines 4 and 5/)).toBeInTheDocument()
  })

  it('the Builder preview gets a pass or fail with the answer (QuizTask interface)', async () => {
    const { default: QuizTask } = await import('../../../app/components/QuizTask.jsx')
    const onSelectAnswer = vi.fn()
    render(<QuizTask task={TASK} showQuestion selectedAnswer="3" onSelectAnswer={onSelectAnswer} />)
    fireEvent.click(check())
    expect(onSelectAnswer).toHaveBeenCalledWith('3', true)
  })
})
