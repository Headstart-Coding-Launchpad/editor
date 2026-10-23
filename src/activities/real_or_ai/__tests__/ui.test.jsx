import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { RealOrAiStudentView, READ_MOMENT_MS } from '../ui.jsx'
import definition from '../definition.js'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'

const TASK = {
  id: 1,
  taskType: 'activity',
  activityType: 'real_or_ai',
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

const tap = (side) => fireEvent.click(screen.getByTestId(`real_or_ai-side-${side}`))
const click = (name) => fireEvent.click(screen.getByRole('button', { name }))

afterEach(() => {
  vi.useRealTimers()
})

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

  it('has no second question and no Reveal or Previous buttons', () => {
    renderView()
    expect(screen.queryByText('What gave it away?')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Reveal' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Previous/ })).not.toBeInTheDocument()
    expect(screen.getByText('0 of 2 done')).toBeInTheDocument()
  })

  it('one tap picks, reveals at once and counts it right', () => {
    const { state } = renderView()
    tap('b')
    expect(state().items.p1).toEqual({ pick: 'b', done: true })
    expect(state().right).toBe(1)
    const reveal = screen.getByTestId('real_or_ai-reveal')
    expect(reveal).toHaveTextContent(/Right!\s*B is the AI one\./)
    expect(reveal).toHaveTextContent("The tell: Hands. Don't rely on it by itself.")
    expect(reveal).toHaveTextContent('Newer models get hands right.')
    expect(screen.getByText('🤖 Made by AI')).toBeInTheDocument()
    expect(screen.getByText('📷 Real')).toBeInTheDocument()
    expect(screen.getByText('👆 Your pick')).toBeInTheDocument()
    expect(screen.getByText('⭐ 1 right')).toBeInTheDocument()
    expect(screen.getByText('1 of 2 done')).toBeInTheDocument()
    // Locked: a second tap during the reveal does nothing.
    expect(screen.getByTestId('real_or_ai-side-a')).toBeDisabled()
  })

  it('a wrong tap shows a cross and a word, and the right count stays put', () => {
    const { state } = renderView()
    tap('a')
    expect(state().items.p1).toEqual({ pick: 'a', done: true })
    expect(state().right).toBe(0)
    expect(screen.getByTestId('real_or_ai-reveal')).toHaveTextContent(
      /✗\s*Not this time\s*B is the AI one\./
    )
  })

  it('moves on with Next, and Play again keeps the right count', () => {
    const { state } = renderView()
    tap('b')
    click('Next →')
    expect(screen.getByText('Which text was written by AI?')).toBeInTheDocument()
    tap('b')
    expect(state().right).toBe(1)
    click('Finish →')
    expect(screen.getByTestId('round-finished')).toBeInTheDocument()
    expect(screen.getByText('You spotted 1 of 2 this time.')).toBeInTheDocument()
    expect(screen.getByText('⭐ 1 right')).toBeInTheDocument()
    click('Play again')
    expect(state()).toEqual({ v: 1, right: 1, items: {} })
    expect(screen.getByText('Which picture was made by AI?')).toBeInTheDocument()
    expect(screen.getByText('⭐ 1 right')).toBeInTheDocument()
    tap('b')
    expect(state().right).toBe(2)
  })

  it('moves on by itself after the reading moment', () => {
    vi.useFakeTimers()
    renderView()
    tap('b')
    expect(screen.getByTestId('real_or_ai-reveal')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(READ_MOMENT_MS + 50)
    })
    expect(screen.getByText('Which text was written by AI?')).toBeInTheDocument()
    expect(screen.queryByTestId('real_or_ai-reveal')).not.toBeInTheDocument()
  })

  it('plays pairs after the core as a bonus', () => {
    renderView({ task: { ...TASK, coreItems: 1 } })
    tap('b')
    click('Next →')
    expect(screen.getByTestId('round-bonus')).toBeInTheDocument()
    expect(screen.getByText('Bonus')).toBeInTheDocument()
  })

  it('reads old saved state that still carries a tell', () => {
    renderView({
      initialState: {
        v: 1,
        items: {
          p1: { pick: 'b', tell: 'hands', done: true },
          p2: { pick: '', tell: '', done: false },
        },
      },
    })
    expect(screen.getByText('Which text was written by AI?')).toBeInTheDocument()
    expect(screen.getByText('1 of 2 done')).toBeInTheDocument()
  })

  it('uses real buttons so it works from the keyboard', () => {
    renderView()
    const side = screen.getByTestId('real_or_ai-side-a')
    expect(side.tagName).toBe('BUTTON')
    side.focus()
    expect(side).toHaveFocus()
  })

  it('is read-only for a review view', () => {
    renderView({ readOnly: true, initialState: definition.solutionState(TASK) })
    expect(screen.getByTestId('real_or_ai-side-b')).toBeDisabled()
    expect(screen.getByTestId('real_or_ai-reveal')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Next/ })).not.toBeInTheDocument()
  })

  it("shows the tutor the student's pick, the key before a pick, and any pair", () => {
    const state = {
      v: 1,
      items: { p1: { pick: 'a', done: true }, p2: { pick: '', done: false } },
    }
    render(<RealOrAiStudentView task={TASK} state={state} readOnly teacher />)
    // Follows the pair the student is on (the first not tapped).
    const note = screen.getByTestId('real_or_ai-teacher-note')
    expect(note).toHaveTextContent(
      'Student has not picked yet. Key: A is AI. The tell: Too smooth. It is a fair clue to look for.'
    )
    expect(screen.getByText('🔑 AI (key)')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Pair 1, done' }))
    expect(screen.getByText("👆 Student's pick")).toBeInTheDocument()
    expect(screen.getByTestId('real_or_ai-reveal')).toHaveTextContent('Not this time')
  })

  it('lets a tutor edit the answers when not read-only', () => {
    const { state } = renderActivityUi((props) => <RealOrAiStudentView {...props} teacher />, {
      task: TASK,
      initialState: definition.initialState(TASK),
    })
    tap('b')
    expect(state().items.p1.pick).toBe('b')
    // The tutor view moves on to the next open pair; go back to change the tapped one. The right
    // count only goes up.
    click('Pair 1, done')
    tap('a')
    expect(state().items.p1.pick).toBe('a')
    expect(state().right).toBe(1)
  })
})
