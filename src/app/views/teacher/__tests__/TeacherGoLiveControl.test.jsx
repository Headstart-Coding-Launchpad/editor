import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TeacherGoLiveControl from '../TeacherGoLiveControl'

function setup(teacherLive) {
  const handlers = { onStart: vi.fn(), onStop: vi.fn(), onLayoutChange: vi.fn() }
  render(<TeacherGoLiveControl teacherLive={teacherLive} {...handlers} />)
  return handlers
}

describe('TeacherGoLiveControl', () => {
  it('starts Go Live when not live, with no chip or layout control', () => {
    const h = setup(null)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('group', { name: /layout/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Go Live/ }))
    expect(h.onStart).toHaveBeenCalledTimes(1)
  })

  it('shows the Live chip, Stop and the layout control while the dashboard is live', () => {
    const h = setup({ active: true, source: 'teacher', publisher: 'dashboard', layout: 'code' })
    expect(screen.getByRole('status').textContent).toContain('Live')
    expect(screen.getByRole('button', { name: 'Code' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Explainer' }))
    expect(h.onLayoutChange).toHaveBeenCalledWith('explainer')
    fireEvent.click(screen.getByRole('button', { name: /Stop live/ }))
    expect(h.onStop).toHaveBeenCalledTimes(1)
  })

  it('also offers Stop for a pop-up Go Live, without the dashboard layout control', () => {
    const h = setup({ active: true, source: 'teacher', publisher: 'presentation' })
    fireEvent.click(screen.getByRole('button', { name: /Stop live/ }))
    expect(h.onStop).toHaveBeenCalled()
    expect(screen.queryByRole('group', { name: /layout/i })).toBeNull()
  })

  it('cannot start over a student broadcast', () => {
    setup({ active: true, source: 'student', sourceStudentId: 's1' })
    expect(screen.getByRole('button', { name: /Go Live/ }).disabled).toBe(true)
  })
})
