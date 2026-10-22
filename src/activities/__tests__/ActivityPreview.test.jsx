import React from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it } from 'vitest'
import ActivityPreview, { clearActivityPreviewStore } from '../ActivityPreview.jsx'
import binary from '../binary/definition.js'

afterEach(() => clearActivityPreviewStore())

const task = {
  ...binary.defaultTask({ id: 1, title: 'Make it' }),
  bits: 4,
  items: [{ id: 'a', target: 1 }],
}

describe('Builder activity preview (ActivityHost, in-memory state)', () => {
  it('plays the task through ActivityHost and marks as you go (no Check button)', async () => {
    const user = userEvent.setup()
    render(<ActivityPreview task={task} />)
    const preview = screen.getByTestId('activity-preview')
    expect(within(preview).getByTestId('activity-host')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /check my work/i })).toBeNull()

    // A wrong entry reports nothing; the change that makes it right passes the preview.
    await user.click(screen.getByRole('switch', { name: 'Bits 2 column' }))
    expect(screen.queryByText(/All correct/)).toBeNull()
    await user.click(screen.getByRole('switch', { name: 'Bits 2 column' }))
    await user.click(screen.getByRole('switch', { name: 'Bits 1 column' }))
    expect(screen.getByText(/All correct/)).toBeInTheDocument()
  })

  it('keeps the preview state in memory while the task is unchanged, and restarts on edit', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<ActivityPreview task={task} />)
    await user.click(screen.getByRole('switch', { name: 'Bits 2 column' }))
    const pressedBits = () =>
      screen.getAllByRole('switch').filter((b) => b.getAttribute('aria-checked') === 'true').length
    const shown = pressedBits()
    expect(shown).toBe(1)
    unmount()

    const { unmount: unmount2 } = render(<ActivityPreview task={task} />)
    expect(pressedBits()).toBe(shown)
    unmount2()

    render(<ActivityPreview task={{ ...task, items: [{ id: 'a', target: 2 }] }} />)
    expect(pressedBits()).toBe(0)
  })

  it('renders nothing for a code task', () => {
    const { container } = render(<ActivityPreview task={{ id: 1, title: 'Code' }} />)
    expect(container).toBeEmptyDOMElement()
  })
})
