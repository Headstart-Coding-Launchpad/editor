import { useState } from 'react'
import ActivityCorrect from '../ui/ActivityCorrect.jsx'
import ClassifierBuilderEditor from './ClassifierBuilderEditor.jsx'
import { DrawPad, GridThumb } from './DrawPad.jsx'
import {
  HELD_OUT_EVERY,
  MAX_CLASSES,
  MAX_LABEL_LENGTH,
  MIN_CLASSES,
  addClass,
  addExample,
  canTest,
  canTrain,
  cleanLabel,
  countsOf,
  describeConfusion,
  describeResult,
  encodeGrid,
  gradeTask,
  initialClassifierState,
  isHeldOut,
  liveCountOf,
  rasterize,
  recordLive,
  removeClass,
  removeExample,
  runTest,
  setClassName,
  splitExamples,
  taskLiveTestSize,
  taskMinExamples,
  taskTarget,
  testSize,
  train,
} from './classifier.js'

// Classifier UI. Controlled view: ActivityHost passes `state`, `onChange(next | prev =>
// next)`, `onSubmit()` (grades and reports; resolves to { passed }), `readOnly` (teacher views
// and review) and `device`. Never write to Firebase or storage here: useActivityState owns
// persistence and live sync. The drawing in progress lives only in this component; the activity
// state changes when a drawing is added, removed, trained or tested (never per pointer move).
//
// The student's drawings are in `state.examples` on the device. A teacher's read-only view is
// built from the shared summary, which has no drawings (counts, trained, test result only).

// What the model got on the test, in words: the score, the target and a line per class.
function ResultPanel({ task, state }) {
  const live = task.testSet === 'live'
  if (!state.result) {
    if (!live || !state.trained) return null
    const done = liveCountOf(state)
    return (
      <p className="act-hint" role="status">
        Tested {done} of {taskLiveTestSize(task)} new drawings so far.
      </p>
    )
  }
  const target = Math.round(taskTarget(task) * 100)
  const reached = state.result.right / state.result.total + 1e-9 >= taskTarget(task)
  const rows = describeConfusion(state.result, state.classes)
  return (
    <div className="act-cls-result" data-testid="classifier-result" role="status">
      <span className="act-cls-result__big">{describeResult(state.result)}</span>
      <span>
        Target: {target}%. {reached ? '✓ Reached.' : 'Not reached yet.'}
      </span>
      <ul className="act-cls-list" aria-label="What the model got right and wrong">
        {rows.map((row) => (
          <li key={row.label}>{row.text}</li>
        ))}
      </ul>
    </div>
  )
}

// The read-only (tutor) view: counts per class, trained, and the test result.
function TutorSummary({ task, state }) {
  const counts = countsOf(state)
  const min = taskMinExamples(task)
  const labels = state.classes.filter(Boolean)
  const graded = gradeTask(task, state)
  return (
    <div className="act-cls-section" data-testid="classifier-summary">
      <p className="act-notice">
        The drawings stay on the student&apos;s device. You see how many they have in each class,
        whether they have trained the model, and how it did on the test.
      </p>
      {labels.length === 0 ? (
        <p>The student has not named any classes yet.</p>
      ) : (
        <ul className="act-cls-list" aria-label="Drawings in each class">
          {labels.map((label) => (
            <li key={label}>
              {label}: {counts[label] ?? 0} of {min} drawings
              {(counts[label] ?? 0) >= min ? ' ✓' : ''}
            </li>
          ))}
        </ul>
      )}
      <p>{state.trained ? 'Model trained.' : 'Model not trained yet.'}</p>
      <ResultPanel task={task} state={state} />
      {graded.passed && <ActivityCorrect>Target reached</ActivityCorrect>}
    </div>
  )
}

