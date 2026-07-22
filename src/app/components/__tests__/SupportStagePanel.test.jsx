import React from 'react'
import { createEvent, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import SupportStagePanel from '../SupportStagePanel'

describe('SupportStagePanel', () => {
  it('renders a reveal control before showing the stage content', async () => {
    const user = userEvent.setup()
    const onReveal = vi.fn()
    render(
      <SupportStagePanel
        stage={{ label: 'With a name', code: 'name = "Ada"' }}
        lessonType="python"
        revealed={false}
        onReveal={onReveal}
      />,
    )

    expect(screen.queryByText('name = "Ada"')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /show reference/i }))
    expect(onReveal).toHaveBeenCalledOnce()
  })

  it('shows revealed code and blocks copy-like browser actions', () => {
    render(
      <SupportStagePanel
        stage={{ label: 'With a name', code: 'name = "Ada"' }}
        lessonType="python"
        revealed
      />,
    )

    const panel = screen.getByLabelText('With a name stage reference')
    expect(panel.querySelector('code')?.textContent).toBe('name = "Ada"')

    const copyEvent = createEvent.copy(panel)
    const cutEvent = createEvent.cut(panel)
    const dragEvent = createEvent.dragStart(panel)
    const contextEvent = createEvent.contextMenu(panel)

    fireEvent(panel, copyEvent)
    fireEvent(panel, cutEvent)
    fireEvent(panel, dragEvent)
    fireEvent(panel, contextEvent)

    expect(copyEvent.defaultPrevented).toBe(true)
    expect(cutEvent.defaultPrevented).toBe(true)
    expect(dragEvent.defaultPrevented).toBe(true)
    expect(contextEvent.defaultPrevented).toBe(true)
  })
})
