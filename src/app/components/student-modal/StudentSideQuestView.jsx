import React, { useMemo, useRef, useState } from 'react'
import StudentWorkspaceBody from './StudentWorkspaceBody'
import { decodeFileKey } from '../../../shared/fileKeys'
import { decodeSessionFiles } from '../../../shared/workspaceData'
import { getLessonModule } from '../../../modules/registry'
import { getModuleDefinition } from '../../../modules/definitions'
import {
  buildSideQuestTask,
  sideQuestKindMeta,
  sideQuestStuckState,
  studentOpenSideQuest,
} from '../../../shared/sideQuests'

const HTML_ENTRY_FILE = 'index.html'

/**
 * The side-quest a student has open, for the StudentModal (src/shared/sideQuests.js): which
 * side-quest, its status, and the student's side-quest work read-only from
 * students/{id}/sideQuestCode, through the same StudentWorkspaceBody mirrors as the main task
 * (code + output for Python, code + drawing for Turtle, files + preview for HTML).
 *
 * The work arrives on every Run, and live while the modal is open (it sets activeStudentView).
 * `task` and `lesson` are the class's current task and its effective lesson.
 */
/** "Main task" / "Side-quest" switch above the StudentModal body. */
export function SideQuestViewToggle({ view, onChange, quest, total }) {
  const meta = sideQuestKindMeta(quest.kind)
  return (
    <div style={s.toggle} role="tablist" aria-label="Which work to show">
      <button
        type="button"
        role="tab"
        aria-selected={view === 'main'}
        className={`ui-tab${view === 'main' ? ' is-active' : ''}`}
        style={{ ...s.toggleBtn, ...(view === 'main' ? s.toggleBtnOn : null) }}
        onClick={() => onChange('main')}
      >
        Main task
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === 'sideQuest'}
        className={`ui-tab${view === 'sideQuest' ? ' is-active' : ''}`}
        style={{ ...s.toggleBtn, ...(view === 'sideQuest' ? s.toggleBtnOn : null) }}
        onClick={() => onChange('sideQuest')}
        title={`${meta.label}: ${quest.title}`}
      >
        🗺️ Side-quest {quest.index + 1}
        {total > 1 ? `/${total}` : ''}
      </button>
    </div>
  )
}

