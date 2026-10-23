import { act, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ClassifierStudentView } from '../ui.jsx'
import definition from '../definition.js'
import {
  addExample,
  encodeGrid,
  initialClassifierState,
  rasterize,
  runTest,
  setPad,
  tally,
} from '../classifier.js'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'

// UI tests for the Classifier StudentView with local state (src/test/activityUiHarness.jsx).
// jsdom can't prove pointer or touch behaviour on a real device: check that in a real browser
// too. Here the pad's bounding box is 0 x 0, so clientX / clientY (0 to 1) are used as the
// pad coordinates directly.

// The default: the live round, 3 drawings of each thing, 3 tries, fool-it panel only.
const TASK = {
  id: 1,
  taskType: 'activity',
  activityType: 'classifier',
  mode: 'drawing',
  classes: ['circle', 'line'],
  minExamplesPerClass: 3,
  liveTestSize: 3,
}

const circle = (r = 0.3, dx = 0) => [
  Array.from({ length: 25 }, (_, i) => [
    0.5 + dx + r * Math.cos((i / 24) * 2 * Math.PI),
    0.5 + r * Math.sin((i / 24) * 2 * Math.PI),
  ]),
]
const line = (tilt = 0) => [
  [
    [0.1, 0.5 + tilt],
    [0.9, 0.5 - tilt],
  ],
]
const gridOf = (strokes) => encodeGrid(rasterize(strokes))

function withDrawings(task = TASK, perClass = 3) {
  let state = initialClassifierState(task)
  for (let i = 0; i < perClass; i += 1) {
    state = addExample(state, 'circle', gridOf(circle(0.2 + i * 0.03, i * 0.01)))
    state = addExample(state, 'line', gridOf(line(i * 0.02 - 0.05)))
  }
  return state
}

// A ready state with some tries already played ([actual, predicted] pairs).
function played(pairs, task = TASK) {
  const state = withDrawings(task, 3)
  const misses = pairs
    .filter(([actual, predicted]) => actual !== predicted)
    .map(([actual, predicted]) => ({ actual, predicted, grid: gridOf(circle()) }))
  return { ...state, live: pairs, misses, result: pairs.length ? tally(pairs) : null }
}

function renderView(options = {}) {
  const task = options.task ?? TASK
  return renderActivityUi(ClassifierStudentView, {
    task,
    initialState: definition.initialState(task),
    ...options,
  })
}

// Draw one stroke on a pad with pointer events.
function drawOn(pad, points) {
  const [first, ...rest] = points
  fireEvent.pointerDown(pad, { pointerId: 1, clientX: first[0], clientY: first[1] })
  for (const [x, y] of rest) fireEvent.pointerMove(pad, { pointerId: 1, clientX: x, clientY: y })
  fireEvent.pointerUp(pad, { pointerId: 1 })
}

const pad = () => screen.getByTestId('classifier-pad')
const click = (name) => fireEvent.click(screen.getByRole('button', { name }))
const prompt = () => screen.getByTestId('classifier-prompt')
const drawCircle = () => drawOn(pad(), circle(0.3)[0])
// Press Done, then say what was drawn (one tap on the thing).
const finishAs = (name) => {
  click('Done')
  click(`I drew ${name}`)
}
const pct = (meter) => Number(meter.getAttribute('aria-valuenow'))

afterEach(() => vi.useRealTimers())

