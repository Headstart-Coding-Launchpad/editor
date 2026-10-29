import { useState } from 'react'
import ActivityLayout, { ActChip, ActFold, ActStepper } from '../ui/ActivityLayout.jsx'
import {
  MAX_NAME,
  allowedFeaturesOf,
  picksOf,
  clampDepth,
  deckOn,
  depthOf,
  maxDepthOf,
  studentDepthOn,
  featureQuestion,
  featuresOf,
  gradeTask,
  labelsOf,
  maxExamplesOf,
  normalizeState,
} from './learning_tree.js'
import { pathOf } from './tree.js'
import LearningTreeBuilderEditor from './LearningTreeBuilderEditor.jsx'
import Tree from './TreeDiagram.jsx'
import LearningTreeDeckView from './DeckView.jsx'

// Learning Tree UI. Controlled view: ActivityHost passes `state`, `onChange(next | prev =>
// next)`, `readOnly` (teacher views and review). Never write to Firebase or storage here.
//
// The student adds labelled examples (a name, a tick per yes/no feature, a label). The tree is
// rebuilt from the examples on every render (a few dozen rows, so cheap) and drawn as nested
// boxes: no animation, no loop. The item being typed lives in this view; only a finished example,
// a removal or Try it reaches the state. The tutor's read-only view shows the same examples,
// tree and test results.

// The add form folds to one bar once this many animals are in (or the lesson's cap, if smaller).
const FOLD_AT = 4

