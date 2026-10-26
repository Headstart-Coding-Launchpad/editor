import { useEffect, useMemo, useState } from 'react'
import ActivityCorrect from '../ui/ActivityCorrect.jsx'
import RoundProgress from '../ui/RoundProgress.jsx'
import { DONE_MOMENT_MS } from '../ui/useRoundFlow.js'
import { roundSummaryText } from '../round.js'
import ClassifierBuilderEditor from './ClassifierBuilderEditor.jsx'
import { DrawPad, GridThumb } from './DrawPad.jsx'
import {
  MAX_LABEL_LENGTH,
  MAX_STUDENT_CLASSES,
  MIN_CLASSES,
  addClass,
  addExample,
  canTest,
  cleanLabel,
  countsOf,
  givenCountOf,
  ownCountsOf,
  describeResult,
  encodeGrid,
  gradeTask,
  guessOf,
  initialClassifierState,
  isHeldOut,
  liveCountOf,
  mixupsOf,
  nextTarget,
  padOf,
  panelsOf,
  predictLive,
  rasterize,
  recentMissesOf,
  recordLive,
  removeClass,
  removeExample,
  rightsOf,
  runTest,
  setClassName,
  setPad,
  shortLabel,
  splitExamples,
  splitLabel,
  taskLiveTestSize,
  taskMinExamples,
  teachMiss,
  testSetOf,
  testSize,
} from './classifier.js'

// Classifier UI. Controlled view: ActivityHost passes `state`, `onChange(next | prev =>
// next)`, `readOnly` (teacher views and review) and `device`. Never write to Firebase or storage
// here: useActivityState owns persistence and live sync. The drawing in progress lives only in
// this component; the activity state changes when a drawing is added, removed, tried or tested
// (never per pointer move).
//
// The flow: teach each thing a few drawings (no Train button), then the pad guesses live as each
// stroke ends. In the default round the pad suggests a thing, the student draws anything (they
// may try to fool it) and presses Done, then says what they drew with one tap on the things'
// emoji (the suggested one is highlighted). The pad is right when its guess is what they drew;
// a miss can be taught in one tap. Every try counts towards the core, right or wrong. The task
// is marked as you go (the host submits when the core is met), so there is no Check button.
//
// The student's drawings are in `state.examples` on the device. A teacher's read-only view is
// built from the shared summary: counts, tries, rights, misses, mix-ups, and the pad now and the
// last misses as small 16 x 16 grids (never the strokes or the taught drawings).

// A miss without the fool-it panel clears itself after this long; with it, the student taps.
const MISS_MOMENT_MS = 1800

// A thing shown big: its emoji when it has one, else its name.
function Big({ label }) {
  return (
    <span className="act-cls-big" aria-hidden="true">
      {shortLabel(label)}
    </span>
  )
}

function Bar({ value, label }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div
      className="act-cls-bar"
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={`${pct}%`}
    >
      <div className="act-cls-bar__fill" style={{ width: `${pct}%` }} />
    </div>
  )
}

// One bar per thing: emoji (or name) and %, live as each stroke ends.
function GuessBars({ labels, scores, top }) {
  return (
    <ul className="act-cls-bars" aria-label="What it thinks" data-testid="classifier-guess">
      {labels.map((label) => {
        const pct = Math.round((scores?.[label] ?? 0) * 100)
        return (
          <li key={label} className={`act-cls-bars__row${label === top ? ' is-top' : ''}`}>
            <Big label={label} />
            <Bar value={pct / 100} label={`${splitLabel(label).name || label}`} />
            <span className="act-cls-bars__pct">{pct}%</span>
          </li>
        )
      })}
    </ul>
  )
}

// "It got 4 of 5 right" as a meter.
function ResultMeter({ right, total }) {
  if (!(total > 0)) return null
  const text = `It got ${right} of ${total} right`
  return (
    <div className="act-cls-result" data-testid="classifier-result" role="status">
      <span className="act-cls-result__big">{text}</span>
      <Bar value={right / total} label={text} />
    </div>
  )
}

