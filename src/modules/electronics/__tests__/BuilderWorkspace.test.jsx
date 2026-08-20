import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import BuilderWorkspace from '../BuilderWorkspace.jsx'
import { DEFAULT_CIRCUIT } from '../circuit.js'

function baseTask(overrides = {}) {
  return {
    id: 1,
    starterCircuit: DEFAULT_CIRCUIT,
    codeStages: [],
    ...overrides,
  }
}

function renderWorkspace(task, onUpdate = vi.fn()) {
  render(
    <BuilderWorkspace
      task={task}
      onUpdate={onUpdate}
      codeTab="starter"
      codeStages={task.codeStages}
      handleCodeTabChange={vi.fn()}
      handleAddStage={vi.fn()}
      handleRemoveStage={vi.fn()}
    />
  )
  return onUpdate
}

describe('electronics BuilderWorkspace — Test checks', () => {
  it('disables the button and shows a hint when no check is configured', () => {
    renderWorkspace(baseTask())

    expect(screen.getByRole('button', { name: 'Test checks' })).toBeDisabled()
    expect(screen.getByText(/No checks configured/)).toBeInTheDocument()
  })

  it('evaluates the check against the active tab\'s circuit and marks the task as tested', () => {
    const task = baseTask({ check: [{ type: 'circuit_no_short' }] })
    const onUpdate = renderWorkspace(task)

    fireEvent.click(screen.getByRole('button', { name: 'Test checks' }))

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ _checkTested: true }))
    expect(screen.getByText(/Check passes/)).toBeInTheDocument()
  })
})
