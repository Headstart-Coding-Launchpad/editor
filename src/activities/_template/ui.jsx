import { useState } from 'react'
import ItemNav from '../ui/ItemNav.jsx'
import ActivityCorrect from '../ui/ActivityCorrect.jsx'
import { gradeItem } from './template_activity.js'

// Template Activity UI. Controlled view: ActivityHost passes `state`, `onChange(next | prev =>
// next)`, `onSubmit()` (grades and reports; resolves to { passed }), `readOnly` (teacher views
// and review) and `device` ({ touch, virtualKeyboard }). Never write to Firebase or storage
// here: useActivityState owns persistence and live sync.
//
// UI rules (docs/UI_STYLE_GUIDE.md, docs/architecture/activities.md): controls at least 44px,
// everything reachable and usable from the keyboard, honour prefers-reduced-motion, use the
// shared `act-` CSS classes in src/index.css.
// TODO(new-activity): replace the starter "type the answer" view with the real exercise.

function itemStateOf(state, item) {
  return { answer: state?.items?.[item.id]?.answer ?? '' }
}

export function TemplateActivityStudentView({ task, state, onChange, onSubmit, readOnly = false }) {
  const items = task?.items ?? []
  const [index, setIndex] = useState(0)
  // Results captured when Check was pressed. An item's result clears as soon as the student
  // changes it, so work is never marked live.
  const [results, setResults] = useState({})
  const current = items[Math.min(index, items.length - 1)]
  if (!current) return <p>This task has no questions yet.</p>
  const itemState = itemStateOf(state, current)
  const result = readOnly ? gradeItem(task, current, itemState) : results[current.id]

  function update(patch) {
    if (readOnly) return
    setResults((prev) => {
      if (!(current.id in prev)) return prev
      const { [current.id]: _dropped, ...rest } = prev
      return rest
    })
    onChange?.((prev) => ({
      ...(prev ?? { v: 1 }),
      items: { ...(prev?.items ?? {}), [current.id]: { ...itemStateOf(prev, current), ...patch } },
    }))
  }

  async function handleCheck() {
    const outcome = await onSubmit?.()
    const next = {}
    for (const item of items) next[item.id] = gradeItem(task, item, itemStateOf(state, item))
    setResults(next)
    if (!outcome?.passed) {
      const firstWrong = items.findIndex((item) => !next[item.id]?.correct)
      if (firstWrong >= 0) setIndex(firstWrong)
    }
  }

  const statusFor = (item) => {
    const itemResult = readOnly ? gradeItem(task, item, itemStateOf(state, item)) : results[item.id]
    if (!itemResult) return null
    return itemResult.correct ? 'done' : 'wrong'
  }

  return (
    <div className="act-panel" data-testid="template_activity-activity">
      <ItemNav items={items} currentIndex={index} onSelect={setIndex} statusFor={statusFor} />
      <p className="act-prompt">{current.prompt}</p>
      <label className="act-row">
        <span style={{ fontWeight: 600 }}>Answer</span>
        <input
          className="act-number-input"
          type="text"
          autoComplete="off"
          value={itemState.answer}
          disabled={readOnly}
          aria-label="Your answer"
          onChange={(event) => update({ answer: event.target.value })}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !readOnly) handleCheck()
          }}
        />
      </label>

      {result && !result.correct && result.hint && (
        <p className="act-hint" role="status">
          💡 {result.hint}
        </p>
      )}
      {result?.correct && <ActivityCorrect />}

      {!readOnly && (
        <div className="act-row">
          <button type="button" className="btn-primary act-btn" onClick={handleCheck}>
            Check answers
          </button>
        </div>
      )}
    </div>
  )
}

// Optional: TeacherLiveView (teacher surfaces fall back to StudentView with readOnly). The card
// summary text comes from definition.summarize.
// TODO(new-activity): add a BuilderEditor ({ task, onUpdate }) for the Builder's Activity
// gallery (without one the Builder says to edit the task in YAML). Build it from
// ../ui/builderKit.jsx (RowListEditor, inline validateTask messages), like
// ../binary/BinaryBuilderEditor.jsx.
export default {
  StudentView: TemplateActivityStudentView,
}
