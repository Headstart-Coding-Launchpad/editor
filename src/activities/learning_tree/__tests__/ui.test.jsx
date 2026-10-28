import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LearningTreeStudentView } from '../ui.jsx'
import definition from '../definition.js'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'

// UI tests for the Learning Tree StudentView with local state (src/test/activityUiHarness.jsx).
// jsdom can't prove touch behaviour: check that in a real browser too.

const TASK = definition.defaultTask({ id: 1 })

function renderView(options = {}) {
  return renderActivityUi(LearningTreeStudentView, {
    task: TASK,
    initialState: definition.initialState(TASK),
    ...options,
  })
}

function addExample(name, features, label) {
  fireEvent.change(screen.getByLabelText('Item name'), { target: { value: name } })
  for (const f of features) fireEvent.click(screen.getByRole('button', { name: f }))
  fireEvent.click(screen.getByRole('radio', { name: label }))
  fireEvent.click(screen.getByRole('button', { name: 'Add example' }))
}

describe('Learning Tree UI', () => {
  it('starts empty with Add example and Try it disabled', () => {
    renderView()
    expect(screen.getByText('Add examples and the tree grows by itself.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add example' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Try it on new things' })).toBeDisabled()
  })

  it('needs a label before an example can be added, then stores it and resets the form', () => {
    const { state } = renderView()
    fireEvent.change(screen.getByLabelText('Item name'), { target: { value: 'cat' } })
    fireEvent.click(screen.getByRole('button', { name: 'has fur?' }))
    expect(screen.getByRole('button', { name: 'Add example' })).toBeDisabled()
    fireEvent.click(screen.getByRole('radio', { name: 'pet' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add example' }))
    expect(state().examples).toEqual([{ n: 'cat', f: '100', l: 0 }])
    expect(screen.getByLabelText('Item name')).toHaveValue('')
    expect(screen.getByRole('button', { name: 'has fur?' })).toHaveAttribute(
      'aria-pressed',
      'false'
    )
  })

  it('draws the tree and redraws it when an example is added or removed', () => {
    renderView()
    addExample('cat', ['has fur?'], 'pet')
    expect(screen.getAllByTestId('lt-leaf')).toHaveLength(1)
    addExample('owl', ['can fly?'], 'wild')
    expect(screen.getAllByTestId('lt-question')).toHaveLength(1)
    expect(screen.getAllByTestId('lt-leaf')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Remove owl' }))
    expect(screen.queryByTestId('lt-question')).not.toBeInTheDocument()
  })

  it('tries the tree on the test items and shows right and wrong', () => {
    const { state } = renderView()
    addExample('cat', ['has fur?'], 'pet')
    addExample('dog', ['has fur?'], 'pet')
    addExample('owl', ['can fly?'], 'wild')
    addExample('whale', ['lives in water?'], 'wild')
    fireEvent.click(screen.getByRole('button', { name: 'Try it on new things' }))
    expect(state().tried).toBe(true)
    expect(screen.getByText('Your tree got 4 of 5 right')).toBeInTheDocument()
    expect(screen.getByText(/Goldfish: tree says wild/)).toBeInTheDocument()
    expect(screen.getByText('Your tree works!')).toBeInTheDocument()
  })

  it('clears the Try it result when an example changes', () => {
    const { state } = renderView()
    addExample('cat', ['has fur?'], 'pet')
    fireEvent.click(screen.getByRole('button', { name: 'Try it on new things' }))
    expect(state().tried).toBe(true)
    addExample('owl', ['can fly?'], 'wild')
    expect(state().tried).toBe(false)
    expect(screen.queryByTestId('lt-results')).not.toBeInTheDocument()
  })

  it('stops at maxExamples', () => {
    renderView({ task: { ...TASK, maxExamples: 4 } })
    for (let i = 0; i < 4; i += 1) addExample(`a${i}`, [], 'pet')
    expect(screen.getByText(/4 of 4 \(full\)/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add example' })).toBeDisabled()
  })

  it('is read-only for the tutor: examples, tree and results, no controls', () => {
    const initialState = {
      v: 1,
      tried: true,
      examples: [
        { n: 'cat', f: '100', l: 0 },
        { n: 'owl', f: '010', l: 1 },
      ],
    }
    renderView({ readOnly: true, initialState })
    expect(screen.getByText('cat')).toBeInTheDocument()
    expect(screen.getByTestId('lt-tree')).toBeInTheDocument()
    expect(screen.getByTestId('lt-results')).toBeInTheDocument()
    expect(screen.queryByLabelText('Item name')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add example' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Remove/ })).not.toBeInTheDocument()
  })
})
