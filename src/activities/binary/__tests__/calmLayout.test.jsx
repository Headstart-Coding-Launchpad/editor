import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BinaryStudentView } from '../ui.jsx'
import binary from '../definition.js'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'

// The calm Binary screen (sketch OK'd 21 Nov 2026): the target shown once as a big tile, big
// bit boxes with no "Bits" label, the live number in a circle and, in make-the-number mode
// only, the worked sum ("4 + 1 = 5"). In to_binary the sum would give the answer away.
const TASK = {
  id: 1,
  taskType: 'activity',
  activityType: 'binary',
  mode: 'make_number',
  bits: 4,
  items: [{ id: 'a', target: 5 }],
}

function renderBinary(task) {
  return renderActivityUi(BinaryStudentView, { task, initialState: binary.initialState(task) })
}

const flip = (place) =>
  fireEvent.click(screen.getByRole('switch', { name: `Bits ${place} column` }))

describe('Binary calm layout', () => {
  it('make the number: target once, big boxes, live number and the worked sum', () => {
    renderBinary(TASK)
    expect(screen.getByTestId('binary-prompt')).toHaveTextContent('Make the number 5')
    expect(screen.getByTestId('binary-target')).toHaveTextContent('5')
    expect(screen.getAllByText(/Make the number/)).toHaveLength(1)
    expect(screen.queryByText('Bits')).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Bits' })).toHaveClass('act-bits--big')
    expect(screen.getByTestId('worked-sum')).toHaveTextContent('all off = 0')
    flip(4)
    flip(1)
    expect(screen.getByTestId('live-decimal')).toHaveTextContent('5')
    expect(screen.getByTestId('live-decimal')).toHaveClass('act-binary-number--right')
    expect(screen.getByTestId('worked-sum')).toHaveTextContent('4 + 1 = 5')
  })

  it('to_binary never shows the worked sum, even when the author shows the number', () => {
    renderBinary({ ...TASK, mode: 'to_binary', showDecimal: true })
    expect(screen.getByTestId('binary-prompt')).toHaveTextContent('Write 5 in binary')
    flip(4)
    expect(screen.getByTestId('live-decimal')).toHaveTextContent('4')
    expect(screen.queryByTestId('worked-sum')).not.toBeInTheDocument()
  })

  it('other modes keep the normal bit size', () => {
    renderBinary({ ...TASK, mode: 'add', items: [{ id: 'a', a: '0011', b: '0001' }] })
    expect(screen.getByRole('group', { name: 'Answer' })).not.toHaveClass('act-bits--big')
  })
})
