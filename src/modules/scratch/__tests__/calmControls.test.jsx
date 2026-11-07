import React, { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CalmMoreFold, CalmPaletteToggle } from '../calm/CalmControls.jsx'

// The calm screen's palette state lives in ScratchWorkspace (flyoutCollapsed); this harness
// gives it the same shape: only the Blocks button changes it, so a tap anywhere else (the stage,
// the script, a dropped block) leaves it as it is.
function Harness() {
  const [open, setOpen] = useState(false)
  const [drops, setDrops] = useState(0)
  return (
    <div>
      <CalmPaletteToggle open={open} onToggle={() => setOpen((o) => !o)} />
      <div data-testid="palette" hidden={!open}>
        <button type="button" onClick={() => setDrops((n) => n + 1)}>
          drop a block
        </button>
      </div>
      <canvas data-testid="stage" />
      <div data-testid="script">drops: {drops}</div>
    </div>
  )
}

describe('the Blocks button (calm Scratch palette)', () => {
  it('starts closed, opens with one tap, and stays open across several drops and taps on the stage or script', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const blocks = screen.getByRole('button', { name: /Blocks/ })
    expect(blocks).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByTestId('palette')).not.toBeVisible()

    await user.click(blocks)
    expect(blocks).toHaveAttribute('aria-expanded', 'true')
    for (let i = 0; i < 3; i++)
      await user.click(screen.getByRole('button', { name: 'drop a block' }))
    await user.click(screen.getByTestId('stage'))
    await user.click(screen.getByTestId('script'))
    expect(screen.getByTestId('palette')).toBeVisible()
    expect(screen.getByTestId('script')).toHaveTextContent('drops: 3')

    await user.click(blocks)
    expect(blocks).toHaveAttribute('aria-expanded', 'false')
  })

  it('says Blocks with a brick, is at least 44px tall and carries the test id', () => {
    render(<CalmPaletteToggle open={false} onToggle={() => {}} />)
    const blocks = screen.getByTestId('scratch-palette-toggle')
    expect(blocks).toHaveTextContent('🧱')
    expect(blocks).toHaveTextContent('Blocks')
    expect(parseInt(blocks.style.minHeight, 10)).toBeGreaterThanOrEqual(44)
  })

  it('points a tutor’s category highlight at itself while the palette is closed', () => {
    const { rerender } = render(<CalmPaletteToggle open={false} onToggle={() => {}} />)
    expect(screen.getByTestId('scratch-palette-toggle')).toHaveAttribute(
      'data-highlight-reveal',
      'category'
    )
    rerender(<CalmPaletteToggle open onToggle={() => {}} />)
    expect(screen.getByTestId('scratch-palette-toggle')).not.toHaveAttribute(
      'data-highlight-reveal'
    )
  })
})

describe('More (sprite properties and + Backdrop)', () => {
  it('folds its contents until tapped', async () => {
    const user = userEvent.setup()
    render(
      <CalmMoreFold>
        <label>
          x <input defaultValue="0" />
        </label>
      </CalmMoreFold>
    )
    expect(screen.queryByLabelText('x')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /More/ }))
    expect(screen.getByLabelText('x')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /More/ })).toHaveAttribute('aria-expanded', 'true')
  })
})
