import { useState } from 'react'
import ActivityCorrect from '../ui/ActivityCorrect.jsx'
import RoundProgress, { RoundFinished } from '../ui/RoundProgress.jsx'
import TutorItemPicker from '../ui/TutorItemPicker.jsx'
import { useRoundFlow } from '../ui/useRoundFlow.js'
import { gradeItem } from './template_activity.js'

// Template Activity UI. Controlled view: ActivityHost passes `state`, `onChange(next | prev =>
// next)`, `onSubmit()` (grades and reports; resolves to { passed }; unused here because the
// activity is marked as you go), `readOnly` (teacher views and review) and `device` ({ touch, virtualKeyboard }). Never write to Firebase or storage
// here: useActivityState owns persistence and live sync.
//
// UI rules (docs/UI_STYLE_GUIDE.md, docs/architecture/activities.md): controls at least 44px,
// everything reachable and usable from the keyboard, honour prefers-reduced-motion, use the
// shared `act-` CSS classes in src/index.css.
// TODO(new-activity): replace the starter "type the answer" view with the real exercise.

function itemStateOf(state, item) {
  return { answer: state?.items?.[item.id]?.answer ?? '' }
}

export function TemplateActivityStudentView({
  task,
  state,
  onChange,
  readOnly = false,
  teacher = false,
}) {
  // A tutor (read-only view, or editing a student's answers) never lingers or advances: they
  // follow the student's item or pick one in the tutor-only picker.
  const tutor = readOnly || teacher
  const items = task?.items ?? []
  const isDone = (item) => gradeItem(task, item, itemStateOf(state, item)).correct
  // An activity task is one round: a single goal of a few reps that moves on by itself, with no
  // in-task navigation. useRoundFlow shows the first question that is not done, holds its tick
  // for a moment, then moves on. The tutor's read-only view picks any question to look at.
  const flow = useRoundFlow(items, isDone, { readOnly: tutor })
  const [tutorPickId, setTutorPickId] = useState(null)
  const lastItem = items[items.length - 1]
  const current = tutor
    ? (items.find((item) => item.id === tutorPickId) ??
      items.find((item) => !isDone(item)) ??
      lastItem)
    : (flow.current ?? lastItem)
  if (!current) return <p>This task has no questions yet.</p>
  if (!tutor && flow.finished) {
    // Play again clears the answers on this device; the task stays passed.
    return (
      <div className="act-panel" data-testid="template_activity-activity">
        <RoundFinished total={items.length} onPlayAgain={() => onChange?.({ v: 1, items: {} })} />
      </div>
    )
  }
  const itemState = itemStateOf(state, current)
  const result = gradeItem(task, current, itemState)

  function update(patch) {
    if (readOnly || flow.lingering) return
    onChange?.((prev) => ({
      ...(prev ?? { v: 1 }),
      items: { ...(prev?.items ?? {}), [current.id]: { ...itemStateOf(prev, current), ...patch } },
    }))
  }

  const statusFor = (item) => {
    const itemResult = gradeItem(task, item, itemStateOf(state, item))
    return itemResult.correct ? 'done' : null
  }

  return (
    <div className="act-panel" data-testid="template_activity-activity">
      <RoundProgress done={flow.doneCount} total={items.length} />
      {tutor && (
        <TutorItemPicker
          items={items}
          currentId={current.id}
          onSelect={setTutorPickId}
          statusFor={statusFor}
        />
      )}
      <p className="act-prompt">{current.prompt}</p>
      <label className="act-row">
        <span style={{ fontWeight: 600 }}>Answer</span>
        <input
          className="act-number-input"
          type="text"
          autoComplete="off"
          value={itemState.answer}
          disabled={readOnly || flow.lingering}
          aria-label="Your answer"
          onChange={(event) => update({ answer: event.target.value })}
        />
      </label>

      {/* Marked as you go: a tick the moment it is right, nothing "wrong" until then. */}
      {result.correct && <ActivityCorrect />}
      {readOnly && !result.correct && itemState.answer && result.hint && (
        <p className="act-hint" role="status">
          💡 {result.hint}
        </p>
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