export default function StudentSideQuestView({ student, session, lesson, task, now }) {
  const info = studentOpenSideQuest({ student, moduleType: lesson?.type ?? null, task })
  const iframeRef = useRef(null)
  const moduleType = info?.moduleType ?? null
  const quest = info?.quest ?? null
  const live = info?.live ?? null
  const sideQuestTask = useMemo(
    () => (quest ? buildSideQuestTask(task, quest, moduleType) : null),
    [task, quest, moduleType]
  )
  const sideQuestLesson = useMemo(
    () => (sideQuestTask ? { ...lesson, tasks: [sideQuestTask] } : lesson),
    [lesson, sideQuestTask]
  )
  const files = useMemo(
    () => (live?.files ? decodeSessionFiles(live.files, decodeFileKey, 'html') : []),
    [live?.files]
  )
  const [activeFile, setActiveFile] = useState(HTML_ENTRY_FILE)

  if (!info || !quest) {
    return (
      <div style={s.empty} data-testid="side-quest-view-empty">
        Not on a side-quest right now.
      </div>
    )
  }

  const meta = sideQuestKindMeta(quest.kind)
  const log = session?.sideQuestLog?.[student.anonymousId]?.[task?.id]?.[quest.index] ?? null
  const stuck = sideQuestStuckState({ student, session, taskId: task?.id, now })
  const lessonModule = getLessonModule(moduleType)
  const mirror = getModuleDefinition(moduleType)?.capabilities?.studentMirror ?? null
  const ModuleTeacherLiveView = lessonModule?.TeacherLiveView ?? null
  const hasWork = live && (live.code != null || files.length > 0)
  const activeFileObj = files.find((file) => file.name === activeFile) ?? files[0]
  const iframeSrc =
    mirror === 'files' && files.length
      ? lessonModule.runtime.buildPreviewSrc({ files, entryFile: HTML_ENTRY_FILE }, sideQuestTask)
      : null
  const moduleDisplayState =
    mirror === 'view' && ModuleTeacherLiveView
      ? lessonModule.deserializeState
        ? lessonModule.deserializeState(live?.code ?? '')
        : (live?.code ?? '')
      : null
  // The mirrors read a student's `current*` fields: hand them the side-quest's instead.
  const mirroredStudent = {
    anonymousId: student.anonymousId,
    displayName: student.displayName,
    currentCode: live?.code ?? '',
    currentOutput: live?.output ?? '',
    currentTurtleResult: live?.turtleResult ?? null,
    lastRunStatus: live?.runStatus === 'running' ? null : (live?.runStatus ?? null),
    checkPassed: null,
  }

  return (
    <div style={s.wrap} data-testid="side-quest-view">
      <div style={s.status}>
        <div style={s.statusTitle}>
          🗺️ Side-quest {quest.index + 1}
          {info.total > 1 ? ` of ${info.total}` : ''} · {meta.icon} {meta.label} · {quest.title}
        </div>
        <div style={s.statusLine}>
          <span>Runs: {log?.runs ?? 0}</span>
          <span>Errors: {log?.errorRuns ?? 0}</span>
          {log?.done === true && <span style={s.done}>✓ Marked done</span>}
          {stuck.stuck && (
            <span style={s.stuck}>
              {stuck.reason === 'errors'
                ? '⚠️ Probably stuck: errors on the last runs'
                : '⚠️ Probably stuck: no Run for 5 minutes'}
            </span>
          )}
        </div>
        <div style={s.note}>
          Read-only. Their code arrives on each Run, and live while this window is open. Send a
          message from Support ▾ to help.
        </div>
      </div>
      {hasWork ? (
        <div style={mirror === 'files' ? s.bodyRow : s.bodyColumn}>
          <StudentWorkspaceBody
            lesson={sideQuestLesson}
            task={sideQuestTask}
            student={mirroredStudent}
            session={session}
            isInformation={false}
            isQuiz={false}
            isActivity={false}
            isSessionSandbox={false}
            mirror={mirror}
            isCodeArrangeTask={false}
            ModuleTeacherLiveView={ModuleTeacherLiveView}
            moduleDisplayState={moduleDisplayState}
            files={files}
            activeFile={activeFileObj?.name ?? ''}
            setActiveFile={setActiveFile}
            activeFileObj={activeFileObj}
            remoteSelection={null}
            iframeSrc={iframeSrc}
            iframeRef={iframeRef}
            canHighlight={false}
            pendingHighlight={null}
            highlights={[]}
          />
        </div>
      ) : (
        <div style={s.empty}>
          Waiting for their side-quest code. It arrives when they press Run, or in a moment while
          this window is open.
        </div>
      )}
    </div>
  )
}

const s = {
  wrap: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' },
  status: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '6px 16px',
    background: 'rgba(124, 58, 237, 0.08)',
    borderBottom: '2px solid #7c3aed',
    flexShrink: 0,
  },
  statusTitle: { fontWeight: 700, fontSize: 14 },
  statusLine: { display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 12, fontWeight: 600 },
  done: { color: '#15803d' },
  stuck: { color: '#b45309' },
  note: { fontSize: 12, color: 'var(--colour-muted)' },
  bodyColumn: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  bodyRow: { flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'row' },
  empty: { padding: 24, fontSize: 14, color: 'var(--colour-muted)' },
  toggle: {
    display: 'flex',
    gap: 4,
    padding: '6px 16px 0',
    borderBottom: '1px solid #e5e7eb',
    flexShrink: 0,
  },
  toggleBtn: {
    fontSize: 13,
    fontWeight: 600,
    padding: '5px 12px',
    border: '1px solid transparent',
    borderBottom: 'none',
    borderRadius: '6px 6px 0 0',
    background: 'transparent',
    cursor: 'pointer',
    color: 'var(--colour-muted)',
  },
  toggleBtnOn: {
    background: 'var(--colour-surface, #fff)',
    borderColor: '#e5e7eb',
    color: 'var(--colour-text)',
  },
}
