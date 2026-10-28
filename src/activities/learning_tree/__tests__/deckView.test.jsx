import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { countControls } from '../../../test/countControls.js'
import { LearningTreeStudentView } from '../ui.jsx'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'
import { normalizeState } from '../learning_tree.js'

const TASK = {
  id: 1,
  taskType: 'activity',
  activityType: 'learning_tree',
  labels: ["I'd eat it", 'No thanks'],
  studentLabels: true,
  twentyQuestions: true,
  deck: [
    { name: 'Doughnut', emoji: '🍩', yes: ['is_sweet', 'is_fried'] },
    { name: 'Cake', emoji: '🍰', yes: ['is_sweet'] },
    { name: 'Apple', emoji: '🍎', yes: ['is_sweet', 'is_crunchy'] },
    { name: 'Chips', emoji: '🍟', yes: ['is_fried', 'is_crunchy'] },
    { name: 'Sprouts', emoji: '🥦', yes: ['is_crunchy'] },
    { name: 'Liver', emoji: '🥩', yes: [] },
  ],
  testItems: [
    { name: 'Cookie', emoji: '🍪', yes: ['is_sweet', 'is_crunchy'], label: "I'd eat it" },
    { name: 'Olive', emoji: '🫒', yes: [], label: 'No thanks' },
  ],
  passAt: 2,
}

function renderView(task = TASK, initialState = { v: 1 }) {
  return renderActivityUi(LearningTreeStudentView, { task, initialState })
}

// Tap a card, then tap the bin.
function sort(card, bin) {
  fireEvent.click(screen.getByRole('button', { name: card }))
  fireEvent.click(screen.getByRole('button', { name: `Put in ${bin}` }))
}

describe('Learning Tree deck screen', () => {
  it('has at most 5 controls, even with renamable bins and 20 Questions', () => {
    const { container } = renderView()
    expect(countControls(container)).toBeLessThanOrEqual(5)
    sort('Doughnut', "I'd eat it")
    sort('Liver', 'No thanks')
    expect(countControls(container)).toBeLessThanOrEqual(5)
  })

  it('tap a card then a bin sorts it and the tree regrows; a card can go back to the deck', () => {
    const { state } = renderView()
    sort('Doughnut', "I'd eat it")
    sort('Liver', 'No thanks')
    expect(state().b).toBe('0----1')
    expect(screen.getByTestId('lt-tree')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: "Doughnut in I'd eat it" }))
    fireEvent.click(screen.getByRole('button', { name: /Back to the deck/ }))
    expect(state().b).toBe('-----1')
  })

  it('shows Play 20 Questions only with 2 cards binned, then plays a round', () => {
    const { state } = renderView()
    expect(screen.queryByRole('button', { name: /Play 20 Questions/ })).not.toBeInTheDocument()
    sort('Doughnut', "I'd eat it")
    sort('Cake', "I'd eat it")
    sort('Apple', "I'd eat it")
    sort('Liver', 'No thanks')
    sort('Sprouts', 'No thanks')
    fireEvent.click(screen.getByRole('button', { name: /Play 20 Questions/ }))
    // Cookie is sweet: the tree asks about sweetness, wrong answer is refused.
    expect(screen.getByTestId('lt-ask')).toHaveTextContent('is sweet?')
    fireEvent.click(screen.getByRole('button', { name: 'No' }))
    expect(screen.getByText(/Look at the card again/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }))
    expect(screen.getByTestId('lt-guess')).toHaveTextContent("I think: I'd eat it")
    fireEvent.click(screen.getByRole('button', { name: /Right/ }))
    expect(state().q).toBe('r-')
    fireEvent.click(screen.getByRole('button', { name: 'Next card' }))
    expect(screen.getByTestId('lt-play')).toHaveTextContent('Olive')
  })

  it('renames a bin and uses the new name on the tree', () => {
    renderView()
    sort('Doughnut', "I'd eat it")
    sort('Liver', 'No thanks')
    fireEvent.change(screen.getByLabelText('Name of bin 1'), { target: { value: 'Yum' } })
    expect(screen.getByRole('button', { name: 'Put in Yum' })).toBeInTheDocument()
  })

  it('says so when the binned cards cannot be split by any question', () => {
    renderView(
      {
        ...TASK,
        features: ['is_sweet'],
        deck: TASK.deck.map((c) => ({ ...c, yes: ['is_sweet'] })),
      },
      { v: 1 }
    )
    sort('Doughnut', "I'd eat it")
    sort('Cake', 'No thanks')
    expect(screen.getByText('It can only use the questions it was given.')).toBeInTheDocument()
  })

  it('read-only (tutor view) shows the sorted bins without controls to move cards', () => {
    const state = normalizeState(TASK, { v: 1, b: '0----1' })
    renderActivityUi(LearningTreeStudentView, { task: TASK, initialState: state, readOnly: true })
    expect(screen.queryByRole('button', { name: /Put in/ })).not.toBeInTheDocument()
    expect(screen.getByTestId('lt-bin-0')).toHaveTextContent('Doughnut')
  })
})