function LearningTreePlainView({ task, state, onChange, readOnly = false }) {
  const features = featuresOf(task)
  const labels = labelsOf(task)
  const clean = normalizeState(task, state)
  const g = gradeTask(task, clean)
  const cap = maxExamplesOf(task)
  const [name, setName] = useState('')
  const [ticks, setTicks] = useState(() => features.map(() => false))
  const [picked, setPicked] = useState(null)
  // The student's own open/closed choice for the add form, valid only while the animal count is
  // on the same side of the fold line (so it opens at 0 and folds on its own at 4).
  const [formChoice, setFormChoice] = useState(null)
  const [everTried, setEverTried] = useState(!!clean.tried)
  const [blocked, setBlocked] = useState(false)
  const maxDepth = maxDepthOf(task)
  const depth = depthOf(task, clean)
  const full = clean.examples.length >= cap
  const foldAt = Math.min(FOLD_AT, cap)
  const folded = clean.examples.length >= foldAt
  const formOpen = formChoice && formChoice.folded === folded ? formChoice.open : !folded

  function change(fn) {
    onChange?.((prev) => fn(normalizeState(task, prev)))
  }

  // The label buttons add the animal: there is no separate Add button.
  function addExample(label) {
    if (readOnly || full) return
    const example = {
      n: name.trim().slice(0, MAX_NAME),
      f: ticks.map((t) => (t ? '1' : '0')).join(''),
      l: label,
    }
    change((prev) => ({
      ...prev,
      examples: [...prev.examples, example].slice(0, cap),
      tried: false,
    }))
    setName('')
    setTicks(features.map(() => false))
    setBlocked(false)
  }

  function removeExample(index) {
    change((prev) => ({
      ...prev,
      examples: prev.examples.filter((_, i) => i !== index),
      tried: false,
    }))
  }

  function setDepth(next) {
    const d = clampDepth(task, next)
    if (d === depth) return
    change((prev) => ({ ...prev, d, tried: false }))
    setPicked(null)
  }

  const picks = picksOf(task)
  const allowed = allowedFeaturesOf(task, clean)

  function toggleFeature(i) {
    const on = allowed.includes(i)
    if (!on && allowed.length >= picks) {
      setBlocked(true)
      return
    }
    setBlocked(false)
    change((prev) => {
      const u = features.map((_, j) => {
        if (j === i) return on ? '0' : '1'
        return (prev.u ?? '')[j] === '1' ? '1' : '0'
      })
      return { ...prev, u: u.join(''), tried: false }
    })
    setPicked(null)
  }

  function tryIt() {
    setEverTried(true)
    change((prev) => ({ ...prev, tried: prev.examples.length > 0 }))
  }

  const describe = (ex) => {
    const yes = features.filter((_, i) => ex.f[i] === '1').map((f) => f.replace(/_/g, ' '))
    return yes.length ? yes.join(', ') : 'none of the features'
  }

  // One tip line: the only yellow element.
  const wrong = g.tried ? g.results.findIndex((r) => !r.right) : -1
  let tip = null
  if (blocked) tip = 'Untick one first'
  else if (!readOnly) {
    if (g.count === 0)
      tip = `Type a name, tick what is true, then tap ${labels.map((l) => `+ ${l}`).join(' or ')}.`
    else if (picks && allowed.length === 0)
      tip = `Pick up to ${picks} features for the tree to use.`
    else if (!g.tried)
      tip =
        g.count < 2
          ? 'Add one more animal, then try it on new ones.'
          : 'Press Try it to see how your tree does on new animals.'
    else if (!g.passed)
      tip =
        wrong >= 0 && g.rows[wrong]?.name
          ? `It got ${g.rows[wrong].name} wrong. Add an animal like it.`
          : 'Add animals that show it the difference.'
  }

  // The route the picked test item took through the tree (only once tried): lights the path.
  const route =
    g.tried && picked !== null && g.rows[picked] ? pathOf(g.tree, g.rows[picked].f) : null
  const on = new Set(route ? route.nodes : [])

  const stageTop =
    picks > 0 || studentDepthOn(task) ? (
      <>
        {picks > 0 && (
          <div
            className={`act-lt-picks${blocked ? ' act-lt-shake' : ''}`}
            role="group"
            aria-label="Tree may use"
            data-act-control="group"
            onAnimationEnd={() => setBlocked(false)}
          >
            <span className="act-lt-picks__label">Tree may use</span>
            {features.map((feature, i) => (
              <ActChip
                key={feature}
                pressed={allowed.includes(i)}
                disabled={readOnly}
                onClick={() => toggleFeature(i)}
              >
                {featureQuestion(feature)}
              </ActChip>
            ))}
          </div>
        )}
        {studentDepthOn(task) && (
          <div className="act-lt-depthrow">
            <span className="act-lt-depthrow__label">Max questions</span>
            <ActStepper
              name="questions"
              value={depth}
              min={1}
              max={maxDepth}
              disabled={readOnly}
              lessLabel="Fewer questions"
              moreLabel="More questions"
              valueText={<span data-testid="lt-depth">{depth}</span>}
              onChange={setDepth}
            />
            {g.count > 0 && (
              <span className="act-lt-count-text">
                using <span data-testid="lt-using">{g.depth}</span>
              </span>
            )}
          </div>
        )}
      </>
    ) : null

  const stage = (
    <div className="act-lt-stage">
      {g.count === 0 ? (
        <p className="act-lt-empty">Add an animal and the tree grows by itself.</p>
      ) : (
        <div className="act-lt-scroll" data-testid="lt-tree" aria-label="Your tree">
          <Tree node={g.tree} features={features} labels={labels} on={on} />
        </div>
      )}
      {g.tried && (
        <div className="act-lt-results" data-testid="lt-results" role="status" aria-live="polite">
          <p className="act-lt-score">
            <span aria-hidden="true">{g.passed ? '✓' : '•'} </span>
            <span>
              Your tree got {g.correct} of {g.total} right
            </span>
          </p>
          <ul className="act-lt-resultlist">
            {g.rows.map((row, i) => {
              const right = g.results[i].right
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    className={`act-lt-result ${right ? 'act-lt-result--ok' : 'act-lt-result--miss'}`}
                    aria-pressed={picked === i}
                    aria-label={`${row.name}: tree says ${labels[g.results[i].predicted]}`}
                    onClick={() => setPicked(picked === i ? null : i)}
                  >
                    <span aria-hidden="true">
                      {right ? '✓' : '✗'} {row.name}
                      {right ? '' : ` said ${labels[g.results[i].predicted]}`}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )

  const addForm = (
    <fieldset className="act-lt-form">
      <legend className="act-lt-legend">Add an animal</legend>
      <label className="act-lt-formrow">
        <span className="act-lt-formlabel">Name</span>
        <input
          className="act-number-input"
          type="text"
          autoComplete="off"
          maxLength={MAX_NAME}
          value={name}
          aria-label="Item name"
          placeholder="e.g. rabbit"
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <div className="act-lt-formrow">
        <span className="act-lt-formlabel">Which are true?</span>
        <div
          className="act-lt-chips"
          role="group"
          aria-label="Which are true?"
          data-act-control="group"
        >
          {features.map((feature, i) => (
            <ActChip
              key={feature}
              pressed={ticks[i]}
              onClick={() => setTicks((prev) => prev.map((t, j) => (j === i ? !t : t)))}
            >
              {featureQuestion(feature)}
            </ActChip>
          ))}
        </div>
      </div>
      <div className="act-lt-formrow">
        <span className="act-lt-formlabel">Add it as</span>
        <div className="act-lt-chips" role="group" aria-label="Add it as" data-act-control="group">
          {labels.map((text, i) => (
            <button
              key={text}
              type="button"
              disabled={full}
              className={`act-lt-add act-lt-tone-${i % 6}`}
              onClick={() => addExample(i)}
            >
              + {text}
            </button>
          ))}
        </div>
      </div>
    </fieldset>
  )

  const countText = `${clean.examples.length} of ${cap}${full ? ' (full)' : ''}`
  const addCard = readOnly ? null : folded ? (
    <ActFold
      fold={{ id: 'add', title: '+ Add an animal', summary: countText, children: addForm }}
      open={formOpen}
      onToggle={(open) => setFormChoice({ folded, open })}
    />
  ) : (
    <section className="act-lt-card" aria-label="Add an animal">
      <h3 className="act-lt-heading">
        Add an animal <span className="act-lt-count-text">{countText}</span>
      </h3>
      {addForm}
    </section>
  )

  const animals = (
    <section className="act-lt-card" aria-label="Your animals">
      <h3 className="act-lt-heading">
        Your animals ({clean.examples.length}
        {readOnly ? '' : ` of ${cap}`})
      </h3>
      {clean.examples.length === 0 ? (
        <p className="act-lt-empty">No animals yet.</p>
      ) : (
        <ul className="act-lt-list">
          {clean.examples.map((ex, i) => {
            const nm = ex.n || `item ${i + 1}`
            return (
              <li
                key={i}
                className={`act-lt-chip act-lt-tone-${ex.l % 6}`}
                title={`${nm}: ${describe(ex)}`}
              >
                <span>
                  <strong>{nm}</strong>: {labels[ex.l]}
                  {readOnly ? <span className="act-lt-chip__feat"> · {describe(ex)}</span> : null}
                </span>
                {!readOnly && (
                  <button
                    type="button"
                    className="act-lt-remove"
                    aria-label={`Remove ${nm}`}
                    onClick={() => removeExample(i)}
                  >
                    ×
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )

  const trySpec = {
    label: everTried && !g.tried ? 'Try it again' : 'Try it on new animals',
    icon: '🔍',
    disabled: g.count === 0,
    onClick: tryIt,
    testId: 'lt-try',
  }
  const action = readOnly ? null : g.count < 2 ? { secondary: trySpec } : { main: trySpec }

  return (
    <div className="act-panel act-lt" data-testid="learning_tree-activity">
      <ActivityLayout
        className="act-layout--lt"
        stageTop={stageTop}
        stage={stage}
        action={action}
        tip={tip}
        controls={
          <>
            {addCard}
            {animals}
          </>
        }
      />
    </div>
  )
}

export function LearningTreeStudentView(props) {
  return deckOn(props.task) ? (
    <LearningTreeDeckView {...props} />
  ) : (
    <LearningTreePlainView {...props} />
  )
}

export default {
  StudentView: LearningTreeStudentView,
  BuilderEditor: LearningTreeBuilderEditor,
}
