import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { DesktopCheckListEditor } from '../desktopEditors.jsx'

describe('DesktopCheckListEditor', () => {
  it('offers the filesystem check types alongside the desktop ones', () => {
    render(
      <DesktopCheckListEditor
        checks={[{ type: 'fs_path', operator: 'exists', itemType: 'file', path: '' }]}
        onChange={vi.fn()}
      />
    )

    const [typeSelect, operatorSelect] = screen.getAllByRole('combobox')
    const typeLabels = within(typeSelect)
      .getAllByRole('option')
      .map((o) => o.textContent)
    expect(typeLabels).toEqual(
      expect.arrayContaining(['Filesystem path', 'File content', 'Recycle Bin', 'Window state'])
    )
    expect(typeSelect).toHaveValue('fs_path')

    const operators = within(operatorSelect)
      .getAllByRole('option')
      .map((o) => o.textContent)
    expect(operators).toEqual(['exists', 'not exists'])
  })

  it('switches a check to an input check with sensible defaults and no operator', () => {
    const onChange = vi.fn()
    render(
      <DesktopCheckListEditor
        checks={[{ type: 'fs_path', operator: 'exists', itemType: 'file', path: '', hint: 'h' }]}
        onChange={onChange}
      />
    )
    const [typeSelect] = screen.getAllByRole('combobox')
    fireEvent.change(typeSelect, { target: { value: 'input_gesture' } })
    expect(onChange).toHaveBeenLastCalledWith([
      { type: 'input_gesture', gesture: 'double_click', hint: 'h' },
    ])
    fireEvent.change(typeSelect, { target: { value: 'input_shortcut' } })
    expect(onChange.mock.lastCall[0][0]).toMatchObject({ combo: 'ctrl+c', via: 'keyboard' })
    expect(onChange.mock.lastCall[0][0]).not.toHaveProperty('operator')
  })

  it('edits input_gesture fields (drop target only for drags)', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <DesktopCheckListEditor
        checks={[{ type: 'input_gesture', gesture: 'double_click' }]}
        onChange={onChange}
      />
    )
    expect(screen.queryByLabelText('Drop target')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Gesture target'), { target: { value: 'file' } })
    expect(onChange.mock.lastCall[0][0]).toMatchObject({ targetKind: 'file' })
    fireEvent.change(screen.getByLabelText('At least (times)'), { target: { value: '2' } })
    expect(onChange.mock.lastCall[0][0]).toMatchObject({ min: 2 })

    rerender(
      <DesktopCheckListEditor
        checks={[{ type: 'input_gesture', gesture: 'drag', targetKind: 'file' }]}
        onChange={onChange}
      />
    )
    fireEvent.change(screen.getByLabelText('Drop target'), { target: { value: 'folder' } })
    expect(onChange.mock.lastCall[0][0]).toEqual({
      type: 'input_gesture',
      gesture: 'drag',
      targetKind: 'file',
      dropTargetKind: 'folder',
    })
  })

  it('edits input_shortcut and input_modifier fields', () => {
    const onChange = vi.fn()
    const { rerender } = render(
      <DesktopCheckListEditor
        checks={[{ type: 'input_shortcut', combo: 'ctrl+c', via: 'keyboard' }]}
        onChange={onChange}
      />
    )
    fireEvent.change(screen.getByLabelText('Shortcut'), { target: { value: 'ctrl+v' } })
    expect(onChange.mock.lastCall[0][0]).toMatchObject({ combo: 'ctrl+v' })
    fireEvent.change(screen.getByLabelText('Shortcut used from'), { target: { value: 'menu' } })
    expect(onChange.mock.lastCall[0][0]).toMatchObject({ via: 'menu' })

    rerender(
      <DesktopCheckListEditor
        checks={[{ type: 'input_modifier', modifier: 'shift' }]}
        onChange={onChange}
      />
    )
    fireEvent.click(screen.getByLabelText('Fail if Caps Lock was used for a capital'))
    expect(onChange.mock.lastCall[0][0]).toMatchObject({ notCapsLock: true })
  })
})
