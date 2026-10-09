import React, { useState } from 'react'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import BadgeSuggestionsPanel from '../BadgeSuggestionsPanel'

const STUDENTS = [
  { anonymousId: 's1', displayName: 'Alex' },
  { anonymousId: 's2', displayName: 'Sam' },
]

const SUGGESTIONS = [
  {
    badgeId: 'bug_hunter',
    studentId: 's2',
    taskId: 't3',
    reason: 'First to fix the bug in “Task 3”',
    context: 'task',
    at: 100,
  },
  {
    badgeId: 'keyboard_wizard',
    studentId: 's1',
    taskId: 't1',
    reason: 'Used Ctrl+Enter',
    context: 'task',
    at: 50,
  },
  {
    badgeId: 'keyboard_wizard',
    studentId: 's2',
    taskId: 't1',
    reason: 'Used Tab',
    context: 'task',
    at: 60,
  },
]

function Harness({ initialOpen = true, ...props }) {
  const [open, setOpen] = useState(initialOpen)
  return (
    <BadgeSuggestionsPanel
      suggestions={SUGGESTIONS}
      students={STUDENTS}
      settings={null}
      onDecideBadge={vi.fn(async () => ({ committed: true }))}
      onSetBadgeSettings={vi.fn(async () => {})}
      open={open}
      onOpenChange={setOpen}
      {...props}
    />
  )
}

