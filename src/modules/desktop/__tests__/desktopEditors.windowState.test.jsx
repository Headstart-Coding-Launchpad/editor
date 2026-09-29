import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DesktopCheckListEditor } from '../desktopEditors.jsx'

describe('DesktopCheckListEditor window_state geometry', () => {
  it('shows a zone picker only for moved_to', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <DesktopCheckListEditor
        checks={[{ type: 'window_state', operator: 'opened', appId: 'textEditor' }]}
        onChange={onChange}
      />
    )
    expect(screen.queryByLabelText('Zone')).toBeNull()

    rerender(
      <DesktopCheckListEditor
        checks={[{ type: 'window_state', operator: 'moved_to', appId: 'textEditor' }]}
        onChange={onChange}
      />
    )
    fireEvent.change(screen.getByLabelText('Zone'), { target: { value: 'right_half' } })
    expect(onChange.mock.lastCall[0][0]).toMatchObject({ operator: 'moved_to', zone: 'right_half' })
  })

  it('edits resized size and fractional limits', () => {
    const onChange = vi.fn()
    render(
      <DesktopCheckListEditor
        checks={[{ type: 'window_state', operator: 'resized', appId: 'browser' }]}
        onChange={onChange}
      />
    )
    fireEvent.change(screen.getByLabelText('Size'), { target: { value: 'smaller' } })
    expect(onChange.mock.lastCall[0][0]).toMatchObject({ size: 'smaller' })
    fireEvent.change(screen.getByLabelText('maxWidth'), { target: { value: '0.5' } })
    expect(onChange.mock.lastCall[0][0]).toMatchObject({ maxWidth: 0.5 })
    expect(screen.queryByLabelText('Zone')).toBeNull()
  })
})
