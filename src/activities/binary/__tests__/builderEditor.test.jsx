import React from 'react'
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import definition from '../definition.js'
import ui from '../ui.jsx'
import { BINARY_MODES } from '../binary.js'
import { changeBinaryMode, resizePixelRows } from '../BinaryBuilderEditor.jsx'
import { renderBuilderEditor } from '../../../test/activityBuilderHarness.jsx'

const errorsOf = (task) => definition.validateTask(task, { n: 1 }).errors

function start(overrides = {}) {
  return { ...definition.defaultTask({ id: 1, title: 'Bits' }), ...overrides }
}

describe('Binary BuilderEditor', () => {
  it('is registered as the binary UI BuilderEditor', () => {
    expect(typeof ui.BuilderEditor).toBe('function')
  })

  it.each(BINARY_MODES)('switching to %s gives a valid task', (mode) => {
    const next = changeBinaryMode(start(), mode)
    expect(next.mode).toBe(mode)
    expect(next.items.map((item) => item.id)).toEqual(['a'])
    expect(errorsOf(next)).toEqual([])
  })

  it('edits bits, a target and adds an item, staying valid', async () => {
    const user = userEvent.setup()
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())

    fireEvent.change(screen.getByLabelText('Bits'), { target: { value: '4' } })
    fireEvent.change(screen.getByLabelText('Item 1 target'), { target: { value: '12' } })
    await user.click(screen.getByRole('button', { name: '+ Add item' }))

    expect(task()).toMatchObject({
      bits: 4,
      items: [
        { id: 'a', target: 12 },
        { id: 'b', target: 1 },
      ],
    })
    expect(errorsOf(task())).toEqual([])
  })

  it('shows validation errors inline, next to the item they are about', () => {
    renderBuilderEditor(ui.BuilderEditor, start({ bits: 4 }))
    fireEvent.change(screen.getByLabelText('Item 1 target'), { target: { value: '99' } })

    const row = screen.getByLabelText('Item 1 target').closest('.te-act-row')
    expect(within(row).getByRole('alert')).toHaveTextContent(
      'target must be a whole number from 0 to 15.'
    )
  })

  it('reports task-level errors at the top (bits out of range)', () => {
    renderBuilderEditor(ui.BuilderEditor, start())
    fireEvent.change(screen.getByLabelText('Bits'), { target: { value: '20' } })
    expect(screen.getByRole('alert')).toHaveTextContent('binary bits must be a whole number')
  })

  it('sets the display options for the mode', async () => {
    const user = userEvent.setup()
    const { task } = renderBuilderEditor(ui.BuilderEditor, start())

    fireEvent.change(screen.getByLabelText('Binary mode'), { target: { value: 'add' } })
    await user.click(screen.getByLabelText('Carries must be filled in'))
    fireEvent.change(screen.getByLabelText('Running decimal'), { target: { value: 'show' } })
    await user.click(screen.getByLabelText('Show place values'))
    expect(task()).toMatchObject({
      mode: 'add',
      requireCarries: true,
      showDecimal: true,
      showPlaceValues: false,
    })

    fireEvent.change(screen.getByLabelText('Binary mode'), { target: { value: 'ascii' } })
    expect(task().requireCarries).toBeUndefined()
    fireEvent.change(screen.getByLabelText('Code format'), { target: { value: 'decimal' } })
    await user.click(screen.getByLabelText('Show ASCII table'))
    fireEvent.change(screen.getByLabelText('Item 1 text'), { target: { value: 'OK!' } })
    fireEvent.change(screen.getByLabelText('Item 1 direction'), { target: { value: 'decode' } })
    expect(task()).toMatchObject({
      mode: 'ascii',
      codeFormat: 'decimal',
      showTable: true,
      items: [{ id: 'a', text: 'OK!', direction: 'decode' }],
    })
    expect(errorsOf(task())).toEqual([])
  })

  it('edits hex items', () => {
    const { task } = renderBuilderEditor(ui.BuilderEditor, changeBinaryMode(start(), 'hex'))
    fireEvent.change(screen.getByLabelText('Item 1 value'), { target: { value: '00101111' } })
    fireEvent.change(screen.getByLabelText('Item 1 from'), { target: { value: 'binary' } })
    fireEvent.change(screen.getByLabelText('Item 1 to'), { target: { value: 'hex' } })
    expect(task().items[0]).toEqual({ id: 'a', value: '00101111', from: 'binary', to: 'hex' })
    expect(errorsOf(task())).toEqual([])
  })

  it('draws a pixel picture with the grid editor and resizes it', async () => {
    const user = userEvent.setup()
    const { task } = renderBuilderEditor(ui.BuilderEditor, changeBinaryMode(start(), 'pixels'))
    expect(task()).toMatchObject({ width: 5, height: 5 })

    const grid = screen.getByRole('group', { name: 'Item 1 picture' })
    await user.click(within(grid).getByRole('button', { name: 'Row 1 square 2' }))
    await user.click(within(grid).getByRole('button', { name: 'Row 3 square 5' }))
    expect(task().items[0].rows).toEqual(['01000', '00000', '00001', '00000', '00000'])
    expect(within(grid).getByRole('button', { name: 'Row 1 square 2' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )

    fireEvent.change(screen.getByLabelText('Width'), { target: { value: '3' } })
    expect(task().items[0].rows).toEqual(['010', '000', '000', '000', '000'])
    fireEvent.change(screen.getByLabelText('Height'), { target: { value: '2' } })
    expect(task().items[0].rows).toEqual(['010', '000'])
    expect(errorsOf(task())).toEqual([])
  })

  it('resizePixelRows pads new squares with 0', () => {
    const task = { mode: 'pixels', width: 2, height: 1, items: [{ id: 'a', rows: ['11'] }] }
    expect(resizePixelRows(task, 3, 2).items[0].rows).toEqual(['110', '000'])
  })
})
