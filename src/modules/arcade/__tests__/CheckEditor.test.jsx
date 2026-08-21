import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import CheckEditor from '../CheckEditor.jsx'

describe('arcade CheckEditor', () => {
  it('warns that checks are not yet evaluated during gameplay', () => {
    render(
      <CheckEditor
        task={{ check: [] }}
        lesson={{ type: 'arcade' }}
        onUpdate={vi.fn()}
        interactionMode="run"
        activePythonCode=""
      />
    )

    expect(screen.getByText(/evaluated when a student plays the game yet/)).toBeInTheDocument()
  })
})
