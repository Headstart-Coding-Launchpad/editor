import React, { useMemo, useState } from 'react'
import { MarkdownRenderer } from '../shared/markdown'
import { unmetRequirements } from '../shared/input/index.js'
import { useInputCapabilities } from '../shared/input/useInputCapabilities.js'
import { getTaskActivityUi } from './registry.js'
import { UNKNOWN_ACTIVITY_ID } from './resolve.js'
import { deserializeActivityState } from './state.js'
import { describeActivityDevice, effectiveCapabilities } from './device.js'

// ActivityHost renders a hosted activity task (taskType 'activity') in the classroom. The
// state, persistence, live sync, grading, reset and teacher-edit rules live once in
// useActivityState (src/app/hooks); this component picks which state to show and applies the
// device rules:
//   - the student's own state (editable), an earlier task's saved state (review, read-only), or
//     a teacher's Go Live broadcast (teacherLive.answer, read-only);
//   - `requires` checked with unmetRequirements; `touchFallback` decides what happens when a
//     requirement is missing ('virtual_keyboard' → on-screen keyboard, 'block' → notice,
//     'equivalent' → touch gestures count);
//   - an unknown activityType shows a friendly "not available" notice.

export function UnavailableActivityNotice() {
  return (
    <div
      className="act-notice act-notice--warning"
      role="status"
      data-testid="activity-unavailable"
    >
      🧩 This activity isn't available in this version of Headstart. Try reloading the page, or ask
      your teacher to help you move on to the next task.
    </div>
  )
}

export function ActivityDeviceBadge({ state }) {
  const device = describeActivityDevice(state)
  if (!device) return null
  return (
    <span className="act-badge" title={`Done on: ${device.label}`} data-testid="activity-device">
      {device.icon} {device.label}
    </span>
  )
}

function ActivityHeader({ task, lessonType }) {
  const text = task?.explainer ?? task?.description ?? ''
  return (
    <>
      {task?.title && <h2 className="act-title">{task.title}</h2>}
      {text && <MarkdownRenderer content={text} topicType={lessonType ?? null} disableCopy />}
    </>
  )
}

/**
 * Presentational activity surface: header plus the activity's StudentView (or its
 * TeacherLiveView when `teacher`). Used by ActivityHost, the teacher's StudentModal and the
 * teacher editor panel. `state` is the parsed activity state.
 */
export function ActivityView({
  task,
  state,
  onChange,
  onSubmit,
  readOnly = false,
  teacher = false,
  device = {},
  showHeader = true,
  lessonType = null,
}) {
  const ui = getTaskActivityUi(task)
  if (!ui || ui.id === UNKNOWN_ACTIVITY_ID || !ui.StudentView) {
    return (
      <div className="act-host">
        {showHeader && <ActivityHeader task={task} lessonType={lessonType} />}
        <UnavailableActivityNotice />
      </div>
    )
  }
  const View = teacher && ui.TeacherLiveView ? ui.TeacherLiveView : ui.StudentView
  return (
    <div className="act-host" data-activity={ui.id}>
      {showHeader && <ActivityHeader task={task} lessonType={lessonType} />}
      <View
        // Remount per task so item navigation and recorders never carry across tasks.
        key={task?.id}
        task={task}
        state={state}
        onChange={readOnly ? undefined : onChange}
        onSubmit={readOnly ? undefined : onSubmit}
        readOnly={readOnly}
        device={device}
        teacher={teacher}
      />
    </div>
  )
}

function RequirementNotice({ unmet, fallback, onHaveKeyboard }) {
  if (!unmet.length) return null
  if (fallback === 'block') {
    return (
      <div className="act-notice act-notice--warning" role="status" data-testid="activity-blocked">
        {unmet.includes('physicalKeyboard')
          ? '⌨️ This activity needs a real keyboard.'
          : '🖱️ This activity needs a mouse or trackpad.'}{' '}
        Ask your teacher what to do next.
        {unmet.includes('physicalKeyboard') && (
          <button type="button" className="btn-ghost-outline act-btn" onClick={onHaveKeyboard}>
            I have a keyboard
          </button>
        )}
      </div>
    )
  }
  if (unmet.includes('physicalKeyboard')) {
    return (
      <div className="act-notice" role="status" data-testid="activity-virtual-keyboard">
        ⌨️ No keyboard found, so you can use the keyboard on the screen.
        <button type="button" className="btn-ghost-outline act-btn" onClick={onHaveKeyboard}>
          I have a keyboard
        </button>
      </div>
    )
  }
  if (unmet.includes('finePointer') || unmet.includes('hover')) {
    return (
      <div className="act-notice" role="status" data-testid="activity-touch">
        👆 On a touch screen: tap to click, double-tap to double-click, and press and hold to
        right-click.
      </div>
    )
  }
  return null
}

/**
 * Classroom host for the displayed activity task.
 *
 * - `activity`: useActivityState's result (cs.activity) for the student's current task.
 * - `broadcastAnswer`: teacherLive.answer while a broadcast is forced on this screen
 *   (undefined when not broadcasting).
 * - `reviewing`: the student is looking back at an earlier task (read-only saved state).
 */
export default function ActivityHost({
  task,
  activity,
  broadcastAnswer,
  reviewing = false,
  lessonType = null,
}) {
  const capabilities = useInputCapabilities()
  const [keyboardOverride, setKeyboardOverride] = useState(false)
  const ui = getTaskActivityUi(task)
  const broadcasting = broadcastAnswer !== undefined
  const ownTask = !broadcasting && !reviewing && activity?.task?.id === task?.id
  const readOnly = !ownTask

  const broadcastState = useMemo(
    () => (broadcasting ? deserializeActivityState(ui, task, broadcastAnswer) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [broadcasting, broadcastAnswer, task?.id, ui?.id]
  )
  const reviewState = useMemo(
    () => (!broadcasting && !ownTask ? (activity?.readSavedState?.(task) ?? null) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [broadcasting, ownTask, task?.id]
  )
  const state = broadcasting ? broadcastState : ownTask ? activity.state : reviewState

  const effective = effectiveCapabilities(capabilities, { keyboardOverride })
  const unmet = ui && !readOnly ? unmetRequirements(ui.requires ?? {}, effective) : []
  const fallback = ui?.touchFallback ?? 'equivalent'
  const blocked = unmet.length > 0 && fallback === 'block'
  const device = {
    touch: !!effective.touch && !effective.finePointer,
    physicalKeyboard: effective.physicalKeyboard,
    virtualKeyboard: unmet.includes('physicalKeyboard') && fallback === 'virtual_keyboard',
  }

  if (blocked) {
    return (
      <div className="act-host">
        <ActivityHeader task={task} lessonType={lessonType} />
        <RequirementNotice
          unmet={unmet}
          fallback={fallback}
          onHaveKeyboard={() => setKeyboardOverride(true)}
        />
      </div>
    )
  }

  return (
    <div className="act-host" data-testid="activity-host">
      {!readOnly && ui && ui.id !== UNKNOWN_ACTIVITY_ID && (
        <RequirementNotice
          unmet={unmet}
          fallback={fallback}
          onHaveKeyboard={() => setKeyboardOverride(true)}
        />
      )}
      <ActivityView
        task={task}
        state={state}
        onChange={activity?.onChange}
        onSubmit={activity?.onSubmit}
        readOnly={readOnly}
        device={device}
        lessonType={lessonType}
      />
    </div>
  )
}
