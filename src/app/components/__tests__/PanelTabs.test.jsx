import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import PanelTabs, { PanelTabPanel } from '../PanelTabs'

const TABS = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
]

describe('PanelTabs', () => {
  it('marks the active tab as selected and calls onChange when another is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<PanelTabs tabs={TABS} activeId="a" onChange={onChange} label="Example" />)

    expect(screen.getByRole('tab', { name: 'A' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: 'B' })).toHaveAttribute('aria-selected', 'false')

    await user.click(screen.getByRole('tab', { name: 'B' }))
    expect(onChange).toHaveBeenCalledWith('b')

    await user.click(screen.getByRole('tab', { name: 'A' }))
    expect(onChange).toHaveBeenCalledTimes(1) // clicking the already-active tab is a no-op
  })

  it('adds the teacher-highlight pulse class only to tabs named in highlightedIds', () => {
    render(
      <PanelTabs
        tabs={TABS}
        activeId="a"
        onChange={() => {}}
        label="Example"
        highlightedIds={['b']}
      />
    )

    expect(screen.getByRole('tab', { name: 'A' })).not.toHaveClass('pane-highlight-pulse')
    expect(screen.getByRole('tab', { name: 'B' })).toHaveClass('pane-highlight-pulse')
  })

  it('adds no highlight class when highlightedIds is omitted', () => {
    render(<PanelTabs tabs={TABS} activeId="a" onChange={() => {}} label="Example" />)

    expect(screen.getByRole('tab', { name: 'A' })).not.toHaveClass('pane-highlight-pulse')
    expect(screen.getByRole('tab', { name: 'B' })).not.toHaveClass('pane-highlight-pulse')
  })
})

describe('PanelTabPanel', () => {
  it('hides inactive panels without unmounting their content', () => {
    render(
      <>
        <PanelTabPanel id="a" activeId="a">
          first
        </PanelTabPanel>
        <PanelTabPanel id="b" activeId="a">
          second
        </PanelTabPanel>
      </>
    )

    expect(screen.getByText('first')).toBeVisible()
    expect(screen.getByText('second')).toBeInTheDocument()
    expect(screen.getByText('second')).not.toBeVisible()
  })
})
