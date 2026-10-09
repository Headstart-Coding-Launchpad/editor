import React, { useEffect, useMemo, useRef } from 'react'
import { useStudentCodeState } from '../../hooks/useStudentCodeState'
import LessonTaskContent from '../LessonTaskContent'
import { NOOP_SESSION_WRITES, seedSharedWorkspace } from '../SharedWorkspaceViewer'
import { loadSideQuestWork, saveSideQuestWork } from '../../studentStorage'
import {
  buildSideQuestTask,
  SIDE_QUEST_TASK_ID,
  sideQuestKindMeta,
  sideQuestRecord,
  sideQuestRecordToSnapshot,
} from '../../../shared/sideQuests'

/**
 * One side-quest (src/shared/sideQuests.js), opened in the workspace slot in place of the task.
 *
 * Like SharedWorkspaceViewer, it is the student's own workspace surface (LessonTaskContent and
 * the module's StudentWorkspace, so the shared CodeMirror, Pyodide and iframe code) driven by a
 * second, throwaway useStudentCodeState instance:
 *   - `previewMode: true` and a namespaced lessonId, so its saves go to the in-memory store and
 *     can never touch the task's saved work or anything carryCodeFrom reads;
 *   - no-op session writers and `phase: 'solo'`, so nothing reaches Firebase;
 *   - a task built from the side-quest (buildSideQuestTask): its starter, its explainer, no
 *     check.
 * Its code is kept in localStorage under the side-quest's own key (studentStorage.js
 * sideQuestStorageKey) when `persist` is on, seeded back in when it opens again. Runs and errors
 * are reported (counts only) through onRun.
 */

const SIDE_QUEST_ACTOR = 'side-quest-player'
const SAVE_DELAY_MS = 400

const NOOP_ASYNC = () => Promise.resolve()

// The writers the share viewer's list leaves out, stubbed too so nothing can reach Firebase.
const SIDE_QUEST_SESSION_WRITES = {
  ...NOOP_SESSION_WRITES,
  writeStudentHintState: NOOP_ASYNC,
  writeStudentTurtleResult: NOOP_ASYNC,
  writeStudentInputState: NOOP_ASYNC,
  setTeacherLiveReference: NOOP_ASYNC,
  clearTeacherAnswerEdit: NOOP_ASYNC,
  clearRemoteRun: NOOP_ASYNC,
  flagAttemptError: NOOP_ASYNC,
}

function sideQuestViewerLessonId(lessonId, taskId, index) {
  return `side-quest::${lessonId}::${taskId}::${index}`
}

