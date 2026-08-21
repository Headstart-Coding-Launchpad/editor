import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TeacherCodeTabs from '../TeacherCodeTabs'

const stages = [
  { label: 'Stage 1' },
  { label: 'Stage 2' },
]

function renderTabs(overrides = {}) {
  const props = {
    activeTab: 'starter',
    stages: [],
    onStarter: vi.fn(),
    onStage: vi.fn(),
    onComplete: undefined,
    onSendToAll: undefined,
    hasStudents: false,
    ...overrides,
  }
  render(<TeacherCodeTabs {...props} />)
  return props
}

describe('TeacherCodeTabs', () => {
  it('renders starter tab and calls onStarter', () => {
    const props = renderTabs()
    const btn = screen.getByRole('tab', { name: 'Starter code' })
    expect(btn).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(btn)
    expect(props.onStarter).toHaveBeenCalledOnce()
  })

  it('renders stage tabs and delegates onStage with index', () => {
    const props = renderTabs({ activeTab: 'stage_1', stages })
    const stageBtn = screen.getByRole('tab', { name: 'Stage 2' })
    expect(screen.getByRole('tab', { name: 'Stage 1' })).toHaveAttribute('aria-selected', 'false')
    expect(stageBtn).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(stageBtn)
    expect(props.onStage).toHaveBeenCalledWith(1)
  })

  it('renders complete tab when onComplete is provided', () => {
    const props = renderTabs({ onComplete: vi.fn(), completeLabel: 'Answer' })
    const completeBtn = screen.getByRole('tab', { name: 'Answer' })
    expect(completeBtn).toBeInTheDocument()
    fireEvent.click(completeBtn)
    expect(props.onComplete).toHaveBeenCalledOnce()
  })

  it('does not render complete tab when onComplete is undefined', () => {
    renderTabs({ onComplete: undefined })
    expect(screen.queryByRole('tab', { name: 'Complete code' })).not.toBeInTheDocument()
  })

  it('shows send-to-all button when hasStudents and onSendToAll are provided', () => {
    renderTabs({ hasStudents: true, onSendToAll: vi.fn() })
    expect(screen.getByRole('button', { name: 'Send to all' })).toBeInTheDocument()
  })

  it('does not show send-to-all when hasStudents is false', () => {
    renderTabs({ hasStudents: false, onSendToAll: vi.fn() })
    expect(screen.queryByRole('button', { name: 'Send to all' })).not.toBeInTheDocument()
  })

  it('reveals rather than resets when the active stage is not a starter stage, regardless of unifiedStages', () => {
    // stages[] here has no explicit role, which getStageRole defaults to 'support' —
    // this must be safe to reveal, not reset, even when unifiedStages is left at its
    // default (false), since revealing is correct for every module type, not just the
    // ones using the unified tab layout.
    const onSendToAll = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderTabs({ activeTab: 'stage_0', stages, hasStudents: true, onSendToAll })
    expect(screen.getByRole('button', { name: 'Reveal to all' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reveal to all' }))
    expect(onSendToAll).toHaveBeenCalledWith('reveal_stage_0')
    vi.restoreAllMocks()
  })

  it('sends a raw reset action when the active stage is the starter stage, even without unifiedStages', () => {
    const onSendToAll = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const starterStages = [{ label: 'Starter Stage', role: 'starter' }]
    renderTabs({ activeTab: 'stage_0', stages: starterStages, hasStudents: true, onSendToAll })
    expect(screen.getByRole('button', { name: 'Send to all' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Send to all' }))
    expect(onSendToAll).toHaveBeenCalledWith('stage_0')
    vi.restoreAllMocks()
  })

  it('does not call onSendToAll when confirmation is cancelled', () => {
    const onSendToAll = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderTabs({ hasStudents: true, onSendToAll })
    fireEvent.click(screen.getByRole('button', { name: 'Send to all' }))
    expect(onSendToAll).not.toHaveBeenCalled()
    vi.restoreAllMocks()
  })
})