describe('BadgeSuggestionsPanel', () => {
  it('shows the pending count in the header and toggles open', async () => {
    const user = userEvent.setup()
    render(<Harness initialOpen={false} />)
    const header = screen.getByRole('button', { name: /Badge suggestions/ })
    expect(header).toHaveTextContent('3 pending')
    expect(header).toHaveAttribute('aria-expanded', 'false')
    await user.click(header)
    expect(header).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Auto-award high-confidence badges')).toBeInTheDocument()
  })

  it('groups suggestions by student in roster order', () => {
    render(<Harness />)
    const names = screen.getAllByText(/^(Alex|Sam)$/).map((el) => el.textContent)
    expect(names).toEqual(['Alex', 'Sam'])
    const samRow = screen.getByTestId('badge-suggestion-s2:bug_hunter')
    expect(samRow).toHaveTextContent('🐛')
    expect(samRow).toHaveTextContent('Bug Hunter')
    expect(samRow).toHaveTextContent('First to fix the bug in “Task 3”')
    expect(within(samRow).getByRole('checkbox')).toBeChecked()
  })

  it('Award writes a rule-sourced decision with the announce flag', async () => {
    const user = userEvent.setup()
    const onDecideBadge = vi.fn(async () => ({ committed: true }))
    render(<Harness onDecideBadge={onDecideBadge} />)
    const row = screen.getByTestId('badge-suggestion-s2:bug_hunter')
    await user.click(within(row).getByRole('checkbox'))
    await user.click(within(row).getByRole('button', { name: 'Award Bug Hunter to Sam' }))
    expect(onDecideBadge).toHaveBeenCalledWith('s2', 'bug_hunter', {
      status: 'awarded',
      source: 'rule',
      reason: 'First to fix the bug in “Task 3”',
      taskId: 't3',
      announce: false,
      bulkId: null,
    })
    await waitFor(() =>
      expect(screen.queryByTestId('badge-suggestion-s2:bug_hunter')).not.toBeInTheDocument()
    )
    expect(screen.getByRole('button', { name: /Badge suggestions/ })).toHaveTextContent('2 pending')
  })

  it('Dismiss writes a dismissed decision', async () => {
    const user = userEvent.setup()
    const onDecideBadge = vi.fn(async () => ({ committed: true }))
    render(<Harness onDecideBadge={onDecideBadge} />)
    await user.click(screen.getByRole('button', { name: 'Dismiss Bug Hunter for Sam' }))
    expect(onDecideBadge).toHaveBeenCalledWith(
      's2',
      'bug_hunter',
      expect.objectContaining({ status: 'dismissed', source: 'rule', taskId: 't3' })
    )
  })

  it('Award all gives every student the same bulkId', async () => {
    const user = userEvent.setup()
    const onDecideBadge = vi.fn(async () => ({ committed: true }))
    render(<Harness onDecideBadge={onDecideBadge} />)
    await user.click(screen.getByRole('button', { name: 'Award all (2)' }))
    expect(onDecideBadge).toHaveBeenCalledTimes(2)
    const [first, second] = onDecideBadge.mock.calls
    expect(first[0]).toBe('s1')
    expect(second[0]).toBe('s2')
    expect(first[2].bulkId).toMatch(/^bulk-keyboard_wizard-/)
    expect(second[2].bulkId).toBe(first[2].bulkId)
    expect(first[2]).toMatchObject({ status: 'awarded', source: 'rule', announce: true })
    expect(first[2].reason).toBe('Used Ctrl+Enter')
    expect(second[2].reason).toBe('Used Tab')
  })

  it('explains a decision another tab made first, without an error', async () => {
    const user = userEvent.setup()
    const onDecideBadge = vi.fn(async () => ({
      committed: false,
      decision: { status: 'dismissed' },
    }))
    render(<Harness onDecideBadge={onDecideBadge} />)
    await user.click(screen.getByRole('button', { name: 'Award Bug Hunter to Sam' }))
    expect(await screen.findByRole('status')).toHaveTextContent(
      "Sam's Bug Hunter was already decided in another tab."
    )
    expect(screen.queryByTestId('badge-suggestion-s2:bug_hunter')).not.toBeInTheDocument()
  })

  it('keeps the row and reports a failed write', async () => {
    const user = userEvent.setup()
    const onDecideBadge = vi.fn(async () => {
      throw new Error('PERMISSION_DENIED')
    })
    render(<Harness onDecideBadge={onDecideBadge} />)
    await user.click(screen.getByRole('button', { name: 'Award Bug Hunter to Sam' }))
    expect(await screen.findByText(/Couldn't save that decision/)).toBeInTheDocument()
    expect(screen.getByTestId('badge-suggestion-s2:bug_hunter')).toBeInTheDocument()
  })

  it('auto-award and sounds off write badgeSettings', async () => {
    const user = userEvent.setup()
    const onSetBadgeSettings = vi.fn(async () => {})
    render(<Harness onSetBadgeSettings={onSetBadgeSettings} settings={{ soundsOff: true }} />)
    await user.click(screen.getByLabelText('Auto-award high-confidence badges'))
    expect(onSetBadgeSettings).toHaveBeenCalledWith({ autoAward: true })
    const sounds = screen.getByLabelText('Sounds off')
    expect(sounds).toBeChecked()
    await user.click(sounds)
    expect(onSetBadgeSettings).toHaveBeenCalledWith({ soundsOff: false })
  })

  it('shows an empty state with no suggestions', () => {
    render(<Harness suggestions={[]} />)
    expect(screen.getByText(/No suggestions right now/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Badge suggestions/ })).toHaveTextContent(
      'None pending'
    )
  })

  it('opens and focuses the header on a focus request', () => {
    const { rerender } = render(<Harness initialOpen={false} focusRequest={0} />)
    rerender(<Harness initialOpen={false} focusRequest={1} />)
    const header = screen.getByRole('button', { name: /Badge suggestions/ })
    expect(header).toHaveAttribute('aria-expanded', 'true')
    expect(header).toHaveFocus()
  })
})

describe('BadgeSuggestionsPanel task names', () => {
  const titled = [
    {
      badgeId: 'bug_hunter',
      studentId: 's2',
      taskId: 't3',
      taskTitle: 'Fix the loop',
      reason: 'First to fix the bug in “Fix the loop”',
      context: 'task',
      at: 100,
    },
    {
      badgeId: 'quiz_master',
      studentId: 's2',
      taskId: 'q3',
      taskTitle: 'Match the words',
      reason: 'End Quiz: 3 of 3 right first time',
      context: 'task',
      at: 110,
    },
    {
      badgeId: 'code_fixer',
      studentId: 's1',
      taskId: null,
      taskTitle: null,
      reason: 'Fixed an error',
      context: 'sandbox',
      at: 120,
    },
    {
      badgeId: 'early_bird',
      studentId: 's1',
      taskId: null,
      taskTitle: null,
      reason: 'Joined 6 minutes before the start',
      context: 'task',
      at: 5,
    },
  ]

  it('names the task on every row, without repeating one the reason already quotes', () => {
    render(<Harness suggestions={titled} />)
    const taskOf = (key) =>
      within(screen.getByTestId(`badge-suggestion-${key}`))
        .queryAllByTestId('badge-suggestion-task')
        .map((el) => el.textContent)
    expect(taskOf('s2:quiz_master')).toEqual(['Match the words'])
    expect(taskOf('s2:bug_hunter')).toEqual([])
    expect(screen.getByTestId('badge-suggestion-s2:bug_hunter')).toHaveTextContent('Fix the loop')
    expect(taskOf('s1:code_fixer')).toEqual(['Sandbox'])
    expect(taskOf('s1:early_bird')).toEqual(['No task'])
  })

  it('an Award all row shows each student’s task when the tasks differ', () => {
    const list = [
      {
        badgeId: 'keyboard_wizard',
        studentId: 's1',
        taskId: 't1',
        taskTitle: 'Say hello',
        reason: 'Used Ctrl+Enter',
        context: 'task',
        at: 50,
      },
      {
        badgeId: 'keyboard_wizard',
        studentId: 's2',
        taskId: null,
        taskTitle: null,
        reason: 'Used Tab',
        context: 'personal',
        at: 60,
      },
    ]
    render(<Harness suggestions={list} />)
    const bulk = screen.getByRole('button', { name: 'Award all (2)' }).parentElement
    expect(bulk).toHaveTextContent('Alex (Say hello), Sam (Sandbox)')
  })

  it('an Award all row on one task names it once', () => {
    const list = ['s1', 's2'].map((studentId, i) => ({
      badgeId: 'keyboard_wizard',
      studentId,
      taskId: 't1',
      taskTitle: 'Say hello',
      reason: 'Used Tab',
      context: 'task',
      at: 50 + i,
    }))
    render(<Harness suggestions={list} />)
    const bulk = screen.getByRole('button', { name: 'Award all (2)' }).parentElement
    expect(within(bulk).getAllByTestId('badge-suggestion-task')).toHaveLength(1)
    expect(bulk).toHaveTextContent('Say helloAlex, Sam')
  })
})
