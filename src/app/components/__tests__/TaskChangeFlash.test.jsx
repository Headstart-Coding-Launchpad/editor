import React from 'react'
import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import TaskChangeFlash from '../TaskChangeFlash'
import { MOTION_MS } from '../../../shared/motion'

describe('TaskChangeFlash', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows nothing on first mount', () => {
    render(<TaskChangeFlash taskKey="t1" number={1} title="Intro" />)
    expect(screen.queryByTestId('task-change-flash')).toBeNull()
    expect(screen.getByTestId('task-change-flash-live').textContent).toBe('')
  })

  it('flashes the number and title when the task changes, and announces it politely', () => {
    const { rerender } = render(<TaskChangeFlash taskKey="t3" number={3} title="Loops" />)
    rerender(<TaskChangeFlash taskKey="t4" number={4} title="Loops with lists" />)

    const band = screen.getByTestId('task-change-flash')
    expect(band.textContent).toBe('Task 4 · Loops with lists')
    expect(band.closest('[aria-hidden="true"]')).not.toBeNull()
    const live = screen.getByTestId('task-change-flash-live')
    expect(live.getAttribute('aria-live')).toBe('polite')
    expect(live.textContent).toBe('Now on task 4: Loops with lists')
  })

  it('falls back to just the number for an untitled task', () => {
    const { rerender } = render(<TaskChangeFlash taskKey="t1" number={1} title="A" />)
    rerender(<TaskChangeFlash taskKey="t2" number={2} />)
    expect(screen.getByTestId('task-change-flash').textContent).toBe('Task 2')
    expect(screen.getByTestId('task-change-flash-live').textContent).toBe('Now on task 2')
  })

  it('goes away after its animation length', () => {
    const { rerender } = render(<TaskChangeFlash taskKey="t1" number={1} title="A" />)
    rerender(<TaskChangeFlash taskKey="t2" number={2} title="B" />)
    expect(screen.getByTestId('task-change-flash')).toBeTruthy()
    act(() => {
      vi.advanceTimersByTime(MOTION_MS.taskFlash)
    })
    expect(screen.queryByTestId('task-change-flash')).toBeNull()
  })

  it('does not flash when the session loads after mount (no task, then a task)', () => {
    const { rerender } = render(<TaskChangeFlash taskKey={null} number={0} />)
    rerender(<TaskChangeFlash taskKey="t1" number={1} title="Intro" />)
    expect(screen.queryByTestId('task-change-flash')).toBeNull()
  })

  it('does not flash when the same task is restored or only the title changes', () => {
    const { rerender } = render(<TaskChangeFlash taskKey="t1" number={1} title="Intro" />)
    rerender(<TaskChangeFlash taskKey="t1" number={1} title="Intro (edited)" />)
    expect(screen.queryByTestId('task-change-flash')).toBeNull()
  })

  it('does not flash when disabled (solo, preview), and enabling later is not a change', () => {
    const { rerender } = render(
      <TaskChangeFlash taskKey="t1" number={1} title="A" enabled={false} />
    )
    rerender(<TaskChangeFlash taskKey="t2" number={2} title="B" enabled={false} />)
    expect(screen.queryByTestId('task-change-flash')).toBeNull()
    rerender(<TaskChangeFlash taskKey="t2" number={2} title="B" enabled />)
    expect(screen.queryByTestId('task-change-flash')).toBeNull()
  })

  it('stays quiet when the student browses back (the key is the class task, which is unchanged)', () => {
    // StudentView passes currentTaskId, not viewingTaskId, so viewing an earlier task leaves the
    // key as it was; the number and title props may differ without a flash.
    const { rerender } = render(<TaskChangeFlash taskKey="t4" number={4} title="Four" />)
    rerender(<TaskChangeFlash taskKey="t4" number={4} title="Four" />)
    expect(screen.queryByTestId('task-change-flash')).toBeNull()
  })

  it('uses the one band class, which the stylesheet turns into a fade under reduced motion', () => {
    const { rerender } = render(<TaskChangeFlash taskKey="t1" number={1} title="A" />)
    rerender(<TaskChangeFlash taskKey="t2" number={2} title="B" />)
    // jsdom can't evaluate the media query; the reduced-motion variant is the same element with
    // a different animation-name in index.css, so the class is what must stay stable.
    expect(screen.getByTestId('task-change-flash').className).toBe('task-change-flash')
  })
})
