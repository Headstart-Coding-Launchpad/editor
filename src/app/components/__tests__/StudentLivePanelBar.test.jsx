import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import StudentLivePanelBar from '../StudentLivePanelBar'

describe('StudentLivePanelBar', () => {
  const handlers = () => ({ onWatch: vi.fn(), onStopWatching: vi.fn(), onTryCopy: vi.fn() })

  it('offers Watch and Try a copy without interrupting the student', () => {
    const h = handlers()
    render(<StudentLivePanelBar sourceStudentName="Sam" {...h} />)
    expect(screen.getByText(/Sam's work is on show — keep coding/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Watch/ }))
    fireEvent.click(screen.getByRole('button', { name: /Try a copy/ }))
    expect(h.onWatch).toHaveBeenCalled()
    expect(h.onTryCopy).toHaveBeenCalled()
  })

  it('offers the way back while watching', () => {
    const h = handlers()
    render(<StudentLivePanelBar sourceStudentName="Sam" watching {...h} />)
    fireEvent.click(screen.getByRole('button', { name: /Back to my work/ }))
    expect(h.onStopWatching).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /Watch/ })).toBeNull()
  })

  it('hides both offers while the copy is open (the copy has its own way back)', () => {
    render(<StudentLivePanelBar sourceStudentName="Sam" copyOpen {...handlers()} />)
    expect(screen.queryByRole('button', { name: /Watch/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Try a copy/ })).toBeNull()
  })
})
