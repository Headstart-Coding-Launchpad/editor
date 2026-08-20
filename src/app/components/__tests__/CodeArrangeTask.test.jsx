import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import CodeArrangeTask from '../CodeArrangeTask'

function makeDataTransfer() {
  return {
    effectAllowed: null,
    dropEffect: null,
    setData: vi.fn(),
    getData: vi.fn(() => ''),
    setDragImage: vi.fn(),
  }
}

const PYTHON_TASK = {
  taskType: 'code_arrange',
  moduleType: 'python',
  lines: [
    { id: 'L1', parts: [{ type: 'slot', id: 'L1', code: 'for i in range(5): print(i * 2)' }] },
    { id: 'L2', parts: [{ type: 'slot', id: 'L2', code: 'print("done")' }] },
  ],
  distractors: [{ id: 'D1', code: 'print("wrong")' }],
  check: { type: 'output', operator: 'equals', value: '0\n2\n4\n6\n8' },
}

const INLINE_TASK = {
  taskType: 'code_arrange',
  moduleType: 'python',
  lines: [
    {
      id: 'L1',
      parts: [
        { type: 'text', text: 'for i in range(' },
        { type: 'slot', id: 'S1', code: '5' },
        { type: 'text', text: '):' },
      ],
    },
  ],
  distractors: [{ id: 'S1d1', code: '10' }],
  check: { type: 'output', operator: 'equals', value: '0\n1\n2\n3\n4' },
}

describe('CodeArrangeTask — single-slot ("whole line") lines', () => {
  it('renders one slot per line and every tile in the one shared pool when empty', () => {
    render(<CodeArrangeTask task={PYTHON_TASK} moduleType="python" selectedAnswer={{}} />)

    expect(screen.getAllByText('Empty line')).toHaveLength(2)
    expect(screen.getByText('for i in range(5): print(i * 2)')).toBeInTheDocument()
    expect(screen.getByText('print("done")')).toBeInTheDocument()
    expect(screen.getByText('print("wrong")')).toBeInTheDocument()
  })

  it('disables Run until every slot is filled, including when only a distractor is placed', () => {
    const { rerender } = render(
      <CodeArrangeTask task={PYTHON_TASK} moduleType="python" selectedAnswer={{}} onRun={vi.fn()} />
    )
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled()

    rerender(
      <CodeArrangeTask task={PYTHON_TASK} moduleType="python" selectedAnswer={{ L1: 'L1' }} onRun={vi.fn()} />
    )
    expect(screen.getByRole('button', { name: 'Run' })).toBeDisabled()

    rerender(
      <CodeArrangeTask task={PYTHON_TASK} moduleType="python" selectedAnswer={{ L1: 'L1', L2: 'D1' }} onRun={vi.fn()} />
    )
    // Complete (every slot filled) even though L2 holds a distractor —
    // completion gates on fill state only, not on tile identity.
    expect(screen.getByRole('button', { name: 'Run' })).toBeEnabled()
  })

  it('calls onRun when Run is clicked with a complete arrangement', async () => {
    const user = userEvent.setup()
    const onRun = vi.fn()
    render(
      <CodeArrangeTask task={PYTHON_TASK} moduleType="python" selectedAnswer={{ L1: 'L1', L2: 'L2' }} onRun={onRun} />
    )
    await user.click(screen.getByRole('button', { name: 'Run' }))
    expect(onRun).toHaveBeenCalledTimes(1)
  })

  it('reports the assembled code once the arrangement is complete', () => {
    const onAssembledCodeChange = vi.fn()
    render(
      <CodeArrangeTask
        task={PYTHON_TASK}
        moduleType="python"
        selectedAnswer={{ L1: 'L1', L2: 'L2' }}
        onAssembledCodeChange={onAssembledCodeChange}
      />
    )
    expect(onAssembledCodeChange).toHaveBeenCalledWith('for i in range(5): print(i * 2)\nprint("done")')
  })

  it('does not report assembled code while the arrangement is incomplete', () => {
    const onAssembledCodeChange = vi.fn()
    render(
      <CodeArrangeTask task={PYTHON_TASK} moduleType="python" selectedAnswer={{ L1: 'L1' }} onAssembledCodeChange={onAssembledCodeChange} />
    )
    expect(onAssembledCodeChange).not.toHaveBeenCalled()
  })

  it('places a tile into a slot via tap-to-select then tap-to-place, and removes it from the pool', async () => {
    const user = userEvent.setup()
    let answer = {}
    const onSelectAnswer = vi.fn(next => { answer = next })
    const { rerender } = render(
      <CodeArrangeTask task={PYTHON_TASK} moduleType="python" selectedAnswer={answer} onSelectAnswer={onSelectAnswer} />
    )

    await user.click(screen.getByText('for i in range(5): print(i * 2)'))
    rerender(<CodeArrangeTask task={PYTHON_TASK} moduleType="python" selectedAnswer={answer} onSelectAnswer={onSelectAnswer} />)
    await user.click(screen.getAllByText('Tap to place')[0])

    expect(onSelectAnswer).toHaveBeenLastCalledWith({ L1: 'L1' })
  })

  it('never mutates the transform of a pool tile while it is the active native-drag source', () => {
    // Regression test: a CSS transform applied to an element while it is the
    // live source of a native HTML5 drag (dragstart fired, no dragend/drop
    // yet) is a known way to destabilise the drag session in Chromium —
    // reported as "dragging feels wonky / only works from part of the tile".
    // The pool tile may dim (opacity), but must never change size/position.
    render(<CodeArrangeTask task={PYTHON_TASK} moduleType="python" selectedAnswer={{}} />)

    const tile = screen.getByRole('button', { name: 'for i in range(5): print(i * 2)' })
    fireEvent.dragStart(tile, { dataTransfer: makeDataTransfer() })

    expect(tile.style.transform).toBeFalsy()
    expect(tile.style.opacity).toBe('0.35')
  })

  it('still applies the lifted transform for tap-to-select (no native drag session to disrupt)', async () => {
    const user = userEvent.setup()
    render(<CodeArrangeTask task={PYTHON_TASK} moduleType="python" selectedAnswer={{}} />)

    const tile = screen.getByRole('button', { name: 'for i in range(5): print(i * 2)' })
    await user.click(tile)

    expect(tile.style.transform).toBeTruthy()
  })

  it('renders an iframe preview instead of an output panel for HTML tasks', () => {
    const htmlTask = {
      taskType: 'code_arrange',
      moduleType: 'html',
      entryFile: 'index.html',
      lines: [{ id: 'L1', parts: [{ type: 'slot', id: 'L1', code: '<h1>Hello</h1>' }] }],
      check: { type: 'html_element', operator: 'exists', selector: 'h1' },
    }
    render(<CodeArrangeTask task={htmlTask} moduleType="html" selectedAnswer={{}} iframeSrc={null} />)
    expect(screen.queryByText('Run your code to see output here.')).not.toBeInTheDocument()
  })

  it('hides the Run row and blocks interaction when disabled', () => {
    render(
      <CodeArrangeTask task={PYTHON_TASK} moduleType="python" selectedAnswer={{ L1: 'L1', L2: 'L2' }} disabled />
    )
    expect(screen.queryByRole('button', { name: 'Run' })).not.toBeInTheDocument()
  })
})

