import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ArcadePreview from '../ArcadePreview.jsx'

describe('ArcadePreview', () => {
  it('does not create the game iframe until a game is explicitly run', () => {
    const { rerender } = render(<ArcadePreview code="game.run()" assets={[]} runId={0} running={false} />)

    expect(screen.getByText('Ready to play')).toBeInTheDocument()
    expect(screen.queryByTitle('Arcade game')).not.toBeInTheDocument()
    expect(screen.getByText('Console')).toBeInTheDocument()

    rerender(<ArcadePreview code="game.run()" assets={[]} runId={1} running />)

    expect(screen.getByTitle('Arcade game')).toBeInTheDocument()
  })
})
