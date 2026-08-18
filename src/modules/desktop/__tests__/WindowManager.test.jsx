import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import WindowManager from '../WindowManager.jsx'
import { makeDefaultDesktop } from '../desktopState.js'

// jsdom doesn't do real layout/hit-testing, so it can't catch the actual bug this guards
// against (desktop icons being unclickable in a real browser because WindowManager's
// full-bleed wrapper — present and stacked above the icon layer even with zero windows
// open — silently swallowed every click site-wide). This asserts the two inline styles
// that fix it stay in place: the wrapper lets clicks fall through everywhere there's no
// window, and each Window re-enables pointer events on itself.
describe('WindowManager pointer-events layering', () => {
  it("the wrapper lets clicks fall through to the desktop icon layer beneath", () => {
    const state = makeDefaultDesktop([])
    const { container } = render(<WindowManager state={state} onStateChange={vi.fn()} apps={{}} />)
    expect(container.firstChild).toHaveStyle({ pointerEvents: 'none' })
  })

  it('an open window re-enables pointer events on itself', () => {
    let state = makeDefaultDesktop(['fileManager'])
    const apps = { fileManager: { title: 'File Manager', icon: '🗂️', render: () => <div /> } }
    render(<WindowManager state={state} onStateChange={vi.fn()} apps={apps} />)
    expect(screen.getByRole('dialog')).toHaveStyle({ pointerEvents: 'auto' })
  })
})
