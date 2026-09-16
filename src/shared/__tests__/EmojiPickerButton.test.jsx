import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import EmojiPickerButton from '../EmojiPickerButton'

// The real picker renders a large emoji grid (third-party internals, not
// ours to test) — stub it down to a single clickable emoji.
vi.mock('emoji-picker-react', () => ({
  default: ({ onEmojiClick }) => (
    <button type="button" onClick={() => onEmojiClick({ emoji: '🎉' })}>
      pick-🎉
    </button>
  ),
  EmojiStyle: { NATIVE: 'native' },
}))

describe('EmojiPickerButton', () => {
  it('opens the picker on click and closes after a pick', async () => {
    const user = userEvent.setup()
    const onInsert = vi.fn()
    render(<EmojiPickerButton onInsert={onInsert} />)

    expect(screen.queryByRole('button', { name: 'pick-🎉' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Insert emoji' }))
    expect(screen.getByRole('button', { name: 'pick-🎉' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'pick-🎉' }))
    expect(onInsert).toHaveBeenCalledWith('🎉')
    expect(screen.queryByRole('button', { name: 'pick-🎉' })).not.toBeInTheDocument()
  })

  it('closes when clicking outside', async () => {
    const user = userEvent.setup()
    render(
      <div>
        <EmojiPickerButton onInsert={vi.fn()} />
        <button type="button">outside</button>
      </div>
    )

    await user.click(screen.getByRole('button', { name: 'Insert emoji' }))
    expect(screen.getByRole('button', { name: 'pick-🎉' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'outside' }))
    expect(screen.queryByRole('button', { name: 'pick-🎉' })).not.toBeInTheDocument()
  })
})
