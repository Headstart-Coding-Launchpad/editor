import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import FilesystemTaskWorkspace from '../FilesystemTaskWorkspace.jsx'

function baseTask(overrides = {}) {
  return {
    id: 1,
    starterFs: { '/': { type: 'dir' } },
    codeStages: [{ label: 'Starter', role: 'starter', fs: { '/': { type: 'dir' }, '/notes.txt': { type: 'file', content: '' } } }],
    ...overrides,
  }
}

describe('FilesystemTaskWorkspace — Test checks', () => {
  it('disables the button and shows a hint when no check is configured', () => {
    render(<FilesystemTaskWorkspace task={baseTask()} lesson={{}} onUpdate={vi.fn()} codeTab="stage_0" codeStages={baseTask().codeStages} handleCodeTabChange={vi.fn()} handleAddStage={vi.fn()} handleRemoveStage={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Test checks' })).toBeDisabled()
    expect(screen.getByText(/No checks configured/)).toBeInTheDocument()
  })

  it('evaluates the check against the active tab\'s filesystem and marks the task as tested', () => {
    const task = baseTask({ check: [{ type: 'fs_file_exists', path: '/notes.txt' }] })
    const onUpdate = vi.fn()
    render(<FilesystemTaskWorkspace task={task} lesson={{}} onUpdate={onUpdate} codeTab="stage_0" codeStages={task.codeStages} handleCodeTabChange={vi.fn()} handleAddStage={vi.fn()} handleRemoveStage={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Test checks' }))

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ _checkTested: true }))
    expect(screen.getByText(/Check passes/)).toBeInTheDocument()
  })

  it('reports a failing check against the active tab\'s filesystem', () => {
    const task = baseTask({ check: [{ type: 'fs_file_exists', path: '/missing.txt' }] })
    render(<FilesystemTaskWorkspace task={task} lesson={{}} onUpdate={vi.fn()} codeTab="stage_0" codeStages={task.codeStages} handleCodeTabChange={vi.fn()} handleAddStage={vi.fn()} handleRemoveStage={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Test checks' }))

    expect(screen.getByText(/does not pass|Check .* does not/i)).toBeInTheDocument()
  })
})
