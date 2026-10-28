import { useState } from 'react'
import ActivityCorrect from '../ui/ActivityCorrect.jsx'
import {
  MAX_NAME,
  featureQuestion,
  featuresOf,
  gradeTask,
  hintFor,
  labelsOf,
  maxExamplesOf,
  normalizeState,
} from './learning_tree.js'
import LearningTreeBuilderEditor from './LearningTreeBuilderEditor.jsx'

// Learning Tree UI. Controlled view: ActivityHost passes `state`, `onChange(next | prev =>
// next)`, `readOnly` (teacher views and review). Never write to Firebase or storage here.
//
// The student adds labelled examples (a name, a tick per yes/no feature, a label). The tree is
// rebuilt from the examples on every render (a few dozen rows, so cheap) and drawn as nested
// boxes: no animation, no loop. The item being typed lives in this view; only a finished example,
// a removal or Try it reaches the state. The tutor's read-only view shows the same examples,
// tree and test results.

function Tree({ node, features, labels }) {
  if (node.leaf) {
    return (
      <div className={`act-lt-box act-lt-leaf act-lt-tone-${node.label % 6}`} data-testid="lt-leaf">
        <strong>{labels[node.label]}</strong>
        <span className="act-lt-count">{node.n}</span>
      </div>
    )
  }
  return (
    <div className="act-lt-node">
      <div className="act-lt-box act-lt-question" data-testid="lt-question">
        {featureQuestion(features[node.feature])}
      </div>
      <div className="act-lt-kids">
        <div className="act-lt-kid">
          <span className="act-lt-branch">yes</span>
          <Tree node={node.yes} features={features} labels={labels} />
        </div>
        <div className="act-lt-kid">
          <span className="act-lt-branch">no</span>
          <Tree node={node.no} features={features} labels={labels} />
        </div>
      </div>
    </div>
  )
}

export function LearningTreeStudentView({ task, state, onChange, readOnly = false }) {
  const features = featuresOf(task)
  const labels = labelsOf(task)
  const clean = normalizeState(task, state)
  const g = gradeTask(task, clean)
  const cap = maxExamplesOf(task)
  const [name, setName] = useState('')
  const [ticks, setTicks] = useState(() => features.map(() => false))
  const [label, setLabel] = useState(null)
  const full = clean.examples.length >= cap
  const canAdd = !readOnly && !full && label !== null

  function change(fn) {
    onChange?.((prev) => fn(normalizeState(task, prev)))
  }

  function addExample() {
    if (!canAdd) return
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
    setLabel(null)
  }

  function removeExample(index) {
    change((prev) => ({
      ...prev,
      examples: prev.examples.filter((_, i) => i !== index),
      tried: false,
    }))
  }

  function tryIt() {
    change((prev) => ({ ...prev, tried: prev.examples.length > 0 }))
  }

  const describe = (ex) => {
    const yes = features.filter((_, i) => ex.f[i] === '1').map((f) => f.replace(/_/g, ' '))
    return yes.length ? yes.join(', ') : 'none of the features'
  }
  const hint = hintFor(task, clean)

  return (
    <div className="act-panel act-lt" data-testid="learning_tree-activity">
      {!readOnly && (
        <fieldset className="act-lt-form">
          <legend className="act-prompt">Add an example</legend>
          <label className="act-row">
            <span style={{ fontWeight: 600 }}>Name</span>
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
          <div className="act-row" role="group" aria-label="Which are true?">
            {features.map((feature, i) => (
              <button
                key={feature}
                type="button"
                className="act-btn act-lt-toggle"
                aria-pressed={ticks[i]}
                onClick={() => setTicks((prev) => prev.map((t, j) => (j === i ? !t : t)))}
              >
                {ticks[i] ? '✓ ' : ''}
                {featureQuestion(feature)}
              </button>
            ))}
          </div>
          <div className="act-row" role="radiogroup" aria-label="Label">
            {labels.map((text, i) => (
              <button
                key={text}
                type="button"
                role="radio"
                aria-checked={label === i}
                className={`act-btn act-lt-label act-lt-tone-${i % 6}`}
                onClick={() => setLabel(i)}
              >
                {text}
              </button>
            ))}
          </div>
          <div className="act-row">
            <button type="button" className="act-btn" disabled={!canAdd} onClick={addExample}>
              Add example
            </button>
            <span className="act-lt-count-text">
              {clean.examples.length} of {cap}
              {full ? ' (full)' : ''}
            </span>
          </div>
        </fieldset>
      )}

      <section aria-label="Examples">
        <h3 className="act-lt-heading">
          Examples ({clean.examples.length}
          {readOnly ? '' : ` of ${cap}`})
        </h3>
        {clean.examples.length === 0 ? (
          <p className="act-lt-empty">No examples yet.</p>
        ) : (
          <ul className="act-lt-list">
            {clean.examples.map((ex, i) => (
              <li key={i} className={`act-lt-chip act-lt-tone-${ex.l % 6}`}>
                <span>
                  <strong>{ex.n || `item ${i + 1}`}</strong> · {describe(ex)} → {labels[ex.l]}
                </span>
                {!readOnly && (
                  <button
                    type="button"
                    className="act-btn act-lt-remove"
                    aria-label={`Remove ${ex.n || `item ${i + 1}`}`}
                    onClick={() => removeExample(i)}
                  >
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Your tree">
        <h3 className="act-lt-heading">
          Your tree {g.count > 0 && <span className="act-lt-count-text">(depth {g.depth})</span>}
        </h3>
        {g.count === 0 ? (
          <p className="act-lt-empty">Add examples and the tree grows by itself.</p>
        ) : (
          <div className="act-lt-scroll" data-testid="lt-tree">
            <Tree node={g.tree} features={features} labels={labels} />
          </div>
        )}
      </section>

      <section aria-label="Try it">
        {!readOnly && (
          <button type="button" className="act-btn" disabled={g.count === 0} onClick={tryIt}>
            Try it on new things
          </button>
        )}
        {g.tried && (
          <div data-testid="lt-results">
            <p className="act-result">
              Your tree got {g.correct} of {g.total} right
            </p>
            <ul className="act-lt-list">
              {g.rows.map((row, i) => (
                <li key={row.id}>
                  {g.results[i].right ? '✓' : '✗'} {row.name}: tree says{' '}
                  {labels[g.results[i].predicted]}
                </li>
              ))}
            </ul>
          </div>
        )}
        {g.passed && <ActivityCorrect>Your tree works!</ActivityCorrect>}
        {!g.passed && hint && (!readOnly || g.count > 0) && (
          <p className="act-hint" role="status">
            💡 {hint}
          </p>
        )}
      </section>
    </div>
  )
}

export default {
  StudentView: LearningTreeStudentView,
  BuilderEditor: LearningTreeBuilderEditor,
}
