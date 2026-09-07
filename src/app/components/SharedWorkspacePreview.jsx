import React, { useMemo } from 'react'
import { getLessonModule } from '../../modules/registry'
import { getEffectiveLessonForTask } from '../../shared/composedLesson'
import { findTaskById } from '../../shared/taskUtils'
import { parseScratchState, getFileType } from '../../shared/workspaceData'
import OutputPanel from './OutputPanel'

// Turns a frozen share snapshot into the shape each module's TeacherLiveView
// expects. Modules disagree on the prop name and the state shape, so the
// mapping lives here once rather than at every call site.

export function snapshotFiles(snapshot) {
  return Object.entries(snapshot?.files ?? {}).map(([name, content]) => ({
    name,
    content: typeof content === 'string' ? content : String(content ?? ''),
    type: getFileType(name, 'html'),
  }))
}

export function snapshotDisplayState(snapshot, moduleType) {
  if (moduleType === 'html') return { files: snapshotFiles(snapshot) }
  const raw = snapshot?.code ?? ''
  const mod = getLessonModule(moduleType)
  if (mod?.deserializeState) return mod.deserializeState(raw)
  return raw
}

// The snapshot names its own task and module, which may not be the task the
// viewer is on — a share from task 2 stays openable once the class is on task 6,
// and in a composed lesson it may be a different module entirely.
export function resolveSnapshotContext(lesson, snapshot) {
  const task = findTaskById(lesson?.tasks, snapshot?.taskId) ?? null
  const effectiveLesson = getEffectiveLessonForTask(lesson, task) ?? lesson
  const moduleType = snapshot?.lessonType ?? effectiveLesson?.type ?? null
  return { task, effectiveLesson, moduleType, module: getLessonModule(moduleType) }
}

export default function SharedWorkspacePreview({ lesson, snapshot, showOutput = true }) {
  const { task, effectiveLesson, moduleType, module } = useMemo(
    () => resolveSnapshotContext(lesson, snapshot),
    [lesson, snapshot]
  )

  const displayState = useMemo(
    () => snapshotDisplayState(snapshot, moduleType),
    [snapshot, moduleType]
  )

  // Memoized so ScratchWorkspace's "load external state" effect, which keys on
  // object identity, does not reload the workspace on every parent render.
  const scratchState = useMemo(
    () => (moduleType === 'scratch' ? parseScratchState(snapshot?.code) : null),
    [moduleType, snapshot?.code]
  )

  if (!snapshot) return null

  const LiveView = module?.TeacherLiveView
  if (!LiveView) {
    return <pre style={s.fallback}>{snapshot.code ?? ''}</pre>
  }

  // A snapshot has no live student behind it. Modules that read student.* for
  // fallbacks get a stand-in carrying only what the snapshot actually froze.
  const snapshotStudent = {
    currentCode: snapshot.code ?? '',
    currentArcadeDesign: snapshot.arcadeDesign ?? null,
    currentOutput: snapshot.output ?? '',
    lastRunStatus: snapshot.runStatus ?? null,
  }

  return (
    <div style={s.wrap}>
      <div style={s.viewport}>
        <LiveView
          task={task}
          lesson={effectiveLesson}
          student={snapshotStudent}
          displayState={displayState}
          liveState={displayState}
          scratchState={scratchState}
          design={snapshot.arcadeDesign ?? undefined}
          spriteState={null}
          cursorState={null}
          blockDragState={null}
          readOnly
          onChange={undefined}
          onActivity={undefined}
          isInSandbox={false}
          activeStage={null}
        />
      </div>
      {showOutput && snapshot.output ? (
        <OutputPanel output={snapshot.output} runStatus={snapshot.runStatus} />
      ) : null}
    </div>
  )
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 },
  viewport: { minHeight: 0, overflow: 'auto' },
  fallback: {
    margin: 0,
    padding: 12,
    background: 'var(--colour-surface-alt, #f5f5f5)',
    borderRadius: 8,
    fontSize: 13,
    whiteSpace: 'pre-wrap',
    overflow: 'auto',
  },
}
