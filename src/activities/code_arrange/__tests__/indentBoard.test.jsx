import React, { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CodeArrangeIndentBoard from '../CodeArrangeIndentBoard.jsx'
import CodeArrangeTask from '../CodeArrangeTask.jsx'
import { INDENT_CODE_ARRANGE_TASK as INDENT_TASK } from '../../../test/fixtures/legacyActivityTasks.js'

function Controlled({ task = INDENT_TASK, initial = {}, onChange }) {
  const [state, setState] = useState(initial)
  return (
    <CodeArrangeIndentBoard
      task={task}
      state={state}
      onChange={(next) => {
        setState(next)
        onChange?.(next)
      }}
    />
  )
}

const line = (n) => screen.getByRole('slider', { name: new RegExp(`^Line ${n}:`) })

describe('CodeArrangeIndentBoard', () => {
  beforeEach(() => window.localStorage.clear())

  it('shows every line in order, locked lines fixed and the rest as sliders at their start', () => {
    render(<Controlled />)
    expect(screen.getAllByRole('slider')).toHaveLength(5)
    expect(screen.getByLabelText('Line 1 (fixed): guess = 15')).toBeInTheDocument()
    expect(line(3)).toHaveAttribute('aria-valuenow', '0')
    expect(screen.queryByRole('button', { name: 'Move line 1 right' })).not.toBeInTheDocument()
  })

  it('moves a line with its arrow buttons, within 0..4', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)
    expect(screen.getByRole('button', { name: 'Move line 4 left' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Move line 4 right' }))
    expect(onChange).toHaveBeenLastCalledWith({ L4: 1 })
    expect(line(4)).toHaveAttribute('aria-valuenow', '1')
  })

  it('moves a focused line with ← →, and ↑ ↓ move between movable lines', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)
    line(6).focus()
    await user.keyboard('{ArrowRight}{ArrowRight}')
    expect(onChange).toHaveBeenLastCalledWith({ L6: 2 })
    await user.keyboard('{ArrowUp}')
    expect(line(5)).toHaveFocus()
    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}')
    // Line 3 is the first movable line: focus stops there rather than landing on a locked line.
    expect(line(3)).toHaveFocus()
  })

  it('snaps a sideways drag to whole indent steps and reports once on release', () => {
    const onChange = vi.fn()
    render(<Controlled onChange={onChange} />)
    const chip = line(6)
    // jsdom has no layout: one step falls back to 36px.
    fireEvent.pointerDown(chip, { pointerId: 1, clientX: 100, button: 0 })
    fireEvent.pointerMove(chip, { pointerId: 1, clientX: 150 })
    fireEvent.pointerMove(chip, { pointerId: 1, clientX: 175 })
    expect(onChange).not.toHaveBeenCalled()
    expect(chip).toHaveAttribute('aria-valuenow', '2')
    fireEvent.pointerUp(chip, { pointerId: 1, clientX: 175 })
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenLastCalledWith({ L6: 2 })
  })

  it('draws a bracket for each indented block, and none for a block with no indented body', () => {
    const { rerender } = render(
      <CodeArrangeIndentBoard task={INDENT_TASK} state={{}} onChange={vi.fn()} />
    )
    expect(screen.queryAllByTestId('indent-block-bar')).toHaveLength(0)
    rerender(
      <CodeArrangeIndentBoard
        task={INDENT_TASK}
        state={{ L4: 1, L5: 1, L6: 2 }}
        onChange={vi.fn()}
      />
    )
    // if guess < 20 covers lines 4-6, if mode == "warmer" covers line 6.
    expect(screen.getAllByTestId('indent-block-bar')).toHaveLength(4)
  })

  it('hides the brackets with the Blocks button, or entirely when the task turns them off', async () => {
    const user = userEvent.setup()
    const state = { L4: 1 }
    const { rerender } = render(
      <CodeArrangeIndentBoard task={INDENT_TASK} state={state} onChange={vi.fn()} />
    )
    expect(screen.getAllByTestId('indent-block-bar')).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: /blocks/i }))
    expect(screen.queryAllByTestId('indent-block-bar')).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: /blocks/i }))
    rerender(
      <CodeArrangeIndentBoard
        task={{ ...INDENT_TASK, showBlocks: false }}
        state={state}
        onChange={vi.fn()}
      />
    )
    expect(screen.queryByRole('button', { name: /blocks/i })).not.toBeInTheDocument()
    expect(screen.queryAllByTestId('indent-block-bar')).toHaveLength(0)
  })

  it('is read-only without onChange: no buttons, not focusable, keys do nothing', () => {
    render(<CodeArrangeIndentBoard task={INDENT_TASK} state={{ L4: 1 }} />)
    expect(screen.queryByRole('button', { name: /move line/i })).not.toBeInTheDocument()
    expect(line(4)).not.toHaveAttribute('tabindex')
    expect(line(4)).toHaveAttribute('aria-disabled', 'true')
    expect(line(4)).toHaveAttribute('aria-valuenow', '1')
  })
})

describe('CodeArrangeTask in indent mode', () => {
  it('shows the indent board instead of tiles, and Run is available straight away', () => {
    const onAssembledCodeChange = vi.fn()
    render(
      <CodeArrangeTask
        task={INDENT_TASK}
        moduleType="python"
        selectedAnswer={{ L4: 1 }}
        onSelectAnswer={vi.fn()}
        onAssembledCodeChange={onAssembledCodeChange}
        onRun={vi.fn()}
      />
    )
    expect(screen.getByTestId('code-arrange-indent-board')).toBeInTheDocument()
    expect(screen.queryByText('Code tiles')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Run' })).toBeEnabled()
    expect(onAssembledCodeChange).toHaveBeenCalledWith(
      expect.stringContaining('if guess < 20:\n    print("Too low")')
    )
  })
})
