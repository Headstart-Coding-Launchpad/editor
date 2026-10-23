import React from 'react'
import definition from './definition.js'
import {
  GOALS,
  GOAL_IDS,
  LESSON,
  PARTS,
  PHASE_1_LESSONS,
  SECTIONS,
  WORLDS,
  WORLD_IDS,
  catalogueFor,
  crateIdsFor,
  lessonOf,
  partById,
  promptFor,
  worldIdOf,
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

const WORLD_HINTS = {
  station: 'Lessons 1 to 4: power, crates, modules and parts',
  zoo: 'Lesson 3: drag animals into their enclosures',
  toyshop: 'Lesson 4: scroll a catalogue of toys',
}

// The goals that can be set in a task: those for its lesson that make sense in its world.
const goalsForTask = (task) =>
  GOAL_IDS.filter(
    (id) =>
      GOALS[id].lessons.includes(lessonOf(task)) &&
      (GOALS[id].worlds ?? ['station']).includes(worldIdOf(task)) &&
      !GOALS[id].yamlOnly
  )

// The targets a goal may point at in a task: [{ value, label }]. Empty when the goal has none.
function targetOptions(task, goalId) {
  const kind = GOALS[goalId]?.target
  if (kind === 'section') return SECTIONS.map((s) => ({ value: s.id, label: s.label }))
  if (kind === 'colour') return COLOUR_OPTIONS
  if (kind === 'crate')
    return crateIdsFor(task).map((id) => ({ value: id, label: partById(id).label }))
  if (kind === 'kind') return WORLDS.zoo.enclosures.map((e) => ({ value: e.kind, label: e.label }))
  if (kind === 'part') {
    const ids =
      goalId === 'place_part' || goalId === 'order_part'
        ? catalogueFor(task)
        : worldIdOf(task) === 'station'
          ? PARTS.filter((p) => p.lesson <= (task.lesson ?? 1)).map((p) => p.id)
          : WORLDS[worldIdOf(task)].catalogue
    return ids.map((id) => ({ value: id, label: partById(id)?.label ?? id }))
  }
  return []
}

function ItemFields({ task, item, update, index }) {
  const n = index + 1
  const goals = goalsForTask(task)
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
          placeholder={
            promptFor({ ...item, prompt: undefined }, lessonOf(task), worldIdOf(task)) ||
            'Optional prompt'
          }
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
  const worldId = worldIdOf(task)
  const lessonCatalogue =
    worldId === 'station' ? (LESSON[lesson]?.catalogue ?? []) : WORLDS[worldId].catalogue

  function setWorld(next) {
    const patch = { ...task }
    if (next === 'station') delete patch.world
    else {
      patch.world = next
      patch.lesson = WORLDS[next].lessons[0]
    }
    // The own part list belongs to one world.
    delete patch.catalogue
    delete patch.mistakes
    onUpdate(patch)
  }

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

      <Field label="World" hint="Where this week's build happens. Each world is saved separately.">
        <ChoiceCards
          ariaLabel="Station world"
          value={worldId}
          options={WORLD_IDS.map((id) => ({
            value: id,
            label: WORLDS[id].label,
            hint: WORLD_HINTS[id],
          }))}
          onChange={setWorld}
        />
      </Field>

      {worldId === 'station' && (
        <Field
          label="Lesson"
          hint="Earlier lessons are already built; this lesson is set up fresh."
        >
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
      )}

      <Field
        label="Core items (rest are bonus)"
        hint="How many goals make the round. The FIRST this many goals are required; the rest are bonus. Blank means all."
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
        hint="done in any order. Build-job fields (order, match, card, onlyNoted, count, and the task's crates and note) are set in YAML; see docs/authoring/activities/station.md"
        rows={task.items}
        validation={validation}
        addLabel="+ Add goal"
        onChange={(items) => onUpdate({ ...task, items })}
        makeRow={(items) => {
          const goal = goalsForTask(task)[0] ?? 'power_on'
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
