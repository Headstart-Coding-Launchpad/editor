import React, { useMemo, useRef, useState } from 'react'
import { resolveSnapshotContext, snapshotFiles } from './SharedWorkspacePreview'
import { parseScratchState } from '../../shared/workspaceData'
import { ephemeralStorage } from '../studentStorage'
import { useStudentCodeState } from '../hooks/useStudentCodeState'
import LessonTaskContent from './LessonTaskContent'

/**
 * A classmate's shared workspace, opened as a throwaway copy.
 *
 * This renders the student's OWN workspace surface — the same LessonTaskContent
 * and module StudentWorkspace they use for their own work — rather than a
 * bespoke viewer. Anything else drifts: the teacher-facing views have different
 * chrome and controls (Electronics being the obvious case), so a hand-built
 * viewer would never stay identical to what the student already knows. Only the
 * banner above it says whose work this is.
 *
 * Non-destructive BY CONSTRUCTION. The workspace is driven by a second,
 * throwaway useStudentCodeState instance that gets:
 *   - `previewMode: true`, so persistence routes to the in-memory ephemeral
 *     store and real localStorage is never touched;
 *   - a namespaced lessonId, so the ephemeral store cannot collide with the
 *     student's own work or with another share;
 *   - no-op session writers, so no path exists to Firebase at all;
 *   - `phase: 'solo'`, so none of the live-session write paths engage.
 *
 * The snapshot is seeded into the ephemeral store before the hook mounts, so
 * each module's normal "load my saved work" path picks it up. That keeps every
 * lesson type working through its real code path instead of a parallel one.
 */

const SHARE_VIEWER_ACTOR = 'shared-workspace-viewer'

const NOOP = () => {}
const NOOP_ASYNC = () => Promise.resolve()

// Every session write the hook can make, stubbed. Listed explicitly rather than
// generated, so a newly added writer shows up as an obvious omission here
// instead of silently reaching Firebase from a shared workspace.
const NOOP_SESSION_WRITES = {
  writeStudentRun: NOOP_ASYNC,
  logAttempt: NOOP_ASYNC,
  writeStudentAnswer: NOOP_ASYNC,
  writeStudentCode: NOOP_ASYNC,
  writeStudentArcadeDesign: NOOP_ASYNC,
  writeStudentSpriteState: NOOP_ASYNC,
  writeStudentCursor: NOOP_ASYNC,
  writeStudentBlockDrag: NOOP_ASYNC,
  writeStudentCodeArrangeSlots: NOOP_ASYNC,
  writeStudentFiles: NOOP_ASYNC,
  writeStudentOutput: NOOP_ASYNC,
  writeStudentInteraction: NOOP_ASYNC,
  recordStudentCarryFallback: NOOP_ASYNC,
  recordSupportStageReveal: NOOP_ASYNC,
  writeStudentPersonalSandbox: NOOP_ASYNC,
  writeStudentPresence: NOOP_ASYNC,
  registerPresence: NOOP,
  removeStudent: NOOP_ASYNC,
  updateTeacherLive: NOOP_ASYNC,
  setTeacherLive: NOOP_ASYNC,
  removeTeacherHighlight: NOOP_ASYNC,
}

export function shareViewerLessonId(shareId) {
  return `shared-workspace::${shareId}`
}

// Write the snapshot where the module's own loadTaskContent will look for it.
export function seedSharedWorkspace({ shareLessonId, taskId, moduleType, snapshot }) {
  const actor = SHARE_VIEWER_ACTOR
  if (moduleType === 'html') {
    for (const file of snapshotFiles(snapshot)) {
      ephemeralStorage.saveFile(shareLessonId, taskId, file.name, actor, file.content)
    }
    return
  }
  if (moduleType === 'scratch') {
    const state = parseScratchState(snapshot?.code)
    if (state) ephemeralStorage.saveCode(shareLessonId, taskId, actor, { state })
    return
  }
  if (moduleType === 'filesystem') {
    const fs = parseScratchState(snapshot?.code)
    if (fs) ephemeralStorage.saveFsState(shareLessonId, taskId, actor, fs)
    return
  }
  ephemeralStorage.saveCode(shareLessonId, taskId, actor, {
    code: snapshot?.code ?? '',
    ...(snapshot?.arcadeDesign ? { arcadeDesign: snapshot.arcadeDesign } : {}),
  })
}

