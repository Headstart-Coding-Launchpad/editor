import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import NameTagPanel from '../NameTagPanel.jsx'
import TaskVariablesPanel from '../TaskVariablesPanel.jsx'
import { compactVariablesForSync } from '../variablesPanel.js'

const int = (v) => ({ t: 'int', v })
const marker = { mode: 'view', at: 'marker', hide: [], predict: [], target: {} }
const predictMarker = { ...marker, mode: 'predict', predict: ['coins'] }
const runOf = (extra = {}) => ({
  taskId: 74,
  status: 'success',
  at: 'marker',
  snapshots: [{ vars: [{ n: 'coins', v: int(15) }], scope: null }],
  index: 0,
  changed: [],
  peekReached: true,
  ...extra,
})

const TASK = {
  id: 74,
  showVariables: { mode: 'predict', at: 'marker', predict: ['coins'] },
  codeStages: [{ role: 'starter', code: 'coins = 10\ncoins = coins + 5\ncoins = coins * 2\n' }],
  peekSets: [
    {
      source: 'starter',
      stageIndex: 0,
      file: null,
      peek: { line: 3, target: 'coins = coins * 2' },
    },
  ],
}
const CODE = TASK.codeStages[0].code

describe('NameTagPanel peek header', () => {
  it('says which line the values are shown before, even on empty predict tags', () => {
    render(<NameTagPanel config={predictMarker} peekLine={6} />)
    expect(screen.getByTestId('ntp-peek-line').textContent).toBe('⏸Values just before line 6')
    expect(screen.getByLabelText('coins')).toBeTruthy()
  })

  it('shows in view mode after a run that reached the line', () => {
    render(<NameTagPanel config={marker} peekLine={3} run={runOf()} />)
    expect(screen.getByTestId('ntp-peek-line').textContent).toContain('Values just before line 3')
  })

  it('says the line never ran after a run that missed it, keeping the status note', () => {
    render(<NameTagPanel config={marker} peekLine={3} run={runOf({ peekReached: false })} />)
    expect(screen.getByTestId('ntp-peek-line').textContent).toContain('Line 3 never ran')
    expect(screen.getByRole('status').textContent).toContain('never reached the marked line')
  })

  it('is absent with at: end or without a line', () => {
    const { rerender } = render(<NameTagPanel config={{ ...marker, at: 'end' }} peekLine={3} />)
    expect(screen.queryByTestId('ntp-peek-line')).toBeNull()
    rerender(<NameTagPanel config={marker} peekLine={null} />)
    expect(screen.queryByTestId('ntp-peek-line')).toBeNull()
  })
})

describe('TaskVariablesPanel peek header', () => {
  it("works the line out from the student's code", () => {
    render(<TaskVariablesPanel task={TASK} code={`# mine\n${CODE}`} panel={null} />)
    expect(screen.getByTestId('ntp-peek-line').textContent).toContain('Values just before line 4')
  })

  it("shows on a tutor's synced copy", () => {
    const synced = compactVariablesForSync(runOf({ peekReached: false }))
    render(<TaskVariablesPanel task={TASK} code={CODE} synced={synced} audience="tutor" />)
    expect(screen.getByTestId('ntp-peek-line').textContent).toContain('Line 3 never ran')
  })

  it('has no header when the code is not given', () => {
    render(<TaskVariablesPanel task={TASK} panel={null} />)
    expect(screen.queryByTestId('ntp-peek-line')).toBeNull()
  })
})
