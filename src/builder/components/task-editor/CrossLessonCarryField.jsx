import { useEffect, useState } from 'react'
import { Field } from './TaskEditorFields'
import { getModuleDefinition } from '../../../modules/definitions'
import { crossLessonCarryField } from '../../../shared/roster/crossLessonCarry'
import { fetchLessonById } from '../../../shared/lessonService'
import { flattenTasks } from '../../../shared/taskUtils'

const LOOKUP_DELAY_MS = 500

function parseTaskId(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  return /^\d+$/.test(text) ? Number(text) : text
}

// Builder field for cross-lesson carry (`carryCodeFromLesson` / `carryBlocksFromLesson`,
// src/shared/roster/crossLessonCarry.js): the stock lesson id and task id whose saved work a
// student starts this task from. Shown only on modules that save roster work. Setting it clears
// the in-lesson carry, which can't be combined with it. The source is looked up (softly) so the
// author sees the lesson and task it names.
export default function CrossLessonCarryField({ task, lesson, onUpdate }) {
  const definition = getModuleDefinition(lesson?.type)
  const field = crossLessonCarryField(definition)
  const value = field ? task[field] : null
  const lessonText = typeof value?.lesson === 'string' ? value.lesson : ''
  const taskText = value?.task != null ? String(value.task) : ''
  const [lookup, setLookup] = useState({ key: null, text: null })
  const lookupKey = lessonText.trim() ? `${lessonText.trim()}::${taskText.trim()}` : null

  useEffect(() => {
    if (!lookupKey) return undefined
    let cancelled = false
    const timer = setTimeout(() => {
      fetchLessonById(lessonText.trim())
        .then((source) => {
          if (cancelled) return
          if (!source) {
            setLookup({ key: lookupKey, text: 'Lesson not found (it may not be published yet).' })
            return
          }
          const sourceTask = flattenTasks(source.tasks ?? []).find(
            (item) => String(item?.id) === taskText.trim()
          )
          const lessonName = source.title || source.id
          setLookup({
            key: lookupKey,
            text: sourceTask
              ? `${lessonName} → task ${sourceTask.id}: ${sourceTask.title || 'Untitled'}`
              : `${lessonName} has no task ${taskText.trim() || '…'}.`,
          })
        })
        .catch(() => !cancelled && setLookup({ key: lookupKey, text: null }))
    }, LOOKUP_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // lessonText / taskText are what lookupKey encodes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookupKey])

  if (!field) return null

  function update(nextLesson, nextTask) {
    const next = { ...task }
    if (!String(nextLesson).trim() && !String(nextTask).trim()) {
      delete next[field]
    } else {
      next[field] = { lesson: String(nextLesson).trim(), task: parseTaskId(nextTask) }
      // In-lesson carry and cross-lesson carry can't be combined on one task.
      if (next[definition.carryThroughField] != null) next[definition.carryThroughField] = null
    }
    onUpdate(next)
  }

  return (
    <Field label="Carry from an earlier lesson">
      <div style={s.wrap}>
        <p style={s.hint}>
          Start each student from their own saved work on a task in an earlier lesson (for
          two-lesson projects). Use the stock lesson id, not a class fork. Students the tutor hasn’t
          matched to the class list wait, and anyone with nothing saved gets the starter.
        </p>
        <div style={s.row}>
          <input
            className="te-input"
            style={s.lessonInput}
            value={lessonText}
            placeholder="Lesson id, e.g. python-1-11"
            aria-label="Earlier lesson id"
            onChange={(e) => update(e.target.value, taskText)}
          />
          <input
            className="te-input"
            style={s.taskInput}
            value={taskText}
            placeholder="Task id"
            aria-label="Earlier lesson task id"
            onChange={(e) => update(lessonText, e.target.value)}
          />
        </div>
        {lookupKey && lookup.key === lookupKey && lookup.text && (
          <p style={s.hint} data-testid="cross-lesson-carry-lookup">
            {lookup.text}
          </p>
        )}
      </div>
    </Field>
  )
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 6 },
  row: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  lessonInput: { flex: '2 1 180px' },
  taskInput: { flex: '1 1 80px' },
  hint: { margin: 0, fontSize: 12, color: 'var(--colour-muted)' },
}
