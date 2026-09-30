import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useLatestRef } from './useLatestRef'
import {
  hashSubmission,
  sandboxKindForContext,
  SANDBOX_TIME_MIN_MS,
  signalContextFor,
  NO_TASK_KEY,
} from '../../badges/signals'
import { isDesktopKeyboardShortcut, matchKeyboardWizardShortcut } from '../../badges/shortcuts'
import { comboOf, normalizeKeyEvent } from '../../shared/input/events.js'

// Signals are recorded only while a real student is in a live lesson or the teacher's sandbox —
// the same phases useStudentPresenceReporting reports in. Never solo, never the presentation
// window, never the Builder preview.
const SIGNAL_PHASES = ['lesson', 'sandbox']

// The work-area surfaces a keydown can land on. A module marks its own surface with
// data-badge-surface: 'app-shortcuts' (the Desktop) means its app actions' keyboard shortcuts
// (copy, cut, paste) count as `desktop_shortcut`.
export const WORK_AREA_SURFACES = Object.freeze({
  codeEditor: 'code-editor',
  blocks: 'blocks',
  appShortcuts: 'app-shortcuts',
})

// Where a keydown happened, if on the lesson work area: a code editor, the Blockly workspace or
// a module surface marked data-badge-surface. Anything else (the explainer, a quiz answer box,
// the page chrome) is not the work area and never counts.
export function workAreaSurfaceOf(target) {
  const el = target?.closest ? target : target?.parentElement
  if (!el?.closest) return null
  if (el.closest('.cm-editor')) return WORK_AREA_SURFACES.codeEditor
  if (el.closest('.injectionDiv, .blocklySvg')) return WORK_AREA_SURFACES.blocks
  return el.closest('[data-badge-surface]')?.getAttribute('data-badge-surface') || null
}

/** The Keyboard Wizard shortcut id a work-area keydown is, or null. AltGr never counts. */
export function workAreaShortcutFor(event) {
  const surface = workAreaSurfaceOf(event?.target)
  if (!surface || event.repeat || event.altKey) return null
  if (event.getModifierState?.('AltGraph')) return null
  if (
    surface === WORK_AREA_SURFACES.appShortcuts &&
    isDesktopKeyboardShortcut(comboOf(normalizeKeyEvent(event)))
  ) {
    return 'desktop_shortcut'
  }
  const match = matchKeyboardWizardShortcut(event, {
    inEditor: surface === WORK_AREA_SURFACES.codeEditor,
  })
  return match?.id ?? null
}

/**
 * Records this student's live badge signals (docs/agents/runtime-model.md, "Badge data") through
 * the useSession writers: topic opens, Keyboard Wizard shortcuts, the first real edit on each
 * task, complete code shown, and sandbox runs and time. First-occurrence signals are written at
 * most once; sandbox counters once per run. Everything is a no-op unless `enabled`.
 *
 * Returns stable reporters (safe in effects and long-lived listeners):
 * - reportTopicOpen(topicId, { source = 'student', via })
 * - reportShortcut(shortcutId)
 * - handleWorkAreaKeyDown(event): a keydown (capture phase) on the lesson work area
 * - reportUserEdit(surface): a real edit (CodeEditor onUserEdit, a Blockly user event, a
 *   Filesystem / Desktop / Arcade design change)
 * - reportCompleteShown(taskId, via): 'show' | 'preview' | 'teacherReset'
 * - reportSandboxRun({ error, submission }) / reportSandboxRunError(error)
 * plus `enabled` and `context` ('task' | 'sandbox' | 'personal').
 */
