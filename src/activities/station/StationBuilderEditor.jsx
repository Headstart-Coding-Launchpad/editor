import React from 'react'
import definition from './definition.js'
import {
  CRATE_IDS,
  GOALS,
  GOAL_IDS,
  LESSON,
  PARTS,
  PHASE_1_LESSONS,
  SECTIONS,
  catalogueFor,
  partById,
  promptFor,
} from './station.js'
import {
  ChoiceCards,
  Field,
  InlineField,
  RowListEditor,
  ValidationMessages,
  nextItemId,
  readNumber,
  useActivityValidation,
} from '../ui/builderKit.jsx'

// Builder editor for Space station tasks: which lesson (1-4), how many goals make the round,
// the goal list (goal choices and target choices follow the lesson and goal) and, for lessons
// 3 and 4, which parts are on offer. validateTask messages show under the row they are about.

const LESSON_HINTS = {
  1: 'Click and keyboard: power and colours',
  2: 'Double-click: crates and crew',
  3: 'Drag: place parts, Ctrl+Z',
  4: 'Scroll a catalogue and order',
}

const COLOUR_OPTIONS = [
  { value: 'hull', label: 'Hull' },
  { value: 'lights', label: 'Lights' },
]

// The goals that can be set in a lesson.
const goalsForLesson = (lesson) => GOAL_IDS.filter((id) => GOALS[id].lessons.includes(lesson))

// The targets a goal may point at in a task: [{ value, label }]. Empty when the goal has none.
function targetOptions(task, goalId) {
  const kind = GOALS[goalId]?.target
  if (kind === 'section') return SECTIONS.map((s) => ({ value: s.id, label: s.label }))
  if (kind === 'colour') return COLOUR_OPTIONS
  if (kind === 'crate') return CRATE_IDS.map((id) => ({ value: id, label: partById(id).label }))
  if (kind === 'part') {
    const ids =
      goalId === 'place_part' || goalId === 'order_part'
        ? catalogueFor(task)
        : PARTS.filter((p) => p.lesson <= (task.lesson ?? 1)).map((p) => p.id)
    return ids.map((id) => ({ value: id, label: partById(id)?.label ?? id }))
  }
  return []
}

function ItemFields({ task, item, update, index }) {
  const n = index + 1
  const goals = goalsForLesson(task.lesson)
  const options = targetOptions(task, item.goal)
  const kind = GOALS[item.goal]?.target
  const known = goals.includes(item.goal)
  return (
    <>
      <InlineField label="Goal">
        <select
          className="te-select"
          value={item.goal ?? ''}
          aria-label={`Item ${n} goal`}
          onChange={(e) => {
            const goal = e.target.value
            update({ goal, target: GOALS[goal]?.target === 'colour' ? 'hull' : undefined })
          }}
        >
          {!known && (
            <option value={item.goal ?? ''}>
              {item.goal ? `${item.goal} (not in this lesson)` : '—'}
            </option>
          )}
          {goals.map((id) => (
            <option key={id} value={id}>
              {GOALS[id].label}
            </option>
          ))}
        </select>
      </InlineField>
      {options.length > 0 && (
        <InlineField label="Target">
          <select
            className="te-select"
            value={item.target ?? ''}
            aria-label={`Item ${n} target`}
            onChange={(e) => update({ target: e.target.value || undefined })}
          >
            {kind !== 'colour' && <option value="">Any</option>}
            {item.target && !options.some((o) => o.value === item.target) && (
              <option value={item.target}>{item.target} (not available)</option>
            )}
            {options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </InlineField>
      )}
      <InlineField label="Prompt" wide>
        <input
          className="te-input"
          value={item.prompt ?? ''}
          placeholder={promptFor({ ...item, prompt: undefined }) || 'Optional prompt'}
          aria-label={`Item ${n} prompt`}
          onChange={(e) => update({ prompt: e.target.value || undefined })}
        />
      </InlineField>
    </>
  )
}

export default function StationBuilderEditor({ task, onUpdate }) {
  const validation = useActivityValidation(definition, task)
  const lesson = task.lesson
  const lessonCatalogue = LESSON[lesson]?.catalogue ?? []

  function setLesson(next) {
    const patch = { ...task, lesson: next }
    // The own part list only applies to lessons 3 and 4, and only to that lesson's parts.
    if (Array.isArray(task.catalogue)) {
      const kept = task.catalogue.filter((id) => LESSON[next]?.catalogue.includes(id))
      if (next < 3 || kept.length === 0) delete patch.catalogue
      else patch.catalogue = kept
    }
    onUpdate(patch)
  }

  function setCoreItems(value) {
    const next = { ...task }
    if (value === undefined) delete next.coreItems
    else next.coreItems = value
    onUpdate(next)
  }

  function toggleCatalogue(id, on) {
    const current = catalogueFor(task)
    const chosen = lessonCatalogue.filter((p) => (p === id ? on : current.includes(p)))
    const next = { ...task }
    if (chosen.length === 0 || chosen.length === lessonCatalogue.length) delete next.catalogue
    else next.catalogue = chosen
    onUpdate(next)
  }

  return (
    <div className="te-act-editor" data-activity-editor="station">
      <ValidationMessages messages={validation.general} />

      <Field label="Lesson" hint="Earlier lessons are already built; this lesson is set up fresh.">
        <ChoiceCards
          ariaLabel="Station lesson"
          value={lesson}
          options={PHASE_1_LESSONS.map((n) => ({
            value: n,
            label: `${n}. ${LESSON[n].title}`,
            hint: LESSON_HINTS[n],
          }))}
          onChange={setLesson}
        />
      </Field>

      <Field
        label="Core items (rest are bonus)"
        hint="How many goals make the round. The task passes at this many; the rest are bonus. Blank means all."
      >
        <input
          className="te-input te-act-narrow"
          type="number"
          min="1"
          max={(task.items ?? []).length || undefined}
          step="1"
          value={task.coreItems ?? ''}
          aria-label="Core items"
          onChange={(e) => setCoreItems(readNumber(e.target.value))}
        />
      </Field>

      <RowListEditor
        label="Goals"
        hint="done in any order"
        rows={task.items}
        validation={validation}
        addLabel="+ Add goal"
        onChange={(items) => onUpdate({ ...task, items })}
        makeRow={(items) => {
          const goal = goalsForLesson(lesson)[0] ?? 'power_on'
          return {
            id: nextItemId(items),
            goal,
            ...(GOALS[goal].target === 'colour' ? { target: 'hull' } : {}),
          }
        }}
        renderRow={(item, update, index) => (
          <ItemFields task={task} item={item} update={update} index={index} />
        )}
      />

      {lessonCatalogue.length > 0 && (
        <Field
          label="Parts on offer"
          hint="Untick to take parts out of the tray or catalogue. All ticked is the lesson default."
        >
          <div className="te-act-choices" role="group" aria-label="Parts on offer">
            {lessonCatalogue.map((id) => (
              <label key={id} className="te-act-inline">
                <input
                  type="checkbox"
                  checked={catalogueFor(task).includes(id)}
                  onChange={(e) => toggleCatalogue(id, e.target.checked)}
                />
                <span>{partById(id)?.label ?? id}</span>
              </label>
            ))}
          </div>
        </Field>
      )}
    </div>
  )
}