describe('Classifier UI: teaching it', () => {
  it('asks for drawings of one thing at a time, with no Train button', () => {
    renderView()
    expect(prompt()).toHaveTextContent('Draw 3 circle')
    expect(screen.queryByRole('button', { name: /train/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Check my work' })).not.toBeInTheDocument()
    expect(screen.getAllByTestId('classifier-thing')).toHaveLength(2)
    expect(screen.getAllByText('0 of 3')).toHaveLength(2)
  })

  it('adds a drawing to the thing being taught and clears the pad', () => {
    const { state } = renderView()
    const addButton = screen.getByRole('button', { name: 'Add this drawing to circle' })
    expect(addButton).toBeDisabled()
    drawOn(pad(), [
      [0.2, 0.2],
      [0.5, 0.8],
      [0.8, 0.2],
    ])
    expect(addButton).toBeEnabled()
    fireEvent.click(addButton)
    expect(state().examples.circle).toHaveLength(1)
    expect(state().examples.line).toHaveLength(0)
    expect(state().examples.circle[0]).toHaveLength(256)
    expect(screen.getByRole('button', { name: 'Add this drawing to circle' })).toBeDisabled()
    expect(prompt()).toHaveTextContent('Draw 2 circle')
    expect(screen.getByRole('button', { name: 'Remove Drawing 1 of circle' })).toBeInTheDocument()
  })

  it('moves on to the next thing by itself, then is ready', () => {
    const { state } = renderView()
    for (let i = 0; i < 3; i += 1) {
      drawOn(pad(), circle(0.2 + i * 0.05)[0])
      click('Add this drawing to circle')
    }
    expect(prompt()).toHaveTextContent('Draw 3 line')
    // The guess bars only appear once it is ready.
    expect(screen.queryByTestId('classifier-guess')).not.toBeInTheDocument()
    for (let i = 0; i < 3; i += 1) {
      drawOn(pad(), line(i * 0.02)[0])
      click('Add this drawing to line')
    }
    expect(state().examples.line).toHaveLength(3)
    expect(prompt()).toHaveTextContent('Draw a circle — will it get it?')
    expect(screen.getByTestId('classifier-guess')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add this drawing/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled()
  })

  it('shows an emoji big in the prompt and on the button', () => {
    const task = { ...TASK, classes: ['🐱 cat', '🐟 fish'] }
    renderView({ task })
    expect(prompt()).toHaveTextContent('Draw 3 🐱')
    expect(screen.getByRole('button', { name: 'Add this drawing to 🐱' })).toBeInTheDocument()
    expect(screen.getByText('cat')).toBeInTheDocument()
  })

  it('undoes the last line and clears the pad', () => {
    renderView()
    drawOn(pad(), [
      [0.1, 0.1],
      [0.9, 0.1],
    ])
    drawOn(pad(), [
      [0.1, 0.9],
      [0.9, 0.9],
    ])
    expect(pad().querySelectorAll('polyline')).toHaveLength(2)
    click('Undo last line')
    expect(pad().querySelectorAll('polyline')).toHaveLength(1)
    click('Clear the pad')
    expect(pad().querySelectorAll('polyline')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'Clear the pad' })).toBeDisabled()
  })

  it('draws a dot when the pointer is pressed and lifted without moving', () => {
    renderView()
    drawOn(pad(), [[0.5, 0.5]])
    expect(pad().querySelectorAll('circle')).toHaveLength(1)
  })

  it('removes a drawing from the gallery', () => {
    const { state } = renderView()
    drawCircle()
    click('Add this drawing to circle')
    click('Remove Drawing 1 of circle')
    expect(state().examples.circle).toHaveLength(0)
  })
})

describe('Classifier UI: student-named things', () => {
  const free = { ...TASK, classes: [] }

  it('starts with two blank things and a pad that waits for names', () => {
    renderView({ task: free })
    expect(screen.getAllByTestId('classifier-thing')).toHaveLength(2)
    expect(prompt()).toHaveTextContent('Name 2 things to start')
    expect(pad()).toHaveClass('act-cls-pad--off')
  })

  it('names a thing, draws it and then locks its name', () => {
    const { state } = renderView({ task: free })
    fireEvent.change(screen.getByLabelText('Name of thing 1'), { target: { value: 'cat' } })
    fireEvent.change(screen.getByLabelText('Name of thing 2'), { target: { value: 'fish' } })
    expect(prompt()).toHaveTextContent('Draw 3 cat')
    drawCircle()
    click('Add this drawing to cat')
    expect(state().examples.cat).toHaveLength(1)
    expect(screen.getByLabelText('Name of thing 1')).toBeDisabled()
    expect(screen.getByLabelText('Name of thing 2')).toBeEnabled()
  })

  it('adds and removes things, up to four', () => {
    renderView({ task: free })
    click('Add another thing')
    expect(screen.getAllByTestId('classifier-thing')).toHaveLength(3)
    click('Add another thing')
    expect(screen.getAllByTestId('classifier-thing')).toHaveLength(4)
    expect(screen.queryByRole('button', { name: 'Add another thing' })).not.toBeInTheDocument()
    click('Remove thing 4')
    expect(screen.getAllByTestId('classifier-thing')).toHaveLength(3)
  })

  it('does not let two things share a name', () => {
    renderView({ task: free })
    fireEvent.change(screen.getByLabelText('Name of thing 1'), { target: { value: 'cat' } })
    fireEvent.change(screen.getByLabelText('Name of thing 2'), { target: { value: 'cat' } })
    expect(screen.getByRole('button', { name: 'Add this drawing' })).toBeDisabled()
  })
})

describe('Classifier UI: the round', () => {
  it('guesses live as each stroke ends, one bar per thing, moving smoothly', () => {
    renderView({ initialState: withDrawings() })
    const guess = screen.getByTestId('classifier-guess')
    expect(pct(within(guess).getByRole('meter', { name: 'circle' }))).toBe(0)
    drawCircle()
    const circleBar = pct(within(guess).getByRole('meter', { name: 'circle' }))
    const lineBar = pct(within(guess).getByRole('meter', { name: 'line' }))
    expect(circleBar).toBeGreaterThan(60)
    expect(circleBar + lineBar).toBeGreaterThanOrEqual(99)
    expect(lineBar).toBeLessThan(40)
  })

  it('shares the pad with the tutor at each stroke end, as a grid', () => {
    const { state } = renderView({ initialState: withDrawings() })
    expect(state().pad).toBeNull()
    drawCircle()
    expect(state().pad).toEqual({ grid: gridOf(circle(0.3)), target: 'circle' })
    click('Clear the pad')
    expect(state().pad).toBeNull()
  })

  it('Done asks what you drew, with the suggested thing picked out', () => {
    const { state } = renderView({ initialState: withDrawings() })
    drawCircle()
    click('Done')
    expect(prompt()).toHaveTextContent('What did you draw?')
    const ask = screen.getByTestId('classifier-ask')
    expect(within(ask).getByRole('button', { name: 'I drew circle' })).toHaveAttribute(
      'data-suggested',
      'true'
    )
    expect(within(ask).getByRole('button', { name: 'I drew line' })).not.toHaveAttribute(
      'data-suggested'
    )
    expect(pad()).toHaveClass('act-cls-pad--off')
    // Nothing is counted until they say.
    expect(state().live).toEqual([])
    click('Back to the pad')
    expect(screen.queryByTestId('classifier-ask')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled()
  })

  it('a right answer ticks, counts and moves on by itself', () => {
    vi.useFakeTimers()
    const { state } = renderView({ initialState: withDrawings() })
    expect(screen.getByText('0 of 3 done')).toBeInTheDocument()
    drawCircle()
    finishAs('circle')
    expect(state().live).toEqual([['circle', 'circle']])
    expect(state().pad).toBeNull()
    expect(screen.getByTestId('classifier-feedback')).toHaveTextContent('It got it! It said circle')
    expect(screen.getByText('1 of 3 done')).toBeInTheDocument()
    expect(screen.getByText('It got 1 of 1 right')).toBeInTheDocument()
    expect(pad()).toHaveClass('act-cls-pad--off')
    act(() => vi.advanceTimersByTime(800))
    expect(screen.queryByTestId('classifier-feedback')).not.toBeInTheDocument()
    expect(pad().querySelectorAll('polyline')).toHaveLength(0)
    expect(prompt()).toHaveTextContent('Draw a line — will it get it?')
  })

  it('a deliberate fool that the pad gets right counts as a right answer, not a miss', () => {
    const start = played([['circle', 'circle']])
    const { state } = renderView({ initialState: start })
    // It suggests a line; they draw a circle on purpose, and it still says circle.
    expect(prompt()).toHaveTextContent('Draw a line — will it get it?')
    drawCircle()
    finishAs('circle')
    expect(state().live).toEqual([
      ['circle', 'circle'],
      ['circle', 'circle'],
    ])
    expect(state().misses).toEqual([])
    expect(screen.getByTestId('classifier-feedback')).toHaveTextContent('It got it!')
  })

  it('a miss offers one tap to teach it that drawing, filed under what they drew', () => {
    const start = played([['circle', 'circle']])
    const { state } = renderView({ initialState: start })
    // They draw a circle that looks like nothing it knows: they say it was a line.
    drawCircle()
    finishAs('line')
    expect(state().live).toEqual([
      ['circle', 'circle'],
      ['line', 'circle'],
    ])
    expect(screen.getByTestId('classifier-feedback')).toHaveTextContent(
      'It got that one wrong. It said circle, you drew line'
    )
    click('Teach it this one')
    expect(state().examples.line).toHaveLength(4)
    expect(state().misses[0].fixed).toBe(true)
    expect(screen.getByText(/Taught!/)).toBeInTheDocument()
    expect(screen.getByText('It thought your line was a circle ✓ taught')).toBeInTheDocument()
    click('Try another')
    expect(screen.queryByTestId('classifier-feedback')).not.toBeInTheDocument()
  })

  it('a miss waits for a tap when the fool-it panel is on', () => {
    vi.useFakeTimers()
    const start = played([['circle', 'circle']])
    renderView({ initialState: start })
    drawCircle()
    finishAs('line')
    act(() => vi.advanceTimersByTime(5000))
    expect(screen.getByTestId('classifier-feedback')).toBeInTheDocument()
  })

  it('without the fool-it panel there is no Teach button and a miss clears itself', () => {
    vi.useFakeTimers()
    const task = { ...TASK, panels: [] }
    renderView({ task, initialState: played([['circle', 'circle']], task) })
    drawCircle()
    finishAs('line')
    expect(screen.getByTestId('classifier-feedback')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Teach it this one' })).not.toBeInTheDocument()
    act(() => vi.advanceTimersByTime(2500))
    expect(screen.queryByTestId('classifier-feedback')).not.toBeInTheDocument()
  })

  it('passes at the tries, right or wrong, and says how it did', () => {
    const start = played([
      ['circle', 'circle'],
      ['line', 'line'],
    ])
    const { state } = renderView({ initialState: start })
    expect(definition.grade(TASK, state()).passed).toBe(false)
    drawCircle()
    finishAs('line')
    expect(definition.grade(TASK, state()).passed).toBe(true)
    expect(screen.getByText('3 of 3 done')).toBeInTheDocument()
    const banner = screen.getByTestId('round-bonus')
    expect(banner).toHaveTextContent('Round done! It got 2 of 3 right')
    expect(screen.queryByText(/You did it/)).not.toBeInTheDocument()
  })

  it('shows the results as pictures: a meter and the mix-ups as thumbnails', () => {
    renderView({
      initialState: played([
        ['circle', 'circle'],
        ['line', 'circle'],
        ['circle', 'circle'],
      ]),
    })
    expect(screen.getByText('It got 2 of 3 right')).toBeInTheDocument()
    const mixups = screen.getByTestId('classifier-mixups')
    expect(within(mixups).getByText('It thought your line was a circle')).toBeInTheDocument()
    expect(within(mixups).getAllByRole('img')).toHaveLength(1)
  })

  it('hides the mix-ups when the fool-it panel is off', () => {
    const task = { ...TASK, panels: [] }
    renderView({ task, initialState: played([['line', 'circle']], task) })
    expect(screen.queryByTestId('classifier-mixups')).not.toBeInTheDocument()
  })

  it('shows what it sees and how sure it is only when the lesson turns them on', () => {
    const { unmount } = renderView({ initialState: withDrawings() })
    drawCircle()
    expect(screen.queryByTestId('classifier-grid')).not.toBeInTheDocument()
    expect(screen.queryByTestId('classifier-sure')).not.toBeInTheDocument()
    unmount()
    const task = { ...TASK, panels: ['grid', 'sure'] }
    renderView({ task, initialState: withDrawings(task) })
    expect(screen.queryByTestId('classifier-grid')).not.toBeInTheDocument()
    drawCircle()
    expect(screen.getByTestId('classifier-grid')).toBeInTheDocument()
    const sure = within(screen.getByTestId('classifier-sure')).getByRole('meter', {
      name: 'How sure is it',
    })
    expect(pct(sure)).toBeGreaterThan(60)
    expect(pct(sure)).toBeLessThan(100)
  })

  it('has a real button for every action (keyboard operable)', () => {
    renderView({ initialState: withDrawings() })
    for (const name of ['Done', 'Undo last line', 'Clear the pad']) {
      const button = screen.getByRole('button', { name })
      expect(button.tagName).toBe('BUTTON')
      expect(button).toHaveAttribute('type', 'button')
    }
  })

  it('keeps the prompt, pad and answer buttons together, with the panels beside them', () => {
    renderView({ initialState: withDrawings() })
    const main = pad().closest('.act-cls-play__main')
    expect(main).not.toBeNull()
    expect(main).toContainElement(prompt())
    expect(main).toContainElement(screen.getByRole('button', { name: 'Done' }))
    expect(screen.getByTestId('classifier-guess').closest('.act-cls-play__side')).not.toBeNull()
  })
})

describe('Classifier UI: kept-back test', () => {
  const held = { ...TASK, testSet: 'held_out', minExamplesPerClass: 4, targetAccuracy: 0.75 }

  it('has a Test it button once it is ready, and the guess bars as free play', () => {
    const { state } = renderView({ task: held, initialState: withDrawings(held, 8) })
    expect(screen.getByTestId('classifier-guess')).toBeInTheDocument()
    expect(
      screen.getByText('It will be tested on 4 drawings it has never seen.')
    ).toBeInTheDocument()
    click('Test it')
    expect(state().result.total).toBe(4)
    expect(state().result.right).toBe(4)
    expect(screen.getByText('4 of 4 right, 100%')).toBeInTheDocument()
    expect(screen.getByText('Your model reached the target')).toBeInTheDocument()
  })

  it('marks the drawings kept back while teaching', () => {
    const five = { ...held, minExamplesPerClass: 5 }
    renderView({ task: five, initialState: withDrawings(five, 4) })
    // The 4th circle drawing is kept back for the test and marked in the gallery.
    expect(screen.getByText('Test')).toBeInTheDocument()
  })
})

describe('Classifier UI: read-only (tutor) view', () => {
  const shared = (state, task = TASK) =>
    definition.deserialize(definition.serializeShared(state), task)

  it('shows counts, the round and mix-ups from the shared summary, without drawings or controls', () => {
    const full = played([
      ['circle', 'circle'],
      ['line', 'line'],
      ['circle', 'circle'],
      ['line', 'circle'],
    ])
    renderView({ readOnly: true, initialState: shared(full) })
    expect(screen.getByText(/drawings stay on the student's device/)).toBeInTheDocument()
    expect(screen.getByText('circle: 3 of 3 drawings ✓')).toBeInTheDocument()
    expect(screen.getByTestId('classifier-round-summary')).toHaveTextContent(
      '3/3 tried · +1 bonus · 3 right'
    )
    expect(screen.getByText('It got 3 of 4 right')).toBeInTheDocument()
    expect(screen.getByText('Called line a circle: 1')).toBeInTheDocument()
    expect(screen.getByText('Target reached')).toBeInTheDocument()
    expect(screen.queryByTestId('classifier-pad')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows teaching progress', () => {
    renderView({ readOnly: true, initialState: shared(withDrawings(TASK, 2)) })
    expect(screen.getByText('circle: 2 of 3 drawings')).toBeInTheDocument()
    expect(screen.getByText('Still teaching it.')).toBeInTheDocument()
  })

  it('shows ready before the first try', () => {
    renderView({ readOnly: true, initialState: shared(withDrawings(TASK, 3)) })
    expect(screen.getByTestId('classifier-round-summary')).toHaveTextContent('Ready: 0/3 tried')
  })

  it('shows the pad now and the last misses as grids, never the strokes', () => {
    const full = setPad(
      played([
        ['circle', 'circle'],
        ['line', 'circle'],
      ]),
      gridOf(circle(0.3)),
      'line'
    )
    renderView({ readOnly: true, initialState: shared(full) })
    const work = screen.getByTestId('classifier-tutor-work')
    expect(within(screen.getByTestId('classifier-tutor-pad')).getByRole('img')).toBeInTheDocument()
    expect(within(work).getByText('On the pad now (asked for line)')).toBeInTheDocument()
    const misses = screen.getByTestId('classifier-tutor-misses')
    expect(within(misses).getByText('It said circle, they drew line')).toBeInTheDocument()
    expect(within(misses).getAllByRole('img')).toHaveLength(1)
    expect(screen.queryByTestId('classifier-pad')).not.toBeInTheDocument()
  })

  it('shows no work picture when the pad is empty and there are no misses', () => {
    renderView({ readOnly: true, initialState: shared(withDrawings(TASK, 3)) })
    expect(screen.queryByTestId('classifier-tutor-work')).not.toBeInTheDocument()
  })

  it('shows a kept-back test result', () => {
    const held = { ...TASK, testSet: 'held_out', minExamplesPerClass: 4 }
    const tested = runTest(held, withDrawings(held, 8))
    renderView({ task: held, readOnly: true, initialState: shared(tested, held) })
    expect(screen.getByText('4 of 4 right, 100%')).toBeInTheDocument()
  })

  it('shows an untouched task', () => {
    renderView({ readOnly: true })
    expect(screen.getByText('circle: 0 of 3 drawings')).toBeInTheDocument()
    expect(screen.getByText('Still teaching it.')).toBeInTheDocument()
  })

  it('handles a student who has not named things', () => {
    const free = { ...TASK, classes: [] }
    renderView({ task: free, readOnly: true })
    expect(screen.getByText('The student has not named any things yet.')).toBeInTheDocument()
  })
})
