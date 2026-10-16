import React from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TaskList from '../TaskList'

const tasks = [
  { id: 1, title: 'Write Your Own print() Statement' },
  { id: 2, title: 'Copy Out a print() Statement' },
]

function renderList(props = {}) {
  const handlers = {
    onSelect: vi.fn(),
    onAdd: vi.fn(),
    onAddGroup: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onReorder: vi.fn(),
  }
  render(<TaskList tasks={tasks} selectedTaskId={1} {...handlers} {...props} />)
  return handlers
}

describe('TaskList row actions', () => {
  it('shows the move, copy and delete buttons only on the selected task', () => {
    renderList()
    const rows = screen.getAllByTestId('task-row-actions')
    expect(rows).toHaveLength(1)
    expect(within(rows[0]).getByRole('button', { name: 'Move up' })).toBeDisabled()
    expect(within(rows[0]).getByRole('button', { name: 'Duplicate' })).toHaveTextContent('Copy')
    expect(within(rows[0]).getByRole('button', { name: 'Delete' })).toHaveTextContent('Delete')
  })

  it('copies and deletes the selected task', () => {
    const { onDuplicate, onDelete } = renderList()
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }))
    expect(onDuplicate).toHaveBeenCalledWith(tasks[0])
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onDelete).toHaveBeenCalledWith(1)
  })
})