export default function SideQuestWorkspace({
  lesson,
  lessonId,
  task,
  quest,
  questCount,
  moduleType,
  anonymousId,
  persist,
  done,
  isMobile = false,
  onToggleDone,
  onClose,
  // ({ error }) once per Run (error: false), and once more if that run hit an error.
  onRun,
}) {
  const index = quest.index
  const viewerLessonId = sideQuestViewerLessonId(lessonId, task?.id, index)
  const sideQuestTask = useMemo(
    () => buildSideQuestTask(task, quest, moduleType),
    [task, quest, moduleType]
  )
  const sideQuestLesson = useMemo(
    () => ({ ...lesson, type: moduleType, tasks: [sideQuestTask] }),
    [lesson, moduleType, sideQuestTask]
  )

  // Seed the saved side-quest work before the hook's load effect runs, once per side-quest.
  const seededRef = useRef(null)
  if (seededRef.current !== viewerLessonId) {
    seededRef.current = viewerLessonId
    if (persist && anonymousId) {
      const snapshot = sideQuestRecordToSnapshot(
        moduleType,
        loadSideQuestWork(lessonId, task?.id, index, anonymousId)
      )
      if (snapshot) {
        seedSharedWorkspace({
          shareLessonId: viewerLessonId,
          taskId: SIDE_QUEST_TASK_ID,
          moduleType,
          snapshot,
          actor: SIDE_QUEST_ACTOR,
        })
      }
    }
  }

  const identity = useMemo(() => ({ anonymousId: SIDE_QUEST_ACTOR, displayName: 'Me' }), [])

  const cs = useStudentCodeState({
    lessonId: viewerLessonId,
    lesson: sideQuestLesson,
    currentTaskId: SIDE_QUEST_TASK_ID,
    viewingTaskId: null,
    phase: 'solo',
    effectiveIdentity: identity,
    identity,
    session: null,
    connected: false,
    teacherPresentation: false,
    previewMode: true,
    ...SIDE_QUEST_SESSION_WRITES,
  })

  // Keep the work in localStorage (debounced, and once more on close). Only once the slot holds
  // this side-quest's work, so an early close can't save an empty editor over it.
  const loaded = cs.work?.moduleType === moduleType && cs.work?.value != null
  const latestRecordRef = useRef(null)
  latestRecordRef.current = loaded
    ? sideQuestRecord(moduleType, { code: cs.code, files: cs.files, activeFile: cs.activeFile })
    : null
  const saveTargetRef = useRef(null)
  saveTargetRef.current =
    persist && anonymousId ? { lessonId, taskId: task?.id, index, anonymousId } : null
  const flush = () => {
    const target = saveTargetRef.current
    const record = latestRecordRef.current
    if (!target || !record) return
    saveSideQuestWork(target.lessonId, target.taskId, target.index, target.anonymousId, record)
  }
  const flushRef = useRef(flush)
  flushRef.current = flush
  useEffect(() => {
    if (!loaded) return undefined
    const timer = setTimeout(() => flushRef.current(), SAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [cs.work, loaded])
  useEffect(() => () => flushRef.current(), [])

  // Runs and errors, counted (never the code). An error counts once per run: Python and Turtle
  // end a crashed run with runStatus 'error', HTML reports a runtime error's location.
  const runRef = useRef({ started: false, errored: false })
  const hasError = cs.runStatus === 'error' || cs.htmlErrorLocation != null
  useEffect(() => {
    if (!hasError || !runRef.current.started || runRef.current.errored) return
    runRef.current.errored = true
    onRun?.({ error: true })
  }, [hasError, onRun])

  const handleRun = (...args) => {
    // A press while a program is still running does nothing (handleRun ignores it too).
    if (cs.running) return cs.handleRun(...args)
    runRef.current = { started: true, errored: false }
    onRun?.({ error: false })
    return cs.handleRun(...args)
  }
  const sideQuestCs = { ...cs, handleRun }

  const meta = sideQuestKindMeta(quest.kind)

  return (
    <div style={s.wrap}>
      <div style={s.banner}>
        <div style={s.bannerText}>
          <span style={s.title}>
            🗺️ Side-quest {index + 1}
            {questCount > 1 ? ` of ${questCount}` : ''} · {meta.icon} {meta.label}
          </span>
          <span style={s.subtitle}>
            {quest.title} · Just for fun: your task code is safe and unchanged.
          </span>
        </div>
        <div style={s.bannerActions}>
          <button
            type="button"
            className={done ? 'btn-ghost-outline' : 'btn-primary'}
            style={s.bannerBtn}
            onClick={onToggleDone}
            aria-pressed={!!done}
            title={done ? 'Marked done. Tap to undo.' : 'Tell your teacher you finished it'}
          >
            {done ? '✓ Done' : '✓ I’ve done it!'}
          </button>
          <button type="button" className="btn-ghost-outline" style={s.bannerBtn} onClick={onClose}>
            ← Back to my task
          </button>
        </div>
      </div>
      <div style={s.body}>
        <LessonTaskContent
          key={viewerLessonId}
          lesson={sideQuestLesson}
          task={sideQuestTask}
          cs={sideQuestCs}
          lessonId={viewerLessonId}
          identityId={SIDE_QUEST_ACTOR}
          currentTaskId={SIDE_QUEST_TASK_ID}
          viewingTaskId={null}
          transitionKey={`side-quest-${viewerLessonId}`}
          previewMode={false}
          isSandbox={false}
          isViewingPrev={false}
          isForcedTeacherLive={false}
          isMobile={isMobile}
          isQuizTask={false}
          isAutoEvaluatedQuiz={false}
          isInformationTask={false}
          isCodeArrangeTask={false}
          isTeacherEditing={false}
          isLiveCopyBlocked={false}
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
    background: 'rgba(124, 58, 237, 0.08)',
    borderBottom: '2px solid #7c3aed',
    padding: '6px 10px',
    flexShrink: 0,
  },
  bannerText: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  title: { fontWeight: 700, fontSize: 14 },
  subtitle: { fontSize: 12, color: 'var(--colour-muted)' },
  bannerActions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  bannerBtn: { fontSize: 13, padding: '5px 12px' },
  body: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
}
