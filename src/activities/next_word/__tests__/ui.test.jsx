import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NextWordStudentView } from '../ui.jsx'
import definition from '../definition.js'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'

// UI tests for the Next Word StudentView with local state (src/test/activityUiHarness.jsx).
// jsdom can't prove pointer, touch or layout behaviour: check those in a real browser too.

const FOOTBALL =
  'The ball goes into the net. The keeper looks at the net. The striker puts the ball in the net.'
// the -> net 3, ball 2, keeper 1, striker 1 (7 in all)

const TASK = {
  id: 1,
  taskType: 'activity',
  activityType: 'next_word',
  texts: [
    { title: 'Football', body: FOOTBALL },
    { title: 'Pets', body: 'The cat sat on the mat. The cat ran.' },
  ],
  allowPaste: true,
  showTemperature: true,
  items: [
    { id: 'a', prompt: 'the ball goes into the', answer: 'net' },
    { id: 'b', prompt: 'the keeper looks at the', answer: 'net' },
  ],
}

function renderView(options = {}) {
  return renderActivityUi(NextWordStudentView, {
    task: options.task ?? TASK,
    initialState: definition.initialState(options.task ?? TASK),
    ...options,
  })
}

const chooseFootball = () => fireEvent.click(screen.getByRole('radio', { name: 'Football' }))

describe('Next Word UI: picking a text', () => {
  it('starts with no text and asks for one', () => {
    renderView()
    expect(screen.getByText(/Choose a text to build the word-pair model/)).toBeInTheDocument()
    expect(screen.getByLabelText('Type a word')).toBeDisabled()
  })

  it('stores the chosen text and shows it', () => {
    const { state } = renderView()
    chooseFootball()
    expect(state()).toMatchObject({ source: 'text', index: 0 })
    expect(screen.getByTestId('next_word-text')).toHaveTextContent(FOOTBALL)
    expect(screen.getByRole('radio', { name: 'Football' })).toBeChecked()
  })

  it('switches to another text', () => {
    const { state } = renderView()
    chooseFootball()
    fireEvent.click(screen.getByRole('radio', { name: 'Pets' }))
    expect(state()).toMatchObject({ source: 'text', index: 1 })
  })

  it('has no paste option unless the task allows it', () => {
    renderView({ task: { ...TASK, allowPaste: false } })
    expect(screen.queryByRole('radio', { name: 'Paste my own text' })).not.toBeInTheDocument()
  })
})

