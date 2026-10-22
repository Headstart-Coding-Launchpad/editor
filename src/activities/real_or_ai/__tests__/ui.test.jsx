import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RealOrAiStudentView } from '../ui.jsx'
import definition from '../definition.js'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'

const TASK = {
  id: 1,
  taskType: 'activity',
  activityType: 'real_or_ai',
  tells: ['hands', 'too_smooth', 'none_reliable'],
  items: [
    {
      id: 'p1',
      kind: 'image',
      a: 'images/real-1.jpg',
      b: 'https://example.com/ai-1.jpg',
      altB: 'A smiling woman holding a mug',
      answer: 'b',
      tell: 'hands',
      reliable: false,
      reveal: 'Newer models get hands right.',
    },
    {
      id: 'p2',
      kind: 'text',
      a: 'Human text',
      b: 'Robot text',
      answer: 'a',
      tell: 'too_smooth',
      reliable: true,
      reveal: 'Very even wording.',
    },
  ],
}

function renderView(options = {}) {
  return renderActivityUi(RealOrAiStudentView, {
    task: TASK,
    initialState: definition.initialState(TASK),
    ...options,
  })
}

const click = (name) => fireEvent.click(screen.getByRole('button', { name }))

describe('Real or AI UI', () => {
  it('shows both pictures with alt text and resolves relative paths', () => {
    render(
      <RealOrAiStudentView
        task={TASK}
        state={definition.initialState(TASK)}
        assetsPath="https://host/assets"
      />
    )
    expect(screen.getByAltText('Picture A')).toHaveAttribute(
      'src',
      'https://host/assets/images/real-1.jpg'
    )
    expect(screen.getByAltText('A smiling woman holding a mug')).toHaveAttribute(
      'src',
      'https://example.com/ai-1.jpg'
    )
  })

  it('saves the pick and the clue as they are chosen, before reveal', () => {
    const { state } = renderView()
    expect(screen.queryByText('What gave it away?')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reveal' })).not.toBeInTheDocument()
    click('Pick B as the AI one')
    expect(state().items.p1).toEqual({ pick: 'b', tell: '', done: false })
    expect(screen.getByRole('button', { name: 'Pick B as the AI one' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    expect(screen.getByText('✓ Your pick')).toBeInTheDocument()
    click('Hands')
    expect(state().items.p1).toEqual({ pick: 'b', tell: 'hands', done: false })
    expect(screen.queryByTestId('real_or_ai-reveal')).not.toBeInTheDocument()
  })

  it('reveals, locks the pair and updates the score', () => {
    const { state } = renderView()
    click('Pick B as the AI one')
    click('Hands')
    click('Reveal')
    expect(state().items.p1).toEqual({ pick: 'b', tell: 'hands', done: true })
    const reveal = screen.getByTestId('real_or_ai-reveal')
    expect(reveal).toHaveTextContent('Yes! B is the AI one.')
    expect(reveal).toHaveTextContent('Your clue matches: Hands.')
    expect(reveal).toHaveTextContent('not a reliable clue')
    expect(reveal).toHaveTextContent('Newer models get hands right.')
    expect(screen.getByText('🤖 Made by AI')).toBeInTheDocument()
    expect(screen.getByText('Score: 1 right out of 1 done (2 pairs)')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pick A as the AI one' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Too smooth/ })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Reveal' })).not.toBeInTheDocument()
  })

  it('goes to the next pair and finishes with the score', () => {
    const { state } = renderView()
    click('Pick A as the AI one')
    click('Too smooth')
    click('Reveal')
    expect(screen.getByTestId('real_or_ai-reveal')).toHaveTextContent('Not this time.')
    click('Next pair →')
    expect(screen.getByText('Which text was written by AI?')).toBeInTheDocument()
    click('Pick A as the AI one')
    click('Too smooth')
    click('Reveal')
    expect(state().items.p2.done).toBe(true)
    expect(screen.getByText(/All done! You spotted 1 of 2/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Next pair →' })).not.toBeInTheDocument()
  })

  it('uses real buttons so it works from the keyboard', () => {
    renderView()
    const pick = screen.getByRole('button', { name: 'Pick A as the AI one' })
    expect(pick.tagName).toBe('BUTTON')
    pick.focus()
    expect(pick).toHaveFocus()
  })

  it('is read-only for a review view', () => {
    renderView({ readOnly: true, initialState: definition.solutionState(TASK) })
    expect(screen.getByRole('button', { name: 'Pick B as the AI one' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Reveal' })).not.toBeInTheDocument()
    expect(screen.getByTestId('real_or_ai-reveal')).toBeInTheDocument()
  })

  it("shows the tutor the student's picks and the key before the pair is revealed", () => {
    const state = {
      v: 1,
      items: {
        p1: { pick: 'a', tell: 'hands', done: false },
        p2: { pick: '', tell: '', done: false },
      },
    }
    render(<RealOrAiStudentView task={TASK} state={state} readOnly teacher />)
    const note = screen.getByTestId('real_or_ai-teacher-note')
    expect(note).toHaveTextContent('Student has picked A and the clue "Hands". Not revealed yet.')
    expect(note).toHaveTextContent('Key: B is AI, clue "Hands", not reliable.')
    expect(screen.getByText("✓ Student's pick")).toBeInTheDocument()
    expect(screen.queryByTestId('real_or_ai-reveal')).not.toBeInTheDocument()
  })

  it('lets a tutor edit the answers when not read-only', () => {
    const { state } = renderActivityUi((props) => <RealOrAiStudentView {...props} teacher />, {
      task: TASK,
      initialState: definition.initialState(TASK),
    })
    click('Pick B as the AI one')
    expect(state().items.p1.pick).toBe('b')
  })
})
