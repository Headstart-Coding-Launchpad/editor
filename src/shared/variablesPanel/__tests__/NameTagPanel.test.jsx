import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import NameTagPanel from '../NameTagPanel.jsx'
import TaskVariablesPanel from '../TaskVariablesPanel.jsx'
import { compactVariablesForSync } from '../variablesPanel.js'

const int = (v) => ({ t: 'int', v })
const str = (v) => ({ t: 'str', v })
const runOf = (entries, extra = {}) => ({
  taskId: 1,
  status: 'success',
  at: 'end',
  snapshots: [{ vars: entries.map(([n, v]) => ({ n, v })), scope: null }],
  index: 0,
  changed: [],
  ...extra,
})
const view = { mode: 'view', at: 'end', hide: [], predict: [], target: {} }

describe('NameTagPanel', () => {
  it('asks for a Run before there is anything to show', () => {
    render(<NameTagPanel config={view} />)
    expect(screen.getByRole('status').textContent).toContain('Press Run')
  })

  it('draws a tag per variable with type labels and screen-reader text', () => {
    render(
      <NameTagPanel
        config={view}
        run={runOf(
          [
            ['score', int(10)],
            ['name', str('5')],
            ['bag', { t: 'list', items: [str('key'), str('map')], len: 2 }],
          ],
          { changed: ['score'] }
        )}
      />
    )
    expect(screen.getByLabelText('score: number 10 (changed since the last run)')).toBeTruthy()
    expect(screen.getByLabelText('name: text "5"')).toBeTruthy()
    expect(screen.getByText('"5"')).toBeTruthy()
    expect(screen.getByText('changed')).toBeTruthy()
    // List tiles carry their index.
    expect(screen.getByText('"map"').parentElement.textContent).toBe('"map"1')
  })

  it('cuts long text with a Show all control', () => {
    render(<NameTagPanel config={view} run={runOf([['long', str('x'.repeat(80))]])} />)
    const button = screen.getByRole('button', { name: 'Show all' })
    fireEvent.click(button)
    expect(screen.getByRole('button', { name: 'Show less' }).getAttribute('aria-expanded')).toBe(
      'true'
    )
  })

  it('takes predictions before Run and marks them after, in words as well as colour', () => {
    const onPredictionChange = vi.fn()
    const config = { ...view, mode: 'predict', predict: ['score', 'lives'] }
    const { rerender } = render(
      <NameTagPanel
        config={config}
        predictions={{ values: { score: '' }, results: null }}
        onPredictionChange={onPredictionChange}
      />
    )
    fireEvent.change(screen.getByLabelText('score'), { target: { value: '10' } })
    expect(onPredictionChange).toHaveBeenCalledWith('score', '10')
    rerender(
      <NameTagPanel
        config={config}
        run={runOf([
          ['score', int(10)],
          ['lives', int(2)],
        ])}
        predictions={{
          values: { score: '10', lives: '3' },
          results: { score: true, lives: false },
        }}
        onPredictionChange={onPredictionChange}
      />
    )
    expect(screen.getByText('✓ Right', { exact: false })).toBeTruthy()
    expect(screen.getByText('✗ Not quite', { exact: false })).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('1 of 2 predictions right')
  })

  it('shows targets, including names not made yet', () => {
    const config = { ...view, mode: 'target', target: { score: 10, bag: ['key'] } }
    render(<NameTagPanel config={config} run={runOf([['score', int(10)]])} />)
    expect(screen.getByText('✓ On target')).toBeTruthy()
    expect(screen.getByText('not made yet')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toContain('1 of 2 on target')
  })
})

describe('TaskVariablesPanel', () => {
  it('renders nothing for a task without showVariables', () => {
    const { container } = render(<TaskVariablesPanel task={{ id: 1 }} panel={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows a synced copy read-only, for the same task only', () => {
    const task = { id: 1, showVariables: { mode: 'predict', predict: ['score'] } }
    const synced = compactVariablesForSync(null, {
      taskId: 1,
      values: { score: '7' },
      results: null,
    })
    render(<TaskVariablesPanel task={task} synced={synced} audience="tutor" />)
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.getByText('7')).toBeTruthy()
  })
})
