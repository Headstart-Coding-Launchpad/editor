// StudentView's control highlight (src/shared/controlHighlight.js): picks what to pulse on this
// student's screen and runs it through useControlHighlight.
//   - the task's `highlight` field, once per task per student, when the task opens
//   - the tutor's live command, per student (StudentModal) or whole class (TeacherView),
//     whichever was pushed last; a newer one replaces whatever is pulsing
// A live command for another task is ignored (the class moved on), and so is one more than 20 s
// old, so a reload or a late join doesn't replay an old highlight.
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CONTROL_HIGHLIGHT_TIMEOUT_MS,
  claimTaskHighlight,
  highlightTargetText,
  pickLiveControlHighlight,
  resolveHighlightTarget,
} from '../../shared/controlHighlight.js'
import { useControlHighlight } from '../../shared/useControlHighlight.js'

export function useStudentControlHighlight({
  enabled = true,
  lessonId,
  identityId,
  task,
  moduleType,
  studentCommand,
  classCommand,
  serverTimeOffset = 0,
}) {
  const [active, setActive] = useState(null)
  const taskId = task?.id ?? null
  const live = pickLiveControlHighlight(studentCommand, classCommand)
  const liveKey = live ? `live:${live.pushedAt}:${live.target}` : null
  const handledLiveRef = useRef(null)

  // Task field: once per task per student, when the task opens.
  useEffect(() => {
    if (!enabled || taskId == null || !task?.highlight) return
    const target = resolveHighlightTarget(moduleType, task.highlight)
    if (!target || !claimTaskHighlight(lessonId, taskId, identityId)) return
    setActive({ key: `task:${taskId}:${target.id}`, target, taskId })
    // The task's own field is read once per opened task; later edits don't re-pulse it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, taskId, moduleType, lessonId, identityId])

  // Live command from the tutor. Commands are in server time; one older than the highlight's
  // own lifetime (a reload, a late join) is not replayed.
  useEffect(() => {
    if (!enabled || !live || handledLiveRef.current === liveKey) return
    if (Date.now() + (serverTimeOffset || 0) - live.pushedAt > CONTROL_HIGHLIGHT_TIMEOUT_MS) return
    if (live.taskId != null && taskId != null && String(live.taskId) !== String(taskId)) return
    const target = resolveHighlightTarget(moduleType, live.target)
    if (!target) return
    handledLiveRef.current = liveKey
    setActive({ key: liveKey, target, taskId })
    // `live` is rebuilt from the session on every render; liveKey is its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, liveKey, taskId, moduleType])

  // The tutor's clear (no live command left) stops a live highlight still pulsing.
  useEffect(() => {
    if (!liveKey) setActive((prev) => (prev?.key.startsWith('live:') ? null : prev))
  }, [liveKey])

  // Leaving the task (or switching module) ends whatever it was pulsing.
  useEffect(() => {
    setActive((prev) => (prev && prev.taskId !== taskId ? null : prev))
  }, [taskId, moduleType])

  const handleDone = useCallback(() => setActive(null), [])
  const { ring, revealPanes } = useControlHighlight(enabled ? active : null, {
    onDone: handleDone,
  })

  return {
    ring,
    revealPanes,
    announce: active ? `Your tutor is pointing at the ${highlightTargetText(active.target)}` : '',
  }
}

// The pane highlight with the control highlight's reveal panes added (no duplicates).
export function mergeHighlightedPanes(panes, revealPanes) {
  if (!revealPanes?.length) return panes
  return [...new Set([...(panes ?? []), ...revealPanes])]
}