// Tutor text for mix-ups: "🐱 called 🐟 x2".
function MixupList({ result }) {
  const mixups = mixupsOf(result)
  if (!mixups.length) return null
  return (
    <ul className="act-cls-list" aria-label="Mix-ups">
      {mixups.map((m) => (
        <li key={`${m.actual}>${m.predicted}`}>
          Called {shortLabel(m.actual)} a {shortLabel(m.predicted)}: {m.count}
        </li>
      ))}
    </ul>
  )
}

// The tutor's picture of the student's work: the pad as it is now and the last few misses, as
// the 16 x 16 grids the pad looks at. The strokes and taught drawings never leave the device.
function TutorWork({ state }) {
  const pad = padOf(state)
  const recent = recentMissesOf(state)
  if (!pad && !recent.length) return null
  return (
    <div className="act-cls-section" data-testid="classifier-tutor-work">
      {pad && (
        <figure className="act-cls-mixup" data-testid="classifier-tutor-pad">
          <div className="act-cls-thumb act-cls-thumb--big" style={{ cursor: 'default' }}>
            <GridThumb grid={pad.grid} title="What is on the student's pad now" />
          </div>
          <figcaption>
            On the pad now{pad.target ? ` (asked for ${shortLabel(pad.target)})` : ''}
          </figcaption>
        </figure>
      )}
      {recent.length > 0 && (
        <div className="act-cls-mixups" data-testid="classifier-tutor-misses">
          {recent.map((m, i) => (
            <figure className="act-cls-mixup" key={`${i}-${m.grid.slice(0, 16)}`}>
              <div className="act-cls-thumb" style={{ cursor: 'default' }}>
                <GridThumb
                  grid={m.grid}
                  title={`Missed: they drew ${splitLabel(m.actual).name || m.actual}`}
                />
              </div>
              <figcaption>
                It said {shortLabel(m.predicted)}, they drew {shortLabel(m.actual)}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </div>
  )
}

// The read-only (tutor) view: where the student is. Teaching: drawings per thing. Round: tries,
// rights, misses and mix-ups, plus the pad now and the last misses as small grids.
function TutorSummary({ task, state }) {
  const counts = countsOf(state)
  const own = ownCountsOf(state)
  const min = taskMinExamples(task)
  const labels = state.classes.filter(Boolean)
  const graded = gradeTask(task, state)
  const live = testSetOf(task) === 'live'
  const tries = liveCountOf(state)
  const rights = rightsOf(state)
  const core = taskLiveTestSize(task)
  return (
    <div className="act-cls-section" data-testid="classifier-summary">
      <p className="act-notice">
        The drawings stay on the student&apos;s device. You see how many they have of each thing,
        how the round is going, and a small picture of their pad and of their last misses.
      </p>
      {labels.length === 0 ? (
        <p>The student has not named any things yet.</p>
      ) : (
        <ul className="act-cls-list" aria-label="Drawings of each thing">
          {labels.map((label) => (
            <li key={label}>
              {label}: {counts[label] ?? 0} of {min} drawings
              {givenCountOf(state, label) > 0
                ? ` (${givenCountOf(state, label)} given + ${own[label] ?? 0} own)`
                : ''}
              {(counts[label] ?? 0) >= min ? ' ✓' : ''}
            </li>
          ))}
        </ul>
      )}
      {!graded.ready && <p>Still teaching it.</p>}
      {graded.ready && live && (
        <>
          <p data-testid="classifier-round-summary">
            {tries === 0
              ? `Ready: 0/${core} tried`
              : `${roundSummaryText(tries, Math.max(core, tries), core, 'tried')} · ${rights} right`}
          </p>
          {tries > 0 && <ResultMeter right={rights} total={tries} />}
          <MixupList result={state.result} />
        </>
      )}
      {graded.ready && !live && (
        <>
          <p>Ready to test.</p>
          {state.result && (
            <>
              <p role="status">{describeResult(state.result)}</p>
              <MixupList result={state.result} />
            </>
          )}
        </>
      )}
      <TutorWork state={state} />
      {graded.passed && <ActivityCorrect>Target reached</ActivityCorrect>}
    </div>
  )
}

export function ClassifierStudentView({ task, state: stateProp, onChange, readOnly = false }) {
  const state = stateProp ?? initialClassifierState(task)
  const [strokes, setStrokes] = useState([])
  const [feedback, setFeedback] = useState(null)
  // After Done, before the student says what they drew: { grid, predicted, suggested }.
  const [pending, setPending] = useState(null)
  const panels = panelsOf(task)
  const testSet = testSetOf(task)
  const live = testSet === 'live'
  const namesFixed = (task.classes ?? []).length > 0
  const min = taskMinExamples(task)
  const core = taskLiveTestSize(task)
  const graded = gradeTask(task, state)
  const counts = countsOf(state)
  const rows = namesFixed
    ? state.classes
    : [...state.classes, '', ''].slice(0, Math.max(2, state.classes.length))
  // Two things with the same name can't be told apart: not ready until that is fixed.
  const duplicate = rows.some(
    (r, i) => !!cleanLabel(r) && rows.findIndex((x) => cleanLabel(x) === cleanLabel(r)) !== i
  )
  const labels = useMemo(() => state.classes.filter((c) => cleanLabel(c)), [state.classes])
  const trainSet = useMemo(() => splitExamples(task, state).train, [task, state])
  const grid = useMemo(() => (strokes.length ? encodeGrid(rasterize(strokes)) : null), [strokes])
  const ready = graded.ready && !duplicate
  const guess = useMemo(
    () => (ready && grid ? guessOf(trainSet, grid, labels) : null),
    [ready, grid, trainSet, labels]
  )

  // The round moves on by itself after a right answer (and after a miss that has no
  // fool-it panel); a miss with the panel waits for a tap.
  const feedbackWait = feedback
    ? feedback.right || feedback.taught
      ? DONE_MOMENT_MS
      : panels.includes('fool')
        ? null
        : MISS_MOMENT_MS
    : null
  useEffect(() => {
    if (!feedback || feedbackWait == null) return undefined
    const timer = setTimeout(() => {
      setFeedback(null)
      setStrokes([])
    }, feedbackWait)
    return () => clearTimeout(timer)
  }, [feedback, feedbackWait])

  // The thing being taught: the first named one that still needs drawings.
  const currentIndex = rows.findIndex((name) => cleanLabel(name) && (counts[name] ?? 0) < min)
  const currentLabel = currentIndex >= 0 ? rows[currentIndex] : ''
  const currentClean = cleanLabel(currentLabel)
  const canDraw = !ready && currentIndex >= 0 && !duplicate
  const have = counts[currentLabel] ?? 0
  const list = state.examples?.[currentLabel] ?? []
  const givenList = state.given?.[currentLabel] ?? []
  const target = ready && live ? nextTarget(state) : null
  const tries = liveCountOf(state)
  const rights = rightsOf(state)
  const update = (fn) => onChange?.((prev) => fn(prev ?? initialClassifierState(task)))
  const topScore = guess?.label ? (guess.scores[guess.label] ?? 0) : 0

  // Share the pad with the tutor as its grid at each stroke end (not the strokes), with the thing
  // it is for. Not while a try is being named or shown: that try is about to be recorded.
  const padTarget = ready ? (live ? target : null) : canDraw ? currentLabel : null
  const sharedPad = state.pad
  useEffect(() => {
    if (readOnly || !onChange || pending || feedback) return
    if (
      (sharedPad?.grid ?? null) === grid &&
      (!grid || (sharedPad?.target ?? null) === padTarget)
    ) {
      return
    }
    onChange((prev) => setPad(prev ?? initialClassifierState(task), grid, padTarget))
  }, [readOnly, onChange, pending, feedback, sharedPad, grid, padTarget, task])

  if (readOnly) return <TutorSummary task={task} state={state} />

  function handleAdd() {
    if (!canDraw || !grid) return
    update((prev) => addExample(prev, currentLabel, grid))
    setStrokes([])
  }

  function handleDone() {
    if (!grid || !target || feedback || pending) return
    const predicted = predictLive(task, state, grid)
    if (predicted == null) return
    setPending({ grid, predicted, suggested: target })
  }

  // The student says what they drew: the try is recorded and marked against that.
  function handleChoose(drawn) {
    if (!pending) return
    const { grid: tryGrid, predicted, suggested } = pending
    update((prev) => recordLive(task, prev, drawn, tryGrid).state)
    setPending(null)
    setFeedback({
      drawn,
      predicted,
      right: predicted === drawn,
      grid: tryGrid,
      suggested,
      taught: false,
    })
  }

  function handleTeach() {
    if (!feedback || feedback.taught) return
    update((prev) => teachMiss(prev, feedback.drawn, feedback.grid))
    setFeedback({ ...feedback, taught: true })
  }

  function handleNext() {
    setFeedback(null)
    setStrokes([])
  }

  const padLabel = ready
    ? live
      ? 'Drawing pad: draw anything, even to fool it'
      : 'Drawing pad: draw anything and watch it guess'
    : canDraw
      ? `Drawing pad for ${currentClean}`
      : 'Drawing pad (name your things first)'
  const padOff = ready ? live && (!!feedback || !!pending) : !canDraw
  const finished = ready && live && tries >= core

  return (
    <div className="act-panel" data-testid="classifier-activity">
      {/* The things being taught: big emoji, how many drawings each has. */}
      <section className="act-cls-section" aria-label="Things to teach">
        {!namesFixed && !ready && (
          <p>
            Pick {MIN_CLASSES} to {MAX_STUDENT_CLASSES} things for the pad to tell apart and name
            them. Start a name with an emoji if you like, like 🐱 cat.
          </p>
        )}
        <div className="act-cls-things">
          {rows.map((name, i) => {
            const n = counts[name] ?? 0
            const nameClean = cleanLabel(name)
            const locked = n > 0
            const complete = !!nameClean && n >= min
            return (
              <div
                className={`act-cls-thing${i === currentIndex && !ready ? ' is-current' : ''}`}
                key={i}
                data-testid="classifier-thing"
              >
                {nameClean ? <Big label={name} /> : <span className="act-cls-big">?</span>}
                {nameClean && <span className="act-cls-thing__name">{splitLabel(name).name}</span>}
                <span className="act-cls-thing__count">
                  {nameClean ? `${Math.min(n, min)} of ${min}${complete ? ' ✓' : ''}` : ''}
                </span>
                {!namesFixed && (
                  <>
                    <input
                      className="act-cls-name"
                      type="text"
                      value={name}
                      maxLength={MAX_LABEL_LENGTH}
                      disabled={locked}
                      aria-label={`Name of thing ${i + 1}`}
                      onChange={(event) =>
                        update((prev) => setClassName(prev, i, event.target.value))
                      }
                    />
                    {!locked && rows.length > MIN_CLASSES && (
                      <button
                        type="button"
                        className="btn-ghost-outline act-btn"
                        aria-label={`Remove thing ${i + 1}`}
                        onClick={() => update((prev) => removeClass(prev, i))}
                      >
                        Remove
                      </button>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
        {!namesFixed && !ready && rows.length < MAX_STUDENT_CLASSES && (
          <div>
            <button
              type="button"
              className="btn-ghost-outline act-btn"
              onClick={() => update((prev) => addClass(prev, MAX_STUDENT_CLASSES))}
            >
              Add another thing
            </button>
          </div>
        )}
        {duplicate && <p className="act-hint">Give each thing a different name.</p>}
      </section>

      <div className={`act-cls-play${ready ? ' act-cls-play--ready' : ''}`}>
        <div className="act-cls-play__main">
          {/* The prompt: what to draw. */}
          {!ready && (
            <p className="act-cls-prompt" data-testid="classifier-prompt" aria-live="polite">
              {canDraw
                ? `Draw ${min - have} ${shortLabel(currentLabel)}`
                : duplicate
                  ? 'Give each thing a different name'
                  : `Name ${MIN_CLASSES} things to start`}
            </p>
          )}
          {ready && live && !feedback && !pending && target && (
            <p className="act-cls-prompt" data-testid="classifier-prompt" aria-live="polite">
              Draw a {shortLabel(target)} — will it get it?
            </p>
          )}
          {ready && live && pending && (
            <p className="act-cls-prompt" data-testid="classifier-prompt" aria-live="polite">
              What did you draw?
            </p>
          )}
          {ready && !live && (
            <p className="act-cls-prompt" data-testid="classifier-prompt">
              It is ready. Draw anything and watch it guess.
            </p>
          )}

          {ready && live && (
            <RoundProgress done={tries} total={Math.max(core, tries)} core={core} />
          )}
          {finished && (
            <p className="act-result act-result--pass" role="status" data-testid="round-bonus">
              Round done! It got {rights} of {tries} right. Keep going for bonus tries.
            </p>
          )}

          <DrawPad strokes={strokes} onStrokes={setStrokes} disabled={padOff} label={padLabel} />

          {/* After Done: say what you drew (the suggested thing is picked out). */}
          {pending && (
            <div
              className="act-cls-ask"
              data-testid="classifier-ask"
              role="group"
              aria-label="What did you draw?"
            >
              <div className="act-cls-ask__choices">
                {labels.map((label) => {
                  const name = splitLabel(label).name || label
                  const suggested = label === pending.suggested
                  return (
                    <button
                      type="button"
                      key={label}
                      className={`act-cls-choice${suggested ? ' is-suggested' : ''}`}
                      aria-label={`I drew ${name}`}
                      data-suggested={suggested ? 'true' : undefined}
                      autoFocus={suggested}
                      onClick={() => handleChoose(label)}
                    >
                      <Big label={label} />
                      <span>{name}</span>
                    </button>
                  )
                })}
              </div>
              <button
                type="button"
                className="btn-ghost-outline act-btn"
                onClick={() => setPending(null)}
              >
                Back to the pad
              </button>
            </div>
          )}

          {/* Buttons. */}
          {!feedback && !pending && (
            <div className="act-row">
              {!ready && (
                <button
                  type="button"
                  className="btn-primary act-btn"
                  disabled={!canDraw || strokes.length === 0}
                  onClick={handleAdd}
                >
                  {canDraw ? `Add this drawing to ${shortLabel(currentLabel)}` : 'Add this drawing'}
                </button>
              )}
              {ready && live && (
                <button
                  type="button"
                  className="btn-primary act-btn"
                  disabled={strokes.length === 0}
                  onClick={handleDone}
                >
                  Done
                </button>
              )}
              {ready && !live && (
                <button
                  type="button"
                  className="btn-primary act-btn"
                  disabled={!canTest(task, state)}
                  onClick={() => update((prev) => runTest(task, prev))}
                >
                  Test it
                </button>
              )}
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
          )}

          {/* After naming it: a tick, or the pad got it wrong. */}
          {feedback && (
            <div
              className={`act-cls-feedback act-cls-feedback--${feedback.right ? 'right' : 'miss'}`}
              role="status"
              data-testid="classifier-feedback"
            >
              {feedback.right ? (
                <p className="act-prompt">✓ It got it! It said {shortLabel(feedback.predicted)}</p>
              ) : (
                <p className="act-prompt">
                  ✗ It got that one wrong. It said {shortLabel(feedback.predicted)}, you drew{' '}
                  {shortLabel(feedback.drawn)}
                </p>
              )}
              {!feedback.right && panels.includes('fool') && (
                <div className="act-row">
                  {feedback.taught ? (
                    <span>✓ Taught! It will remember this one.</span>
                  ) : (
                    <button type="button" className="btn-primary act-btn" onClick={handleTeach}>
                      Teach it this one
                    </button>
                  )}
                  <button type="button" className="btn-ghost-outline act-btn" onClick={handleNext}>
                    Try another
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* The guess, live: one bar per thing, and the optional parts. */}
        {ready && (
          <div className="act-cls-play__side">
            <GuessBars labels={labels} scores={guess?.scores} top={guess?.label} />
            {panels.includes('sure') && (
              <div className="act-cls-sure" data-testid="classifier-sure">
                <span>How sure is it?</span>
                <Bar value={topScore} label="How sure is it" />
                <span className="act-cls-bars__pct">
                  {guess?.label ? Math.round(topScore * 100) : 0}%
                </span>
              </div>
            )}
            {panels.includes('grid') && grid && (
              <div className="act-cls-grid" data-testid="classifier-grid">
                <span>What it sees</span>
                <div className="act-cls-grid__pic">
                  <GridThumb
                    grid={grid}
                    title="What the model sees: your drawing as a small grid"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Teaching: this thing's drawings, tap one to remove it. */}
      {!ready && canDraw && (list.length > 0 || givenList.length > 0) && (
        <div className="act-cls-gallery" aria-label={`Your ${currentClean} drawings`}>
          {givenList.map((g, i) => {
            const name = `Given drawing ${i + 1} of ${currentClean}`
            return (
              <div key={`given-${i}`} className="act-cls-thumb" style={{ cursor: 'default' }}>
                <GridThumb grid={g} title={name} />
                <span className="act-cls-thumb__tag">Given</span>
              </div>
            )
          })}
          {list.map((g, i) => {
            const held = isHeldOut(task, state, currentLabel, i)
            const name = `Drawing ${i + 1} of ${currentClean}${held ? ', kept back for the test' : ''}`
            return (
              <button
                type="button"
                key={`${i}-${g.slice(0, 24)}`}
                className={`act-cls-thumb${held ? ' act-cls-thumb--test' : ''}`}
                aria-label={`Remove ${name}`}
                title={`Remove ${name}`}
                onClick={() => update((prev) => removeExample(prev, currentLabel, i))}
              >
                <GridThumb grid={g} title={name} />
                {held && <span className="act-cls-thumb__tag">Test</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* Results, in pictures. */}
      {live && tries > 0 && <ResultMeter right={rights} total={tries} />}
      {!live && state.result && (
        <div className="act-cls-result" data-testid="classifier-result" role="status">
          <span className="act-cls-result__big">{describeResult(state.result)}</span>
        </div>
      )}
      {!live && ready && !state.result && (
        <p className="act-hint">
          {testSize(task, state) > 0
            ? `It will be tested on ${testSize(task, state)} drawings it has never seen.`
            : 'Teach it more drawings so some can be kept back for the test.'}
        </p>
      )}
      {live && panels.includes('fool') && (state.misses ?? []).length > 0 && (
        <div className="act-cls-mixups" data-testid="classifier-mixups">
          {state.misses.map((m, i) => (
            <figure className="act-cls-mixup" key={`${i}-${m.grid.slice(0, 16)}`}>
              <div className="act-cls-thumb" style={{ cursor: 'default' }}>
                <GridThumb
                  grid={m.grid}
                  title={`Your drawing of ${splitLabel(m.actual).name || m.actual}`}
                />
              </div>
              <figcaption>
                It thought your {shortLabel(m.actual)} was a {shortLabel(m.predicted)}
                {m.fixed ? ' ✓ taught' : ''}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {graded.passed && !live && <ActivityCorrect>Your model reached the target</ActivityCorrect>}
    </div>
  )
}

export default {
  StudentView: ClassifierStudentView,
  BuilderEditor: ClassifierBuilderEditor,
}
