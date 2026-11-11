// The other module share viewers (`/share/:id`) still render through ShareParts after the
// Python share page got its own classroom-style layout (Ryan, 11 Nov 2026).
import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../modules/scratch/ScratchWorkspace.jsx', () => ({
  default: ({ readOnly }) => <div data-testid="scratch-workspace" data-readonly={String(readOnly)} />,
}))

const { default: TurtleShareView } = await import('../../../modules/turtle/ShareView.jsx')
const { default: HtmlShareView } = await import('../../../modules/html/ShareView.jsx')
const { default: ScratchShareView } = await import('../../../modules/scratch/ShareView.jsx')

describe('module share views', () => {
  it('Turtle: a Drawing panel and the Code panel', () => {
    render(
      <TurtleShareView
        payload={{
          code: 'forward(50)',
          turtleResult: { commands: [{ type: 'line', x1: 0, y1: 0, x2: 50, y2: 0 }] },
        }}
      />
    )
    expect(screen.getByRole('region', { name: 'Drawing' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Code' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 2, name: 'Code' })).toBeInTheDocument()
  })

  it('HTML: a Preview panel and a panel per file', () => {
    render(
      <HtmlShareView
        payload={{
          files: [
            { name: 'index.html', content: '<h1>Hi</h1>' },
            { name: 'style.css', content: 'h1 { color: red }' },
          ],
          entryFile: 'index.html',
        }}
      />
    )
    expect(screen.getByRole('region', { name: 'Preview' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'index.html' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'style.css' })).toBeInTheDocument()
  })

  it('Scratch: the read-only workspace', () => {
    render(<ScratchShareView payload={{ task: {}, state: null }} />)
    expect(screen.getByTestId('scratch-workspace')).toHaveAttribute('data-readonly', 'true')
  })
})
