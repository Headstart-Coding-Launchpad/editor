import { fireEvent, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BinaryStudentView } from '../ui.jsx'
import binary from '../definition.js'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'

const base = { id: 1, taskType: 'activity', activityType: 'binary' }

function renderBinary(task, options = {}) {
  return renderActivityUi(BinaryStudentView, {
    task,
    initialState: binary.initialState(task),
    ...options,
  })
}

describe('Binary UI: overflow', () => {
  const task = { ...base, mode: 'overflow', bits: 4, items: [{ id: 'a', a: '1100', b: '0110' }] }

  it('sets the truncated bits and answers the overflow question', async () => {
    const { state } = renderBinary(task)
    expect(screen.getByText('Add these two binary numbers. Did it overflow?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch', { name: 'Answer 2 column' }))
    const yes = screen.getByRole('button', { name: 'Yes' })
    expect(yes).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(yes)
    expect(yes).toHaveAttribute('aria-pressed', 'true')
    expect(state().items.a).toEqual({ bits: '0010', carries: '0000', overflow: 'yes' })
    await waitFor(() => expect(binary.grade(task, state()).passed).toBe(true))
  })

  it('explains the lost carry when the student says no', async () => {
    renderBinary(task)
    fireEvent.click(screen.getByRole('switch', { name: 'Answer 2 column' }))
    fireEvent.click(screen.getByRole('button', { name: 'No' }))
    fireEvent.click(screen.getByRole('button', { name: 'Check answers' }))
    expect(await screen.findByText(/so it was lost. That is an overflow./)).toBeInTheDocument()
  })
})

describe('Binary UI: hex', () => {
  const task = {
    ...base,
    mode: 'hex',
    bits: 8,
    items: [
      { id: 'a', value: '00101111', from: 'binary', to: 'hex' },
      { id: 'b', value: '3C', from: 'hex', to: 'binary' },
      { id: 'c', value: 'ff', from: 'hex', to: 'decimal' },
    ],
  }

  it('groups binary bits in nibbles and accepts hex in any case', async () => {
    const { container, state } = renderBinary(task)
    expect(screen.getByText('Change this binary number to hex')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-nibble-start]')).toHaveLength(1)
    const input = screen.getByLabelText('Your answer in hex')
    fireEvent.change(input, { target: { value: '2f!' } })
    expect(state().items.a.answer).toBe('2f')
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    expect(screen.getByTestId('hex-value')).toHaveTextContent('3C')
    const switches = screen.getAllByRole('switch')
    expect(switches).toHaveLength(8)
    fireEvent.click(switches[2])
    fireEvent.click(switches[3])
    fireEvent.click(switches[4])
    fireEvent.click(switches[5])
    expect(state().items.b.bits).toBe('00111100')
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    fireEvent.change(screen.getByLabelText('Your answer in decimal'), {
      target: { value: '255' },
    })
    await waitFor(() => expect(binary.grade(task, state()).passed).toBe(true))
  })
})

describe('Binary UI: ascii', () => {
  const task = {
    ...base,
    mode: 'ascii',
    showTable: true,
    items: [
      { id: 'a', text: 'Hi', direction: 'encode' },
      { id: 'b', text: 'OK', direction: 'decode' },
    ],
  }

  it('types an 8-bit code per character, digits 0/1 only', () => {
    const { state } = renderBinary(task)
    const first = screen.getByLabelText('Code for character 1, "H"')
    fireEvent.change(first, { target: { value: '0100a1000' } })
    expect(state().items.a.codes).toEqual(['01001000', ''])
    fireEvent.change(screen.getByLabelText('Code for character 2, "i"'), {
      target: { value: '01101001' },
    })
    expect(binary.grade(task, state()).itemResults.a).toBe(true)
  })

  it('shows the lookup table and decodes codes into text', () => {
    const { state } = renderBinary(task)
    expect(screen.getByText('ASCII table')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem', { hidden: true }).length).toBeGreaterThanOrEqual(95)
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    expect(screen.getByText('01001111')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Your decoded text'), { target: { value: 'OK' } })
    expect(state().items.b.answer).toBe('OK')
  })

  it('uses decimal codes when codeFormat is decimal', () => {
    const { state } = renderBinary({ ...task, codeFormat: 'decimal', showTable: false })
    expect(screen.queryByText('ASCII table')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Code for character 1, "H"'), {
      target: { value: '72x' },
    })
    expect(state().items.a.codes[0]).toBe('72')
  })
})

describe('Binary UI: pixels', () => {
  const task = {
    ...base,
    mode: 'pixels',
    width: 3,
    height: 2,
    items: [
      { id: 'a', rows: ['010', '101'], direction: 'draw' },
      { id: 'b', rows: ['110', '011'], direction: 'encode' },
    ],
  }

  it('draws by clicking cells, with arrow keys moving across the grid', async () => {
    const { state } = renderBinary(task)
    expect(screen.getByText('Draw the picture: fill the squares that are 1')).toBeInTheDocument()
    // The rows to draw from are shown beside the grid.
    expect(screen.getByTestId('pixel-codes')).toHaveTextContent('010101')
    expect(screen.getByLabelText('Row 2 bits: 101')).toBeInTheDocument()
    const cell = (r, c) => screen.getByRole('switch', { name: `Row ${r}, column ${c}` })
    expect(screen.getAllByRole('switch')).toHaveLength(6)
    fireEvent.click(cell(1, 2))
    expect(cell(1, 2)).toHaveAttribute('aria-checked', 'true')
    cell(1, 2).focus()
    fireEvent.keyDown(cell(1, 2), { key: 'ArrowDown' })
    expect(document.activeElement).toBe(cell(2, 2))
    fireEvent.keyDown(cell(2, 2), { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(cell(2, 1))
    fireEvent.keyDown(cell(2, 1), { key: 'ArrowLeft' })
    expect(document.activeElement).toBe(cell(2, 1))
    fireEvent.click(cell(2, 1))
    fireEvent.click(cell(2, 3))
    expect(state().items.a.cells).toEqual(['010', '101'])
    await waitFor(() => expect(binary.grade(task, state()).itemResults.a).toBe(true))
  })

  it('shows a picture and takes typed rows in encode mode', () => {
    const { state } = renderBinary(task)
    fireEvent.click(screen.getByRole('button', { name: /Next/ }))
    expect(screen.getByRole('img', { name: 'Row 1, column 1: filled' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Row 1, column 3: empty' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Row 1 bits'), { target: { value: '1102' } })
    fireEvent.change(screen.getByLabelText('Row 2 bits'), { target: { value: '011' } })
    expect(state().items.b.rows).toEqual(['110', '011'])
  })

  it('is read-only for a teacher view', () => {
    renderBinary(task, { readOnly: true, initialState: binary.solutionState(task) })
    for (const cell of screen.getAllByRole('switch')) expect(cell).toBeDisabled()
    expect(
      screen.getAllByRole('switch').filter((c) => c.getAttribute('aria-checked') === 'true')
    ).toHaveLength(3)
    expect(screen.getByText('Correct')).toBeInTheDocument()
  })
})