export function ClassifierStudentView({
  task,
  state: stateProp,
  onChange,
  onSubmit,
  readOnly = false,
}) {
  const state = stateProp ?? initialClassifierState(task)
  const [selected, setSelected] = useState(0)
  const [strokes, setStrokes] = useState([])
  const [liveStrokes, setLiveStrokes] = useState([])
  const [liveNote, setLiveNote] = useState(null)
  const [checked, setChecked] = useState(null)

  if (readOnly) return <TutorSummary task={task} state={state} />

  const namesFixed = (task.classes ?? []).length > 0
  const rows = namesFixed
    ? state.classes
    : [...state.classes, '', ''].slice(0, Math.max(2, state.classes.length))
  const counts = countsOf(state)
  const min = taskMinExamples(task)
  const index = Math.min(selected, rows.length - 1)
  const label = rows[index] ?? ''
  const cleaned = cleanLabel(label)
  const duplicate = !!cleaned && rows.findIndex((r) => cleanLabel(r) === cleaned) !== index
  const canDraw = !!cleaned && !duplicate
  const list = state.examples?.[label] ?? []
  const split = splitExamples(task, state)
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0)
  const graded = gradeTask(task, state)
  const update = (fn) => onChange?.((prev) => fn(prev ?? initialClassifierState(task)))

  function handleAdd() {
    if (!canDraw || strokes.length === 0) return
    const grid = encodeGrid(rasterize(strokes))
    update((prev) => addExample(prev, label, grid))
    setStrokes([])
  }

  function handleLive(actual) {
    if (liveStrokes.length === 0) return
    const grid = encodeGrid(rasterize(liveStrokes))
    const done = recordLive(task, state, actual, grid)
    if (done.predicted == null) return
    update(() => done.state)
    setLiveNote({ actual, predicted: done.predicted })
    setLiveStrokes([])
  }

  async function handleCheck() {
    const outcome = await onSubmit?.()
    setChecked({ state, passed: !!outcome?.passed })
  }

  const showChecked = checked && checked.state === state
  const keptBack = task.testSet === 'held_out' ? split.held.length : 0
  const testCount = testSize(task, state)

  return (
    <div className="act-panel" data-testid="classifier-activity">
      <p>
        {task.testSet === 'held_out' &&
          `Draw examples of each class. Every ${HELD_OUT_EVERY}th drawing you add to a class is kept back to test the model, so it never learns from it.`}
        {task.testSet === 'teacher' &&
          'Draw examples of each class. Your teacher has test drawings the model has never seen.'}
        {task.testSet === 'live' &&
          'Draw examples of each class, train the model, then draw new drawings to test it.'}{' '}
        Your drawings stay on this device.
      </p>

      <section className="act-cls-section" aria-label="Classes">
        <h3 className="act-cls-heading">1. Collect drawings</h3>
        {!namesFixed && (
          <p>
            Choose {MIN_CLASSES} to {MAX_CLASSES} things for the model to tell apart, and name them.
          </p>
        )}
        {rows.map((name, i) => {
          const have = counts[name] ?? 0
          const nameClean = cleanLabel(name)
          const locked = have > 0
          return (
            <div className="act-cls-class" key={i}>
              {!namesFixed && (
                <input
                  className="act-cls-name"
                  type="text"
                  value={name}
                  maxLength={MAX_LABEL_LENGTH}
                  disabled={locked}
                  aria-label={`Name of class ${i + 1}`}
                  onChange={(event) => update((prev) => setClassName(prev, i, event.target.value))}
                />
              )}
              <button
                type="button"
                className="btn-ghost-outline act-btn act-cls-class__pick"
                aria-pressed={i === index}
                disabled={!nameClean}
                onClick={() => setSelected(i)}
              >
                {nameClean ? `Draw ${nameClean}` : 'Name this class first'}: {have} of {min}{' '}
                {have >= min ? '✓' : 'drawings'}
              </button>
              {!namesFixed && !locked && rows.length > MIN_CLASSES && (
                <button
                  type="button"
                  className="btn-ghost-outline act-btn"
                  aria-label={`Remove class ${i + 1}`}
                  onClick={() => {
                    update((prev) => removeClass(prev, i))
                    setSelected(0)
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          )
        })}
        {!namesFixed && rows.length < MAX_CLASSES && (
          <div>
            <button
              type="button"
              className="btn-ghost-outline act-btn"
              onClick={() => update((prev) => addClass(prev))}
            >
              Add another class
            </button>
          </div>
        )}
        {duplicate && <p className="act-hint">Give each class a different name.</p>}

        <DrawPad
          strokes={strokes}
          onStrokes={setStrokes}
          disabled={!canDraw}
          label={
            canDraw ? `Drawing pad for ${cleaned}` : 'Drawing pad (choose a named class first)'
          }
        />
        <div className="act-row">
          <button
            type="button"
            className="btn-primary act-btn"
            disabled={!canDraw || strokes.length === 0}
            onClick={handleAdd}
          >
            {canDraw ? `Add this drawing to ${cleaned}` : 'Add this drawing'}
          </button>
          <button
            type="button"
            className="btn-ghost-outline act-btn"
            disabled={strokes.length === 0}
            onClick={() => setStrokes(strokes.slice(0, -1))}
          >
            Undo last line
          </button>
          <button
            type="button"
            className="btn-ghost-outline act-btn"
            disabled={strokes.length === 0}
            onClick={() => setStrokes([])}
          >
            Clear the pad
          </button>
        </div>
        {task.testSet === 'held_out' && canDraw && (
          <p>
            {list.length % HELD_OUT_EVERY === HELD_OUT_EVERY - 1
              ? `The next ${cleaned} drawing will be kept back for the test.`
              : ''}
          </p>
        )}
        {canDraw && list.length > 0 && (
          <div className="act-cls-gallery" aria-label={`Your ${cleaned} drawings`}>
            {list.map((grid, i) => {
              const held = isHeldOut(task, state, label, i)
              const name = `Drawing ${i + 1} of ${cleaned}${held ? ', kept back for the test' : ''}`
              return (
                <button
                  type="button"
                  key={`${i}-${grid.slice(0, 24)}`}
                  className={`act-cls-thumb${held ? ' act-cls-thumb--test' : ''}`}
                  aria-label={`Remove ${name}`}
                  title={`Remove ${name}`}
                  onClick={() => update((prev) => removeExample(prev, label, i))}
                >
                  <GridThumb grid={grid} title={name} />
                  {held && <span className="act-cls-thumb__tag">Test</span>}
                </button>
              )
            })}
          </div>
        )}
        {keptBack > 0 && (
          <p>
            {keptBack} {keptBack === 1 ? 'drawing is' : 'drawings are'} kept back for the test
            (marked Test).
          </p>
        )}
      </section>

      <section className="act-cls-section" aria-label="Train">
        <h3 className="act-cls-heading">2. Train the model</h3>
        <div className="act-row">
          <button
            type="button"
            className="btn-primary act-btn"
            disabled={!canTrain(state)}
            onClick={() => update((prev) => train(task, prev))}
          >
            Train the model
          </button>
          <span role="status">
            {state.trained
              ? `✓ Trained on ${task.testSet === 'held_out' ? split.train.length : total} drawings.`
              : canTrain(state)
                ? 'Not trained yet.'
                : 'Draw at least 2 drawings in each class to train.'}
          </span>
        </div>
      </section>

      <section className="act-cls-section" aria-label="Test">
        <h3 className="act-cls-heading">3. Test the model</h3>
        {task.testSet !== 'live' && (
          <div className="act-row">
            <button
              type="button"
              className="btn-primary act-btn"
              disabled={!canTest(task, state)}
              onClick={() => update((prev) => runTest(task, prev))}
            >
              Test the model
            </button>
            <span>
              {state.trained
                ? testCount > 0
                  ? `It will be tested on ${testCount} drawings it has never seen.`
                  : 'You need more drawings so some can be kept back for the test.'
                : 'Train the model first.'}
            </span>
          </div>
        )}
        {task.testSet === 'live' && (
          <>
            {!state.trained && <p>Train the model first.</p>}
            {state.trained && (
              <>
                <p>
                  Draw something new, then say what it really is. The model has not seen it. (
                  {taskLiveTestSize(task)} needed.)
                </p>
                <DrawPad
                  strokes={liveStrokes}
                  onStrokes={setLiveStrokes}
                  label="Test drawing pad"
                />
                <div className="act-row">
                  <button
                    type="button"
                    className="btn-ghost-outline act-btn"
                    disabled={liveStrokes.length === 0}
                    onClick={() => setLiveStrokes([])}
                  >
                    Clear the test pad
                  </button>
                </div>
                <div
                  className="act-cls-live-pick"
                  role="group"
                  aria-label="What is the test drawing?"
                >
                  {state.classes.filter(Boolean).map((name) => (
                    <button
                      type="button"
                      key={name}
                      className="btn-primary act-btn"
                      disabled={liveStrokes.length === 0}
                      onClick={() => handleLive(name)}
                    >
                      It is a {name}
                    </button>
                  ))}
                </div>
                {liveNote && (
                  <p role="status">
                    You said {liveNote.actual}. The model said {liveNote.predicted}.{' '}
                    {liveNote.actual === liveNote.predicted ? '✓ Right.' : '✗ Wrong.'}
                  </p>
                )}
              </>
            )}
          </>
        )}
        <ResultPanel task={task} state={state} />
      </section>

      <div className="act-row act-row--submit">
        <button type="button" className="btn-primary act-btn" onClick={handleCheck}>
          Check my work
        </button>
      </div>
      {showChecked && checked.passed && (
        <ActivityCorrect>Your model reached the target</ActivityCorrect>
      )}
      {showChecked && !checked.passed && graded.hint && (
        <p className="act-hint" role="status">
          💡 {graded.hint}
        </p>
      )}
    </div>
  )
}

export default {
  StudentView: ClassifierStudentView,
  BuilderEditor: ClassifierBuilderEditor,
}
