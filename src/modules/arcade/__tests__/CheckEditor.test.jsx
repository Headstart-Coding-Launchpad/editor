import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CheckEditor from '../CheckEditor.jsx'

vi.mock('../../../builder/components/ExplainerEditor', () => ({
  MarkdownFieldEditor: () => <div>markdown-field</div>,
}))

function renderEditor(task, onUpdate = vi.fn()) {
  render(
    <CheckEditor
      task={task}
      lesson={{ type: 'arcade' }}
      onUpdate={onUpdate}
      interactionMode="run"
      activePythonCode=""
    />
  )
  return onUpdate
}

describe('arcade CheckEditor', () => {
  it('no longer warns that checks are ignored — code checks now run on Run game', () => {
    renderEditor({ check: [] })
    expect(screen.queryByText(/evaluated when a student plays the game yet/)).toBeNull()
  })

  it('adds code checks, since a game has no text output to check', () => {
    const onUpdate = renderEditor({ check: [] })
    fireEvent.click(screen.getByText('+ Add check'))
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ check: [{ type: 'code', operator: 'contains', value: '' }] })
    )
  })

  it('does not offer Output as a check subject', () => {
    renderEditor({ check: [{ type: 'code', operator: 'contains', value: 'game.run' }] })
    expect(screen.getByRole('option', { name: 'Code' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'Output' })).toBeNull()
  })
})
