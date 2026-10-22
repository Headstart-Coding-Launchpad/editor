// Request #92: the tutor's StudentModal puts the student's code beside their Stage drawing when
// it is wide, so the code keeps its full height, and "Bigger picture" gives the drawing more room.
import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const size = { width: 0, height: 0 }
vi.mock('../../../../shared/useElementSize', () => ({
  useElementSize: () => [() => {}, size],
}))
vi.mock('../../../../shared/stage/StagePane.jsx', () => ({
  default: ({ title }) => <section aria-label={title} />,
}))

const { default: CodeStageSplit } = await import('../CodeStageSplit.jsx')

const stageResult = { commands: [{ name: 'circle', args: [50] }], truncated: false }
const editor = <div data-testid="editor">code</div>

describe('CodeStageSplit', () => {
  beforeEach(() => {
    size.width = 0
    size.height = 0
  })

  it('gives the code all the room when the run drew nothing', () => {
    render(<CodeStageSplit editor={editor} stageResult={null} />)
    expect(screen.getByTestId('editor')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: "Student's stage" })).toBeNull()
    expect(screen.queryByTestId('code-stage-split')).toBeNull()
  })

  it('puts the code beside the Stage in a wide modal', () => {
    size.width = 900
    size.height = 500
    render(<CodeStageSplit editor={editor} stageResult={stageResult} />)
    expect(screen.getByTestId('code-stage-split')).toHaveAttribute('data-layout', 'side')
    expect(screen.getByTestId('editor')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: "Student's stage" })).toBeInTheDocument()
  })

  it('stacks them in a narrow modal', () => {
    size.width = 500
    size.height = 500
    render(<CodeStageSplit editor={editor} stageResult={stageResult} />)
    expect(screen.getByTestId('code-stage-split')).toHaveAttribute('data-layout', 'stacked')
  })

  it('makes the picture bigger and smaller again', async () => {
    size.width = 900
    size.height = 500
    render(<CodeStageSplit editor={editor} stageResult={stageResult} />)
    const button = screen.getByRole('button', { name: 'Bigger picture' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(button)
    expect(screen.getByRole('button', { name: 'Smaller picture' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })
})