describe('CodeArrangeTask — lines with inline blanks', () => {
  it('renders fixed text verbatim and an empty placeholder for an unfilled blank', () => {
    render(<CodeArrangeTask task={INLINE_TASK} moduleType="python" selectedAnswer={{}} />)

    expect(screen.getByText('for i in range(')).toBeInTheDocument()
    expect(screen.getByText('):')).toBeInTheDocument()
    expect(screen.getByText('___')).toBeInTheDocument()
  })

  it('renders the one shared "Code tiles" pool (the blank\'s correct tile + the task\'s distractors)', () => {
    render(<CodeArrangeTask task={INLINE_TASK} moduleType="python" selectedAnswer={{}} />)
    expect(screen.getByText('Code tiles')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
  })

  it('fills the blank in place and reports the spliced-together assembled line', () => {
    const onAssembledCodeChange = vi.fn()
    render(
      <CodeArrangeTask
        task={INLINE_TASK}
        moduleType="python"
        selectedAnswer={{ S1: 'S1' }}
        onAssembledCodeChange={onAssembledCodeChange}
      />
    )
    expect(onAssembledCodeChange).toHaveBeenCalledWith('for i in range(5):')
    expect(screen.getByRole('button', { name: 'Run' })).toBeEnabled()
  })

  it('splices a distractor tile into the blank and assembles the resulting (wrong) code for real', () => {
    const onAssembledCodeChange = vi.fn()
    render(
      <CodeArrangeTask
        task={INLINE_TASK}
        moduleType="python"
        selectedAnswer={{ S1: 'S1d1' }}
        onAssembledCodeChange={onAssembledCodeChange}
      />
    )
    expect(onAssembledCodeChange).toHaveBeenCalledWith('for i in range(10):')
  })

  it('places a tile into a blank via tap-to-select then tap-to-place', async () => {
    const user = userEvent.setup()
    let answer = {}
    const onSelectAnswer = vi.fn(next => { answer = next })
    const { rerender } = render(
      <CodeArrangeTask task={INLINE_TASK} moduleType="python" selectedAnswer={answer} onSelectAnswer={onSelectAnswer} />
    )

    await user.click(screen.getByText('5'))
    rerender(<CodeArrangeTask task={INLINE_TASK} moduleType="python" selectedAnswer={answer} onSelectAnswer={onSelectAnswer} />)
    await user.click(screen.getByText('Tap to place'))

    expect(onSelectAnswer).toHaveBeenLastCalledWith({ S1: 'S1' })
  })

  it('lets a tile be dragged from the shared pool into a slot on a different line than it was authored under', async () => {
    const user = userEvent.setup()
    const mixedTask = {
      taskType: 'code_arrange',
      moduleType: 'python',
      lines: [
        { id: 'L1', parts: [{ type: 'slot', id: 'L1', code: 'total = 0' }] },
        {
          id: 'L2',
          parts: [
            { type: 'text', text: 'for i in range(' },
            { type: 'slot', id: 'S1', code: '5' },
            { type: 'text', text: '):' },
          ],
        },
      ],
    }
    let answer = {}
    const onSelectAnswer = vi.fn(next => { answer = next })
    const { rerender } = render(
      <CodeArrangeTask task={mixedTask} moduleType="python" selectedAnswer={answer} onSelectAnswer={onSelectAnswer} />
    )

    // S1's own correct tile ("5") tapped, then placed into L1's whole-line
    // slot (the first "Tap to place" target — L1 renders before L2) instead
    // of its own blank.
    await user.click(screen.getByText('5'))
    rerender(<CodeArrangeTask task={mixedTask} moduleType="python" selectedAnswer={answer} onSelectAnswer={onSelectAnswer} />)
    await user.click(screen.getAllByText('Tap to place')[0])

    expect(onSelectAnswer).toHaveBeenLastCalledWith({ L1: 'S1' })
  })
})
