import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import StudentLivePanelBar from '../StudentLivePanelBar'

describe('StudentLivePanelBar', () => {
  const handlers = () => ({ onWatch: vi.fn(), onStopWatching: vi.fn(), onTryCopy: vi.fn() })

  it('offers Look and Try it, in a few words, without interrupting the student', () => {
    const h = handlers()
    render(<StudentLivePanelBar sourceStudentName="Sam" {...h} />)
    expect(screen.getByText(/Look at Sam’s work!/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Look/ }))
    fireEvent.click(screen.getByRole('button', { name: /Try it/ }))
    expect(h.onWatch).toHaveBeenCalled()
    expect(h.onTryCopy).toHaveBeenCalled()
  })

  it('offers the way back while watching', () => {
    const h = handlers()
    render(<StudentLivePanelBar sourceStudentName="Sam" watching {...h} />)
    fireEvent.click(screen.getByRole('button', { name: /Back to my code/ }))
    expect(h.onStopWatching).toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: /Look/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Try it/ })).toBeNull()
  })

  it('hides both offers while the copy is open (the copy has its own way back)', () => {
    render(<StudentLivePanelBar sourceStudentName="Sam" copyOpen {...handlers()} />)
    expect(screen.queryByRole('button', { name: /Look/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Try it/ })).toBeNull()
  })
})
