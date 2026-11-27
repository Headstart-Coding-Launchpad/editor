import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PythonEditor from '../PythonEditor'

// The calm code screen's key row (touch screens): one row of main keys with the task's own
// symbols, and "More keys" opening the rest as a flat strip that stays open until closed.
// The real useShowTouchKeys check (a coarse main pointer, or a real touch), no mock.
describe('PythonEditor calm key row', () => {
  let coarse = true
  beforeEach(() => {
    coarse = true
    window.matchMedia = (query) => ({
      matches: coarse && query === '(pointer: coarse)',
      // CodeMirror listens for printing through matchMedia too.
      addListener: () => {},
      removeListener: () => {},
    })
  })
  afterEach(() => {
    delete window.matchMedia
    delete window.ontouchstart
  })

  const renderEditor = (props = {}) =>
    render(
      <PythonEditor calm code="" onChange={vi.fn()} keyCode={"x = {'a': [1]}  # 5%"} {...props} />
    )

  it("shows one row of main keys with the task's own symbols, 44px on touch", () => {
    renderEditor()
    const row = screen.getByRole('toolbar', { name: 'Python keys' })
    for (const key of ['[', '#', '%', '{']) {
      expect(within(row).getByRole('button', { name: key })).toBeInTheDocument()
    }
    expect(within(row).getByRole('button', { name: '[' }).style.height).toBe('44px')
    expect(screen.getByRole('button', { name: /More keys/ })).toHaveAttribute(
      'aria-expanded',
      'false'
    )
    expect(screen.queryByRole('group', { name: 'More keys' })).not.toBeInTheDocument()
  })

  it('More keys opens the rest as a strip in the page that stays open until Fewer keys', async () => {
    const user = userEvent.setup()
    renderEditor()
    await user.click(screen.getByRole('button', { name: /More keys/ }))
    const strip = screen.getByRole('group', { name: 'More keys' })
    // In the flow of the page, never laid over the first lines of code.
    expect(strip.style.position).not.toBe('absolute')
    expect(strip.style.position).not.toBe('fixed')
    await user.click(within(strip).getByRole('button', { name: '<' }))
    expect(screen.getByRole('group', { name: 'More keys' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Fewer keys/ }))
    expect(screen.queryByRole('group', { name: 'More keys' })).not.toBeInTheDocument()
  })

  it('the More keys button points a tutor highlight at a key in the strip', () => {
    renderEditor()
    expect(screen.getByRole('button', { name: /More keys/ })).toHaveAttribute(
      'data-highlight-reveal',
      'key'
    )
  })

  it('leaves Emoji, Keys and Blocks to the code row (no second toolbar in the editor)', () => {
    renderEditor()
    expect(screen.queryByRole('button', { name: 'Keys' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Insert emoji' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Blocks/ })).not.toBeInTheDocument()
  })

  const keyRow = () => screen.queryByRole('toolbar', { name: 'Python keys' })
  const pointer = (type, pointerType) =>
    window.dispatchEvent(Object.assign(new Event(type), { pointerType }))

  it('has no key row on a mouse PC, even one that reports touch support', () => {
    coarse = false
    window.ontouchstart = null
    renderEditor()
    expect(keyRow()).not.toBeInTheDocument()
  })

  it('has no key row, and does not break, where matchMedia is missing', () => {
    delete window.matchMedia
    renderEditor()
    expect(keyRow()).not.toBeInTheDocument()
  })

  // Last: a real touch is remembered for the rest of the page (here, this test file).
  it('shows the key row once a finger has touched the screen, and keeps it', async () => {
    coarse = false
    const { unmount } = renderEditor()
    pointer('pointerup', 'mouse')
    pointer('pointerup', 'pen')
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(keyRow()).not.toBeInTheDocument()
    pointer('pointerup', 'touch')
    await waitFor(() => expect(keyRow()).toBeInTheDocument())
    // The next editor (another task) has it from the start.
    unmount()
    renderEditor()
    expect(keyRow()).toBeInTheDocument()
  })
})