export function useStudentBadgeSignals({
  phase,
  identity,
  session,
  teacherPresentation = false,
  previewMode = false,
  currentTaskId,
  inPersonalSandbox = false,
  writers = {},
}) {
  const anonymousId = identity?.anonymousId ?? null
  const enabled =
    !teacherPresentation &&
    !previewMode &&
    !!anonymousId &&
    !!session &&
    SIGNAL_PHASES.includes(phase)
  const context = signalContextFor({ phase, inPersonalSandbox })
  const sandboxKind = sandboxKindForContext(context)

  const stateRef = useLatestRef({ enabled, anonymousId, context, sandboxKind, currentTaskId })
  const writersRef = useLatestRef(writers)

  // Ready to Code timing, on this device's own clock: from when the task first rendered for this
  // student, or when they joined (signals became enabled), whichever is later. Only a task counts;
  // returning from a sandbox to an unedited task keeps its original start.
  const taskStartRef = useRef(null)
  useEffect(() => {
    if (!enabled) {
      taskStartRef.current = null
      return
    }
    if (context !== 'task' || currentTaskId == null) return
    if (taskStartRef.current?.taskId === currentTaskId) return
    taskStartRef.current = { taskId: currentTaskId, start: performance.now() }
  }, [enabled, context, currentTaskId])

  // Time in a sandbox, flushed on leaving it and whenever the tab is hidden.
  useEffect(() => {
    if (!enabled || !sandboxKind || !anonymousId) return undefined
    let startedAt = document.visibilityState === 'hidden' ? null : performance.now()
    const flush = () => {
      if (startedAt == null) return
      const ms = performance.now() - startedAt
      startedAt = null
      if (ms >= SANDBOX_TIME_MIN_MS) {
        writersRef.current.addSandboxTimeSignal?.(anonymousId, sandboxKind, ms)
      }
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
      else if (startedAt == null) startedAt = performance.now()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', flush)
      flush()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, sandboxKind, anonymousId])

  const reportTopicOpen = useCallback(
    (topicId, { source = 'student', via = null } = {}) => {
      const s = stateRef.current
      if (!s.enabled || !topicId) return
      writersRef.current.recordTopicOpenSignal?.(s.anonymousId, {
        context: s.context,
        taskId: s.currentTaskId ?? NO_TASK_KEY,
        topicId,
        source,
        via,
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const reportShortcut = useCallback(
    (shortcutId) => {
      const s = stateRef.current
      if (!s.enabled || !shortcutId) return
      writersRef.current.recordShortcutSignal?.(s.anonymousId, shortcutId, {
        context: s.context,
        taskId: s.currentTaskId ?? null,
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const handleWorkAreaKeyDown = useCallback(
    (event) => {
      if (!stateRef.current.enabled) return
      const shortcutId = workAreaShortcutFor(event)
      if (shortcutId) reportShortcut(shortcutId)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const reportUserEdit = useCallback(
    () => {
      const s = stateRef.current
      if (!s.enabled || s.context !== 'task' || s.currentTaskId == null) return
      const started = taskStartRef.current
      if (!started || started.taskId !== s.currentTaskId || started.reported) return
      started.reported = true
      writersRef.current.recordFirstEditSignal?.(
        s.anonymousId,
        s.currentTaskId,
        performance.now() - started.start
      )
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const reportCompleteShown = useCallback(
    (taskId, via = 'show') => {
      const s = stateRef.current
      const id = taskId ?? s.currentTaskId
      if (!s.enabled || s.context !== 'task' || id == null) return
      writersRef.current.recordCompleteShownSignal?.(s.anonymousId, id, via)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const reportSandboxRun = useCallback(
    ({ error = false, submission } = {}) => {
      const s = stateRef.current
      if (!s.enabled || !s.sandboxKind) return
      writersRef.current.recordSandboxRunSignal?.(s.anonymousId, s.sandboxKind, {
        error,
        submissionHash: hashSubmission(submission),
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const reportSandboxRunError = useCallback(
    (error = true) => {
      const s = stateRef.current
      if (!s.enabled || !s.sandboxKind) return
      writersRef.current.flagSandboxRunError?.(s.anonymousId, s.sandboxKind, error)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  return useMemo(
    () => ({
      enabled,
      context,
      reportTopicOpen,
      reportShortcut,
      handleWorkAreaKeyDown,
      reportUserEdit,
      reportCompleteShown,
      reportSandboxRun,
      reportSandboxRunError,
    }),
    [
      enabled,
      context,
      reportTopicOpen,
      reportShortcut,
      handleWorkAreaKeyDown,
      reportUserEdit,
      reportCompleteShown,
      reportSandboxRun,
      reportSandboxRunError,
    ]
  )
}
