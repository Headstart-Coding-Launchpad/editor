import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const loadStageTarget = vi.fn()
vi.mock('../../../../modules/python/stageTarget.js', () => ({
  getCachedStageTarget: () => null,
  loadStageTarget: (...args) => loadStageTarget(...args),
}))
vi.mock('../../../../shared/stage/StagePane.jsx', () => ({
  default: () => <div data-testid="stage-pane" />,
}))

import StageTargetPreview from '../StageTargetPreview'

beforeEach(() => {
  vi.useFakeTimers()
  loadStageTarget.mockReset()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('StageTargetPreview', () => {
  it('draws only the task the tutor stops on when stepping quickly', async () => {
    loadStageTarget.mockResolvedValue({ status: 'ok', commands: [] })
    const { rerender } = render(<StageTargetPreview code="a()" />)
    rerender(<StageTargetPreview code="b()" />)
    rerender(<StageTargetPreview code="c()" />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(loadStageTarget).toHaveBeenCalledTimes(1)
    expect(loadStageTarget).toHaveBeenCalledWith('c()')
    expect(screen.getByTestId('stage-pane')).toBeInTheDocument()
  })

  it('says plainly when the picture could not be drawn', async () => {
    loadStageTarget.mockRejectedValue(new Error('worker gone'))
    render(<StageTargetPreview code="a()" />)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000)
    })
    expect(screen.getByTestId('teacher-stage-target')).toHaveTextContent(
      'The picture could not be drawn just now'
    )
  })
})
