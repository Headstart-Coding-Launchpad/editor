import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ClassifierStudentView } from '../ui.jsx'
import definition from '../definition.js'
import {
  addExample,
  encodeGrid,
  initialClassifierState,
  rasterize,
  runTest,
  setClassName,
  sharedState,
  train,
} from '../classifier.js'
import { renderActivityUi } from '../../../test/activityUiHarness.jsx'

// UI tests for the Classifier StudentView with local state (src/test/activityUiHarness.jsx).
// jsdom can't prove pointer or touch behaviour on a real device: check that in a real browser
// too. Here the pad's bounding box is 0 x 0, so clientX / clientY (0 to 1) are used as the
// pad coordinates directly.

const TASK = {
  id: 1,
  taskType: 'activity',
  activityType: 'classifier',
  mode: 'drawing',
  classes: ['circle', 'line'],
  minExamplesPerClass: 4,
  testSet: 'held_out',
  targetAccuracy: 0.75,
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

function withDrawings(task = TASK, perClass = 8) {
  let state = initialClassifierState(task)
  for (let i = 0; i < perClass; i += 1) {
    state = addExample(state, 'circle', gridOf(circle(0.2 + i * 0.03, i * 0.01)))
    state = addExample(state, 'line', gridOf(line(i * 0.02 - 0.05)))
  }
  return state
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

const pad = (index = 0) => screen.getAllByTestId('classifier-pad')[index]
const click = (name) => fireEvent.click(screen.getByRole('button', { name }))

describe('Classifier UI: collecting drawings', () => {
  it('shows each class with how many drawings it has and needs', () => {
    renderView()
    expect(screen.getByRole('button', { name: 'Draw circle: 0 of 4 drawings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Draw line: 0 of 4 drawings' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Draw circle: 0 of 4 drawings' })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })

  it('adds a drawing to the chosen class and clears the pad', () => {
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
    // The drawing is in the gallery, and the class count went up.
    expect(screen.getByRole('button', { name: 'Remove Drawing 1 of circle' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Draw circle: 1 of 4 drawings' })).toBeInTheDocument()
  })

  it('draws into the other class once it is chosen', () => {
    const { state } = renderView()
    click('Draw line: 0 of 4 drawings')
    drawOn(pad(), [
      [0.1, 0.5],
      [0.9, 0.5],
    ])
    click('Add this drawing to line')
    expect(state().examples.line).toHaveLength(1)
    expect(state().examples.circle).toHaveLength(0)
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
    const { state } = renderView({ initialState: withDrawings(TASK, 2) })
    click('Remove Drawing 1 of circle')
    expect(state().examples.circle).toHaveLength(1)
    expect(state().trained).toBe(false)
  })

  it('marks the drawings kept back for the test and says which is next', () => {
    renderView({ initialState: withDrawings(TASK, 4) })
    expect(
      screen.getByRole('button', { name: 'Remove Drawing 4 of circle, kept back for the test' })
    ).toBeInTheDocument()
    expect(screen.getByText('Test')).toBeInTheDocument()
    expect(screen.getByText(/2 drawings are kept back for the test/)).toBeInTheDocument()
  })

  it('tells the student when the next drawing will be kept back', () => {
    renderView({ initialState: withDrawings(TASK, 3) })
    expect(
      screen.getByText('The next circle drawing will be kept back for the test.')
    ).toBeInTheDocument()
  })

  it('shows a tick as well as the count once a class has enough', () => {
    renderView({ initialState: withDrawings(TASK, 4) })
    expect(screen.getByRole('button', { name: 'Draw circle: 4 of 4 ✓' })).toBeInTheDocument()
  })
})

describe('Classifier UI: student-named classes', () => {
  const FREE = { ...TASK, classes: [] }

  it('starts with two blank rows that cannot be drawn into', () => {
    renderView({ task: FREE })
    expect(screen.getByLabelText('Name of class 1')).toHaveValue('')
    expect(screen.getByLabelText('Name of class 2')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Name this class first/ })).toHaveLength(2)
    expect(screen.getByRole('button', { name: 'Add this drawing' })).toBeDisabled()
  })

  it('names a class, draws into it and then locks its name', () => {
    const { state } = renderView({ task: FREE })
    fireEvent.change(screen.getByLabelText('Name of class 1'), { target: { value: 'cat ' } })
    fireEvent.change(screen.getByLabelText('Name of class 2'), { target: { value: 'fish' } })
    expect(state().classes).toEqual(['cat ', 'fish'])
    drawOn(pad(), [
      [0.2, 0.2],
      [0.8, 0.8],
    ])
    click('Add this drawing to cat')
    expect(state().classes).toEqual(['cat', 'fish'])
    expect(state().examples.cat).toHaveLength(1)
    expect(screen.getByLabelText('Name of class 1')).toBeDisabled()
  })

  it('adds and removes a class row', () => {
    const { state } = renderView({ task: FREE })
    click('Add another class')
    expect(screen.getByLabelText('Name of class 3')).toBeInTheDocument()
    expect(state().classes).toEqual(['', '', ''])
    click('Remove class 3')
    expect(screen.queryByLabelText('Name of class 3')).not.toBeInTheDocument()
  })

  it('stops at six classes', () => {
    renderView({ task: FREE })
    for (let i = 0; i < 4; i += 1) click('Add another class')
    expect(screen.getByLabelText('Name of class 6')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add another class' })).not.toBeInTheDocument()
  })

  it('does not let two classes share a name', () => {
    const state = setClassName(setClassName(initialClassifierState(FREE), 0, 'cat'), 1, 'cat')
    renderView({ task: FREE, initialState: state })
    expect(screen.getAllByRole('button', { name: /Draw cat/ })).toHaveLength(2)
    fireEvent.click(screen.getAllByRole('button', { name: /Draw cat/ })[1])
    expect(screen.getByText('Give each class a different name.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add this drawing' })).toBeDisabled()
  })
})

describe('Classifier UI: train and test', () => {
  it('keeps Train off until each class has two drawings, then trains', () => {
    renderView({ initialState: withDrawings(TASK, 1) })
    expect(screen.getByRole('button', { name: 'Train the model' })).toBeDisabled()
    expect(screen.getByText('Draw at least 2 drawings in each class to train.')).toBeInTheDocument()
  })

  it('trains and says so', () => {
    const { state } = renderView({ initialState: withDrawings(TASK, 4) })
    expect(screen.getByRole('button', { name: 'Test the model' })).toBeDisabled()
    expect(screen.getByText('Train the model first.')).toBeInTheDocument()
    click('Train the model')
    expect(state().trained).toBe(true)
    expect(screen.getByText('✓ Trained on 6 drawings.')).toBeInTheDocument()
    expect(
      screen.getByText('It will be tested on 2 drawings it has never seen.')
    ).toBeInTheDocument()
  })

  it('tests on the kept-back drawings and shows the score and a line per class', () => {
    const { state } = renderView({ initialState: train(TASK, withDrawings(TASK, 8)) })
    click('Test the model')
    expect(state().result.total).toBe(4)
    const result = screen.getByTestId('classifier-result')
    expect(within(result).getByText('4 of 4 right, 100%')).toBeInTheDocument()
    expect(within(result).getByText('Target: 75%. ✓ Reached.')).toBeInTheDocument()
    expect(within(result).getByText('circle: 2 of 2 right.')).toBeInTheDocument()
    expect(within(result).getByText('line: 2 of 2 right.')).toBeInTheDocument()
  })

  it('says when there is not enough to keep back', () => {
    renderView({ initialState: train(TASK, withDrawings(TASK, 3)) })
    expect(screen.getByRole('button', { name: 'Test the model' })).toBeDisabled()
    expect(
      screen.getByText('You need more drawings so some can be kept back for the test.')
    ).toBeInTheDocument()
  })

  it('tests on the teacher drawings', () => {
    const task = {
      ...TASK,
      testSet: 'teacher',
      testItems: [
        { label: 'circle', strokes: [circle(0.3).flat().flat()] },
        { label: 'line', strokes: [[0.1, 0.5, 0.9, 0.5]] },
      ],
    }
    const { state } = renderView({ task, initialState: train(task, withDrawings(task, 4)) })
    expect(
      screen.getByText('It will be tested on 2 drawings it has never seen.')
    ).toBeInTheDocument()
    expect(screen.queryByText('Test')).not.toBeInTheDocument()
    click('Test the model')
    expect(state().result.total).toBe(2)
  })
})

describe('Classifier UI: live test', () => {
  const LIVE = { ...TASK, testSet: 'live', liveTestSize: 3 }

  it('asks to train first', () => {
    renderView({ task: LIVE, initialState: withDrawings(LIVE, 4) })
    expect(screen.getAllByTestId('classifier-pad')).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Test the model' })).not.toBeInTheDocument()
  })

  it('records what the student says each new drawing is and shows the model guess', () => {
    const { state } = renderView({ task: LIVE, initialState: train(LIVE, withDrawings(LIVE, 4)) })
    const testPad = pad(1)
    expect(screen.getByRole('button', { name: 'It is a circle' })).toBeDisabled()
    drawOn(testPad, circle(0.3)[0])
    fireEvent.click(screen.getByRole('button', { name: 'It is a circle' }))
    expect(state().live).toEqual([['circle', 'circle']])
    expect(screen.getByText(/You said circle\. The model said circle\./)).toBeInTheDocument()
    expect(screen.getByText(/✓ Right\./)).toBeInTheDocument()
    expect(screen.getByText('Tested 1 of 3 new drawings so far.')).toBeInTheDocument()
    expect(state().result).toBeNull()
  })

  it('shows the result after the last test drawing', () => {
    const { state } = renderView({ task: LIVE, initialState: train(LIVE, withDrawings(LIVE, 4)) })
    for (const [label, strokes] of [
      ['circle', circle(0.3)[0]],
      [
        'line',
        [
          [0.1, 0.5],
          [0.9, 0.5],
        ],
      ],
      ['line', circle(0.3)[0]],
    ]) {
      drawOn(pad(1), strokes)
      fireEvent.click(screen.getByRole('button', { name: `It is a ${label}` }))
    }
    expect(state().result).toMatchObject({ right: 2, total: 3 })
    expect(screen.getByText('2 of 3 right, 67%')).toBeInTheDocument()
    expect(screen.getByText(/✗ Wrong\./)).toBeInTheDocument()
    expect(screen.getByText('line: 1 of 2 right. 1 was called circle.')).toBeInTheDocument()
  })
})

describe('Classifier UI: checking', () => {
  it('shows the hint when the check fails', async () => {
    const { onSubmit } = renderView({
      initialState: withDrawings(TASK, 2),
      submitResult: { passed: false },
    })
    click('Check my work')
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(await screen.findByText(/Draw more circle: you have 2 and need 4/)).toBeInTheDocument()
  })

  it('shows Correct when the model reaches the target', async () => {
    const state = runTest(TASK, train(TASK, withDrawings(TASK, 8)))
    renderView({ initialState: state, submitResult: { passed: true } })
    click('Check my work')
    expect(await screen.findByText('Your model reached the target')).toBeInTheDocument()
  })

  it('clears the verdict as soon as the student changes something', async () => {
    renderView({ initialState: withDrawings(TASK, 2), submitResult: { passed: false } })
    click('Check my work')
    await screen.findByText(/Draw more circle/)
    click('Remove Drawing 1 of circle')
    expect(screen.queryByText(/💡/)).not.toBeInTheDocument()
  })

  it('has a real button for every action (keyboard operable)', () => {
    renderView({ initialState: withDrawings(TASK, 2) })
    for (const button of screen.getAllByRole('button')) {
      expect(button.tagName).toBe('BUTTON')
      expect(button).toHaveAttribute('type', 'button')
    }
  })
})

describe('Classifier UI: read-only (tutor) view', () => {
  it('shows counts, trained and the result from the shared summary, without drawings or controls', () => {
    const full = runTest(TASK, train(TASK, withDrawings(TASK, 8)))
    const shared = definition.deserialize(definition.serializeShared(full), TASK)
    renderView({ readOnly: true, initialState: shared })
    expect(screen.getByText(/drawings stay on the student's device/)).toBeInTheDocument()
    expect(screen.getByText('circle: 8 of 4 drawings ✓')).toBeInTheDocument()
    expect(screen.getByText('Model trained.')).toBeInTheDocument()
    expect(screen.getByText('4 of 4 right, 100%')).toBeInTheDocument()
    expect(screen.getByText('Target reached')).toBeInTheDocument()
    expect(screen.queryByTestId('classifier-pad')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('shows an untouched task', () => {
    renderView({ readOnly: true })
    expect(screen.getByText('circle: 0 of 4 drawings')).toBeInTheDocument()
    expect(screen.getByText('Model not trained yet.')).toBeInTheDocument()
  })

  it('handles a student who has not named classes', () => {
    const free = { ...TASK, classes: [] }
    renderView({ task: free, readOnly: true })
    expect(screen.getByText('The student has not named any classes yet.')).toBeInTheDocument()
  })

  it('shows live progress before the result', () => {
    const live = { ...TASK, testSet: 'live', liveTestSize: 5 }
    const shared = { ...sharedState(train(live, withDrawings(live, 4))), liveCount: 2 }
    renderView({
      task: live,
      readOnly: true,
      initialState: definition.deserialize(JSON.stringify(shared), live),
    })
    expect(screen.getByText('Tested 2 of 5 new drawings so far.')).toBeInTheDocument()
  })
})
