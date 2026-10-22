// Ryan, 2026-10-22: the colour scrub offers all colours, not a selection. "All colours" lists
// every CSS colour name (one per colour), greys first, and writes the name.
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { SCRUB_ALL_COLOURS } from '../literals.js'

const previewScrub = vi.fn()
vi.mock('../scrubExtension.js', () => ({
  beginScrub: () => ({}),
  cancelScrub: vi.fn(),
  commitScrub: vi.fn(),
  previewScrub: (...args) => previewScrub(...args),
}))

const { default: ScrubPopover } = await import('../ScrubPopover.jsx')

function colourRequest() {
  const dom = document.createElement('div')
  document.body.appendChild(dom)
  return {
    view: { dom, coordsAtPos: () => ({ left: 10, top: 10, bottom: 20 }), focus: () => {} },
    literal: { kind: 'colour', text: "'red'", hex: '#ff0000', from: 0, to: 5, quote: "'" },
    colourNames: true,
  }
}

describe('All colours', () => {
  it('has every CSS colour once, British spellings, greys first', () => {
    const names = SCRUB_ALL_COLOURS.map((c) => c.name)
    expect(names).toContain('grey')
    expect(names).not.toContain('gray')
    expect(names).toContain('cyan')
    expect(names).not.toContain('aqua')
    expect(names).toContain('rebeccapurple')
    expect(new Set(names).size).toBe(names.length)
    expect(names[0]).toBe('black')
    expect(names.length).toBeGreaterThan(130)
  })

  it('opens the full list in the picker, filters it, and writes the name', async () => {
    const onClose = vi.fn()
    render(<ScrubPopover request={colourRequest()} onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: /All colours/ }))
    await userEvent.type(screen.getByLabelText('Find a colour'), 'rebecca')
    const group = screen.getByRole('group', { name: /All colours/ })
    const choice = group.querySelector('button')
    expect(choice).toHaveAccessibleName('rebeccapurple')
    await userEvent.click(choice)
    expect(previewScrub).toHaveBeenCalled()
    expect(previewScrub.mock.calls.at(-1)[2]).toBe('rebeccapurple')
  })
})
