import React, { useCallback, useMemo, useRef, useState } from 'react'
import ActivityHost from './ActivityHost.jsx'
import { getTaskActivity } from './registry.pure.js'
import { deserializeActivityState, solutionOrInitialState } from './state.js'

// Builder preview of an activity task through the real ActivityHost (plan step 2.4). The
// author plays the activity as a student would, but nothing is written anywhere: state lives in
// an in-memory store for this page (kept while the author moves between tasks, dropped on
// reload) and a submit only grades and shows the verdict. Editing the task starts the preview
// again from the activity's initial state, so it always matches what is being authored.

const previewStore = new Map()

// Test-only: forget every preview's saved state.
export function clearActivityPreviewStore() {
  previewStore.clear()
}

function usePreviewActivity(task, definition, taskKey) {
  const storeKey = `${task?.id ?? ''}`
  const load = () => {
    const saved = previewStore.get(storeKey)
    const raw = saved && saved.taskKey === taskKey ? saved.raw : null
    return deserializeActivityState(definition, task, raw)
  }
  const [state, setState] = useState(load)
  const [result, setResult] = useState(null)
  const stateRef = useRef(state)

  function commit(next) {
    stateRef.current = next
    previewStore.set(storeKey, { taskKey, raw: definition.serialize(next) })
    setState(next)
  }

  function submit(stateArg) {
    if (definition.completion === 'none' && stateArg === undefined) return Promise.resolve(null)
    if (stateArg !== undefined && stateArg !== stateRef.current) commit(stateArg)
    const graded = definition.grade(task, stateArg ?? stateRef.current) ?? {}
    const passed = !!graded.passed
    const outcome = {
      passed,
      suggestion: passed ? '' : String(graded.suggestion ?? ''),
      itemResults: graded.itemResults ?? null,
    }
    setResult({ submitted: true, ...outcome })
    return Promise.resolve(outcome)
  }

  function handleChange(nextOrUpdater) {
    const prev = stateRef.current
    const next = typeof nextOrUpdater === 'function' ? nextOrUpdater(prev) : nextOrUpdater
    if (next === prev || next === undefined) return
    commit(next)
    const discrete = definition.classifyChange(prev, next) !== 'continuous'
    if (
      definition.completion === 'auto' &&
      !definition.submitsAnswers &&
      discrete &&
      definition.grade(task, next).passed
    ) {
      submit(next)
    }
  }

  const implRef = useRef(null)
  implRef.current = { handleChange, submit }
  const onChange = useCallback((next) => implRef.current.handleChange(next), [])
  const onSubmit = useCallback((next) => implRef.current.submit(next), [])

  function reset(nextState) {
    commit(nextState)
    setResult(null)
  }

  return { state, result, onChange, onSubmit, reset }
}

function PreviewBody({ task, definition, taskKey, lessonType }) {
  const preview = usePreviewActivity(task, definition, taskKey)
  const activity = {
    task,
    state: preview.state,
    onChange: preview.onChange,
    onSubmit: preview.onSubmit,
  }
  const result = preview.result
  return (
    <div className="te-activity-preview" data-testid="activity-preview">
      <div className="te-activity-preview__actions">
        <button
          type="button"
          className="btn-ghost-outline te-secondary-btn"
          onClick={() => preview.reset(definition.initialState(task))}
        >
          Start again
        </button>
        {definition.solutionState && (
          <button
            type="button"
            className="btn-ghost-outline te-secondary-btn"
            onClick={() => preview.reset(solutionOrInitialState(definition, task))}
          >
            Show answers
          </button>
        )}
      </div>
      <ActivityHost
        task={task}
        activity={activity}
        lessonType={lessonType}
        result={result ? { submitted: true, passed: result.passed } : null}
      />
      {result && (
        <div
          role="status"
          className={
            result.passed
              ? 'te-activity-preview__verdict te-activity-preview__verdict--pass'
              : 'te-activity-preview__verdict te-activity-preview__verdict--fail'
          }
        >
          {result.passed
            ? 'All correct: students will see the completion banner.'
            : `Not yet${result.suggestion ? `: ${result.suggestion}` : '.'}`}
        </div>
      )}
    </div>
  )
}

/** Plays `task` through ActivityHost with in-memory state. Renders nothing for other tasks. */
export default function ActivityPreview({ task, lessonType = null }) {
  const definition = getTaskActivity(task)
  const taskKey = useMemo(() => JSON.stringify(task ?? null), [task])
  if (!definition) return null
  // Remount on every task edit: the preview restarts from the edited task.
  return (
    <PreviewBody
      key={taskKey}
      task={task}
      definition={definition}
      taskKey={taskKey}
      lessonType={lessonType}
    />
  )
}