export default function SharedWorkspaceViewer({
  lesson,
  entry,
  snapshot,
  onClose,
  onCopyToMyEditor,
  copyTargetTaskId,
  isMobile = false,
}) {
  const { task, effectiveLesson, moduleType } = useMemo(
    () => resolveSnapshotContext(lesson, snapshot),
    [lesson, snapshot]
  )

  const shareId = entry?.shareId ?? 'unknown'
  const shareLessonId = shareViewerLessonId(shareId)
  const taskId = snapshot?.taskId ?? task?.id ?? null

  // Seed before the hook's load effect runs. Ref-guarded so it happens once per
  // share rather than on every render.
  const seededRef = useRef(null)
  if (seededRef.current !== shareId) {
    seededRef.current = shareId
    seedSharedWorkspace({ shareLessonId, taskId, moduleType, snapshot })
  }

  const identity = useMemo(
    () => ({ anonymousId: SHARE_VIEWER_ACTOR, displayName: entry?.sharerName ?? 'Classmate' }),
    [entry?.sharerName]
  )

  const cs = useStudentCodeState({
    lessonId: shareLessonId,
    lesson: effectiveLesson,
    currentTaskId: taskId,
    viewingTaskId: null,
    phase: 'solo',
    effectiveIdentity: identity,
    identity,
    session: null,
    connected: false,
    teacherPresentation: false,
    previewMode: true,
    ...NOOP_SESSION_WRITES,
  })

  const [confirmingCopy, setConfirmingCopy] = useState(false)

  // Copying overwrites the viewer's own editor, so only offer it when the
  // snapshot belongs to the task they are actually working on.
  const canCopy = !!onCopyToMyEditor && taskId != null && taskId === copyTargetTaskId

  function handleConfirmCopy() {
    setConfirmingCopy(false)
    // buildShareSnapshot reads this throwaway instance's current state, so the
    // student copies what they are actually looking at, including their edits.
    const current = cs.buildShareSnapshot()
    onCopyToMyEditor({
      code: current.code,
      files: snapshotFiles(current),
      moduleType,
    })
  }

  return (
    <div style={s.wrap}>
      <div style={s.banner}>
        <div style={s.bannerText}>
          <span style={s.title}>📤 {entry?.sharerName ?? 'A classmate'}&apos;s workspace</span>
          <span style={s.subtitle}>
            {task?.title ? `${task.title} · ` : ''}Run it, change it, try anything — your own work
            is safe and unchanged.
          </span>
        </div>
        <div style={s.bannerActions}>
          {canCopy && (
            <button
              type="button"
              className="btn-ghost"
              style={s.bannerBtn}
              onClick={() => setConfirmingCopy(true)}
            >
              Copy to my editor
            </button>
          )}
          <button type="button" className="btn-primary" style={s.bannerBtn} onClick={onClose}>
            ← Back to my work
          </button>
        </div>
      </div>

      {confirmingCopy && (
        <div style={s.confirm} role="alertdialog" aria-label="Confirm copy">
          <span style={s.confirmText}>
            This replaces your own code for this task with {entry?.sharerName ?? 'their'} version.
            You cannot undo it.
          </span>
          <div style={s.confirmActions}>
            <button
              type="button"
              className="btn-primary"
              style={s.bannerBtn}
              onClick={handleConfirmCopy}
            >
              Replace my work
            </button>
            <button
              type="button"
              className="btn-ghost"
              style={s.bannerBtn}
              onClick={() => setConfirmingCopy(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={s.body}>
        <LessonTaskContent
          // Remounted per share: modules that load state on mount (notably
          // Blockly) must not be handed a different project in place.
          key={shareId}
          lesson={effectiveLesson}
          task={task}
          cs={cs}
          lessonId={shareLessonId}
          identityId={SHARE_VIEWER_ACTOR}
          currentTaskId={taskId}
          viewingTaskId={null}
          transitionKey={`shared-${shareId}`}
          previewMode
          isSandbox={false}
          isViewingPrev={false}
          isForcedTeacherLive={false}
          isMobile={isMobile}
          isQuizTask={false}
          isAutoEvaluatedQuiz={false}
          isInformationTask={false}
          isCodeArrangeTask={task?.taskType === 'code_arrange'}
          isTeacherEditing={false}
          presenterLayout="both"
        />
      </div>
    </div>
  )
}

const s = {
  // Occupies the normal workspace slot rather than floating over it.
  wrap: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, flex: 1 },
  banner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    background: 'rgba(13, 148, 136, 0.10)',
    borderBottom: '2px solid #0d9488',
    padding: '6px 10px',
    flexShrink: 0,
  },
  bannerText: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  title: { fontWeight: 700, fontSize: 14 },
  subtitle: { fontSize: 12, color: 'var(--colour-muted)' },
  bannerActions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  bannerBtn: { fontSize: 13, padding: '5px 12px' },
  confirm: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
    padding: 10,
    borderBottom: '1px solid var(--colour-danger, #dc2626)',
    background: 'rgba(220, 38, 38, 0.06)',
    flexShrink: 0,
  },
  confirmText: { fontSize: 12 },
  confirmActions: { display: 'flex', gap: 8 },
  body: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
}
