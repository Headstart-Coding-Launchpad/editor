import React from 'react'
import NameTagPanel from './NameTagPanel.jsx'
import { getShowVariables, readSyncedVariables } from './variablesPanel.js'

/**
 * The name-tag panel for a task with `showVariables` (nothing otherwise). Two sources:
 *
 * - the student's own workspace: `panel` is `cs.variablesPanel` (useVariablesPanel) — the last
 *   run and editable predictions;
 * - a synced copy (`synced`): the tutor's view of a student (students/{id}/currentVariables) or
 *   a Go Live broadcast (teacherLive.variablesPanel) — read-only.
 *
 * `hidden` covers the views with no panel data (a previous task's saved code, the tutor
 * editing the student's code).
 */
export default function TaskVariablesPanel({
  task,
  panel = null,
  synced = undefined,
  running = false,
  audience = 'student',
  hidden = false,
  style,
}) {
  const config = getShowVariables(task)
  if (!config || hidden) return null
  // Task ids can arrive as numbers or strings (realtime database keys), so compare as text.
  const isThisTask = (value) => value?.taskId != null && String(value.taskId) === String(task?.id)
  if (synced !== undefined) {
    const { run, predictions } = readSyncedVariables(synced)
    const sameTask = (value) => value?.taskId == null || isThisTask(value)
    return (
      <NameTagPanel
        config={config}
        run={run && sameTask(run) ? run : null}
        predictions={predictions && sameTask(predictions) ? predictions : null}
        readOnly
        audience={audience}
        style={style}
      />
    )
  }
  const predictions = isThisTask(panel?.predictions) ? panel.predictions : null
  const run = isThisTask(panel?.run) ? panel.run : null
  return (
    <NameTagPanel
      config={config}
      run={run}
      predictions={predictions}
      onPredictionChange={panel?.setPrediction}
      onPredictionCommit={panel?.commitPredictions}
      running={running}
      audience={audience}
      style={style}
    />
  )
}
