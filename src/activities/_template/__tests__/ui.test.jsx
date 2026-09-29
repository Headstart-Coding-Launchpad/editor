import { fireEvent, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TemplateActivityStudentView } from '../ui.jsx'
import definition from '../definition.js'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'

// UI tests for the Template Activity StudentView with local state (src/test/activityUiHarness.jsx).
// jsdom can't prove pointer, drag or touch behaviour: check those in a real browser too.
// TODO(new-activity): cover every control, keyboard use, readOnly and the device fallbacks.

const TASK = {
  id: 1,
  taskType: 'activity',
  activityType: 'template_activity',
  items: [
    { id: 'a', prompt: 'What is 2 + 2?', answer: '4' },
    { id: 'b', prompt: 'Name the colour of grass.', answer: 'green' },
  ],
}

function renderView(options = {}) {
  return renderActivityUi(TemplateActivityStudentView, {
    task: TASK,
    initialState: definition.initialState(TASK),
    ...options,
  })
}

describe('Template Activity UI', () => {
  it('stores what the student types for the current item', () => {
    const { state } = renderView()
    expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: '4' } })
    expect(state().items).toEqual({ a: { answer: '4' }, b: { answer: '' } })
  })

  it('checks, shows a hint for a wrong item and jumps to it', async () => {
    const { onSubmit } = renderView()
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check answers' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/Type your answer first/)).toBeInTheDocument()
    expect(screen.getByText('Name the colour of grass.')).toBeInTheDocument()
    // The hint clears as soon as the student changes the item.
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'g' } })
    expect(screen.queryByText(/Type your answer first/)).not.toBeInTheDocument()
  })

  it('submits with Enter', async () => {
    const { onSubmit } = renderView()
    fireEvent.keyDown(screen.getByLabelText('Your answer'), { key: 'Enter' })
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/Type your answer first/)).toBeInTheDocument()
  })

  it('is read-only for a teacher view', () => {
    renderView({ readOnly: true, initialState: definition.solutionState(TASK) })
    expect(screen.getByLabelText('Your answer')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Check answers' })).not.toBeInTheDocument()
    expect(screen.getByText('✓ Correct')).toBeInTheDocument()
  })
})
