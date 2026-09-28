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
  it('plays the task through ActivityHost and grades on Check answers', async () => {
    const user = userEvent.setup()
    render(<ActivityPreview task={task} />)
    const preview = screen.getByTestId('activity-preview')
    expect(within(preview).getByTestId('activity-host')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /check answers/i }))
    expect(screen.getByText(/^Not yet/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Show answers' }))
    expect(screen.queryByText(/^Not yet/)).toBeNull()
    await user.click(screen.getByRole('button', { name: /check answers/i }))
    expect(screen.getByText(/All correct/)).toBeInTheDocument()
  })

  it('keeps the preview state in memory while the task is unchanged, and restarts on edit', async () => {
    const user = userEvent.setup()
    const { unmount } = render(<ActivityPreview task={task} />)
    await user.click(screen.getByRole('button', { name: 'Show answers' }))
    const pressedBits = () =>
      screen.getAllByRole('switch').filter((b) => b.getAttribute('aria-checked') === 'true').length
    const shown = pressedBits()
    expect(shown).toBeGreaterThan(0)
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