describe('Next Word UI: pasting a text', () => {
  it('writes the pasted text only when the student presses Use my text', () => {
    const { state } = renderView()
    fireEvent.click(screen.getByRole('radio', { name: 'Paste my own text' }))
    fireEvent.change(screen.getByLabelText('Your text'), {
      target: { value: 'I like pie. I like cake.' },
    })
    expect(state().pasted).toBe('')
    expect(screen.getByText(/24 of 1200 letters/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Use my text' }))
    expect(state()).toMatchObject({ source: 'paste', pasted: 'I like pie. I like cake.' })
    expect(screen.getByTestId('next_word-text')).toHaveTextContent('Your own text')
  })

  it('needs at least two words', () => {
    const { state } = renderView()
    fireEvent.click(screen.getByRole('radio', { name: 'Paste my own text' }))
    fireEvent.change(screen.getByLabelText('Your text'), { target: { value: 'hello' } })
    fireEvent.click(screen.getByRole('button', { name: 'Use my text' }))
    expect(screen.getByText(/Paste at least two words/)).toBeInTheDocument()
    expect(state().source).toBeNull()
  })

  it('caps the text box at the size limit', () => {
    renderView()
    fireEvent.click(screen.getByRole('radio', { name: 'Paste my own text' }))
    expect(screen.getByLabelText('Your text')).toHaveAttribute('maxlength', '1200')
  })
})

describe('Next Word UI: the probability bars', () => {
  it('shows what comes after a typed word, with the numbers in words', () => {
    const { state } = renderView()
    chooseFootball()
    fireEvent.change(screen.getByLabelText('Type a word'), { target: { value: 'The' } })
    expect(state().probe).toBe('The')
    const bars = screen.getByRole('list', { name: 'Words that come after the' })
    const rows = within(bars).getAllByRole('listitem')
    expect(rows[0]).toHaveTextContent('net: 3 of 7 times (43%)')
    expect(rows[1]).toHaveTextContent('ball: 2 of 7 times (29%)')
    expect(rows).toHaveLength(4)
  })

  it('shows the bars for a word chosen from the buttons', () => {
    const { state } = renderView()
    chooseFootball()
    fireEvent.click(screen.getByRole('button', { name: 'net' }))
    expect(state().probe).toBe('net')
    expect(screen.getByRole('button', { name: 'net' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText(/the: 2 of 2 times/)).toBeInTheDocument()
  })

  it('says so when no word comes after the typed word', () => {
    renderView()
    chooseFootball()
    fireEvent.change(screen.getByLabelText('Type a word'), { target: { value: 'zebra' } })
    expect(screen.getByText(/no word comes after “zebra”/)).toBeInTheDocument()
  })
})

describe('Next Word UI: predict then reveal', () => {
  const guess = (value) =>
    fireEvent.change(screen.getByLabelText('Your prediction'), { target: { value } })

  it('shows the bars and a tick only after Reveal, and marks a right prediction', () => {
    const { state } = renderView()
    chooseFootball()
    guess('net')
    expect(state().items.a).toEqual({ guess: 'net', revealed: false })
    expect(screen.queryByText('Correct')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reveal' }))
    expect(state().items.a).toEqual({ guess: 'net', revealed: true })
    expect(screen.getByText('Correct')).toBeInTheDocument()
    expect(screen.getByText(/net: 3 of 7 times/)).toBeInTheDocument()
    expect(screen.getByLabelText('Your prediction')).toBeDisabled()
  })

  it('reveals with Enter', () => {
    const { state } = renderView()
    chooseFootball()
    guess('net')
    fireEvent.keyDown(screen.getByLabelText('Your prediction'), { key: 'Enter' })
    expect(state().items.a.revealed).toBe(true)
  })

  it('gives a hint for a wrong prediction and lets the student try again', () => {
    const { state } = renderView()
    chooseFootball()
    guess('ball')
    fireEvent.click(screen.getByRole('button', { name: 'Reveal' }))
    expect(screen.getByText(/Not quite/)).toBeInTheDocument()
    expect(screen.queryByText('Correct')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(state().items.a).toEqual({ guess: 'ball', revealed: false })
    expect(screen.queryByText(/Not quite/)).not.toBeInTheDocument()
    guess('net')
    fireEvent.click(screen.getByRole('button', { name: 'Reveal' }))
    expect(screen.getByText('Correct')).toBeInTheDocument()
  })

  it('marks against the text the student chose', () => {
    renderView()
    fireEvent.click(screen.getByRole('radio', { name: 'Pets' }))
    guess('net')
    fireEvent.click(screen.getByRole('button', { name: 'Reveal' }))
    expect(screen.getByText(/Not quite/)).toBeInTheDocument()
    expect(screen.getByText(/cat: 2 of 3 times/)).toBeInTheDocument()
  })

  it('will not reveal without a text, a prediction or just one word', () => {
    const { state } = renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Reveal' }))
    expect(screen.getByText(/Pick a text first/)).toBeInTheDocument()
    chooseFootball()
    fireEvent.click(screen.getByRole('button', { name: 'Reveal' }))
    expect(screen.getByText(/Type your prediction first/)).toBeInTheDocument()
    guess('net now')
    fireEvent.click(screen.getByRole('button', { name: 'Reveal' }))
    expect(screen.getByText(/Type just one word/)).toBeInTheDocument()
    expect(state().items.a.revealed).toBe(false)
  })

  it('has no item navigation: just round progress, and the next prompt appears by itself', async () => {
    renderView()
    expect(screen.getByText(/the ball goes into the/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Question|Next|Previous/ })).not.toBeInTheDocument()
    expect(screen.getByText('0 of 2 done')).toBeInTheDocument()
    chooseFootball()
    guess('net')
    fireEvent.click(screen.getByRole('button', { name: 'Reveal' }))
    expect(screen.getByText('1 of 2 done')).toBeInTheDocument()
    expect(
      await screen.findByText(/the keeper looks at the/, {}, { timeout: 3000 })
    ).toBeInTheDocument()
  })

  it('checks: submits and shows the hint for the prompt the student is on', async () => {
    const { onSubmit } = renderView()
    chooseFootball()
    guess('net')
    fireEvent.click(screen.getByRole('button', { name: 'Reveal' }))
    expect(
      await screen.findByText(/the keeper looks at the/, {}, { timeout: 3000 })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Check my work' }))
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/Type your prediction first/)).toBeInTheDocument()
  })
})

describe('Next Word UI: generating text', () => {
  const withTemperature = (temperature) => ({
    ...definition.initialState(TASK),
    source: 'text',
    index: 0,
    probe: 'the',
    temperature,
  })

  it('makes text from the model at temperature 0 (always the likeliest word)', () => {
    const { state } = renderView({ initialState: withTemperature(0) })
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
    expect(state().generated.startsWith('the net the net')).toBe(true)
    expect(screen.getByText(/^the net the net/)).toBeInTheDocument()
  })

  it('needs a text first', () => {
    const { state } = renderView()
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }))
    expect(screen.getByText(/Pick a text first/)).toBeInTheDocument()
    expect(state().generated).toBe('')
  })

  it('has a labelled temperature slider that stores its value', () => {
    const { state } = renderView()
    const slider = screen.getByLabelText('Temperature')
    expect(slider).toHaveAttribute('type', 'range')
    expect(slider).toHaveAttribute('aria-valuetext')
    fireEvent.change(slider, { target: { value: '1.5' } })
    expect(state().temperature).toBe(1.5)
    expect(screen.getByText(/1.5 \(adventurous\)/)).toBeInTheDocument()
  })

  it('hides the slider unless showTemperature is on', () => {
    renderView({ task: { ...TASK, showTemperature: false } })
    expect(screen.queryByLabelText('Temperature')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Generate' })).toBeInTheDocument()
  })
})

describe('Next Word UI: teacher (read-only) view', () => {
  it('shows the chosen text, the predictions and the marks without any controls', () => {
    renderView({
      readOnly: true,
      initialState: {
        ...definition.solutionState(TASK),
        probe: 'the',
        generated: 'the net the ball',
      },
    })
    expect(screen.getByTestId('next_word-text')).toHaveTextContent('Football')
    expect(screen.getByLabelText('Your prediction')).toBeDisabled()
    expect(screen.getByLabelText('Your prediction')).toHaveValue('net')
    expect(screen.getByLabelText('Type a word')).toBeDisabled()
    expect(screen.getByText('Correct')).toBeInTheDocument()
    expect(screen.getByText('the net the ball')).toBeInTheDocument()
    // The tutor-only picker lets a tutor look at any prompt.
    expect(screen.getByRole('button', { name: 'Prompt 1, done' })).toBeInTheDocument()
    for (const name of ['Reveal', 'Check my work', 'Generate', 'Try again']) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument()
    }
    expect(screen.getByLabelText('Temperature')).toBeDisabled()
  })

  it('shows a prediction the student has typed but not revealed yet', () => {
    renderView({
      readOnly: true,
      initialState: {
        ...definition.initialState(TASK),
        source: 'text',
        index: 0,
        items: { a: { guess: 'ball', revealed: false }, b: { guess: '', revealed: false } },
      },
    })
    expect(screen.getByText(/Guessing: “ball” \(not revealed yet\)/)).toBeInTheDocument()
  })
})
