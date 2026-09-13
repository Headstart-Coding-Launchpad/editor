import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
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
})
