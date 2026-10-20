import React from 'react'
import NameTagPanel from './NameTagPanel.jsx'
import {
  getPanelPeekLine,
  getShowVariables,
  panelRunForTask,
  readSyncedVariables,
} from './variablesPanel.js'

/**
 * The name-tag panel for a task with `showVariables` (nothing otherwise). Two sources:
 *
 * - the student's own workspace: `panel` is `cs.variablesPanel` (useVariablesPanel) — the last
 *   run and editable predictions;
 * - a synced copy (`synced`): the tutor's view of a student (students/{id}/currentVariables) or
 *   a Go Live broadcast (teacherLive.variablesPanel) — read-only.
 *
 * `code` is the code the editor beside it shows, so an `at: marker` panel can say which line
 * it shows the values before ("Values just before line N", getPanelPeekLine).
 *
 * `links` / `activeLink` / `onLinkActive`: linked tags (./links.js), as NameTagPanel takes them;
 * the workspace builds them so the editor beside it marks the same names.
 *
 * `placement`: 'above' while a predict task's tags sit above the code (predictTagsAbove).
 *
 * `hidden` covers the views with no panel data (a previous task's saved code, the tutor
 * editing the student's code).
 */
export default function TaskVariablesPanel({
  task,
  panel = null,
  synced = undefined,
  code = null,
  running = false,
  audience = 'student',
  hidden = false,
  placement = 'side',
  links = null,
  activeLink = null,
  onLinkActive,
  style,
}) {
  const config = getShowVariables(task)
  if (!config || hidden) return null
  const peekLine = getPanelPeekLine(task, code)
  // Task ids can arrive as numbers or strings (realtime database keys), so compare as text.
  const isThisTask = (value) => value?.taskId != null && String(value.taskId) === String(task?.id)
  const run = panelRunForTask(task, { panel, synced })
  if (synced !== undefined) {
    const { predictions } = readSyncedVariables(synced)
    const sameTask = (value) => value?.taskId == null || isThisTask(value)
    return (
      <NameTagPanel
        config={config}
        run={run}
        predictions={predictions && sameTask(predictions) ? predictions : null}
        peekLine={peekLine}
        readOnly
        audience={audience}
        placement={placement}
        links={links}
        activeLink={activeLink}
        onLinkActive={onLinkActive}
        style={style}
      />
    )
  }
  const predictions = isThisTask(panel?.predictions) ? panel.predictions : null
  return (
    <NameTagPanel
      config={config}
      run={run}
      predictions={predictions}
      peekLine={peekLine}
      onPredictionChange={panel?.setPrediction}
      onPredictionCommit={panel?.commitPredictions}
      onTypePredictionChange={panel?.setTypePrediction}
      running={running}
      audience={audience}
      placement={placement}
      links={links}
      activeLink={activeLink}
      onLinkActive={onLinkActive}
      style={style}
    />
  )
}
