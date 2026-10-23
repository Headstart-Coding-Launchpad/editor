import React, { useMemo, useState } from 'react'
import StudentWorkspaceBody from './student-modal/StudentWorkspaceBody'
import { getLessonModule } from '../../modules/registry'
import { getModuleDefinition } from '../../modules/definitions'
import { flattenTasks, deriveTaskContext } from '../../shared/taskUtils'
import { getEffectiveLessonForTask } from '../../shared/composedLesson'
import { readStageResult } from '../../shared/stage/sync.js'
import { decodeFileKey } from '../../shared/fileKeys'
import { decodeSessionFiles, parseScratchState } from '../../shared/workspaceData'
import { readActivityAnswer } from '../../activities/state.js'
import {
  clampShowItIndex,
  defaultShowItView,
  getShowIt,
  getShowItBuilds,
} from '../../shared/showIt'

function moduleDisplayStateOf(module, raw) {
  if (!module) return null
  if (raw != null && raw !== '') return module.deserializeState ? module.deserializeState(raw) : raw
  return module.defaultState ?? null
}

// One build, read-only, rendered by the same body the tutor's student view uses. The student
// record is stripped to the work itself: no name, no id, so nothing here can print either.
function ShowItTile({
  label,
  student,
  task,
  lesson,
  session,
  single = false,
  canToggleCode = false,
}) {
  const taskLesson = getEffectiveLessonForTask(lesson, task)
  const { moduleType, isQuiz, isInformation, isActivity, isSessionSandbox } = deriveTaskContext(
    taskLesson,
    task,
    session
  )
  const work = useMemo(() => {
    const { displayName: _name, anonymousId: _id, ...rest } = student
    return { ...rest, anonymousId: label }
  }, [student, label])
  const mirror = getModuleDefinition(moduleType)?.capabilities?.studentMirror ?? null
  const lessonModule = getLessonModule(taskLesson?.type)
  const ModuleTeacherLiveView = lessonModule?.TeacherLiveView ?? null
  const files = decodeSessionFiles(work.currentFiles, decodeFileKey, 'html')
  const [activeFile, setActiveFile] = useState(task?.entryFile ?? files[0]?.name ?? '')
  const activeFileObj = files.find((f) => f.name === activeFile) ?? files[0]
  const scratchState = useMemo(
    () => (mirror === 'blocks' ? parseScratchState(work.currentCode) : null),
    [mirror, work.currentCode]
  )
  const moduleDisplayState =
    mirror === 'view' && ModuleTeacherLiveView
      ? moduleDisplayStateOf(lessonModule, work.currentCode)
      : null
  const iframeSrc =
    mirror === 'files' && !isQuiz && files.length
      ? lessonModule.runtime.buildPreviewSrc(
          { files, entryFile: task?.entryFile ?? 'index.html' },
          task
        )
      : null

  // Result first: a code task shows what the program made, with the code behind a "Show code"
  // toggle (the tutor's own choice on their screen, off by default). The result comes from the
  // last Run's record: output, Stage / Turtle result, or the saved files.
  const [showCode, setShowCode] = useState(false)
  const resultFirst =
    !isActivity &&
    !isQuiz &&
    task?.interactionMode !== 'submit' &&
    (mirror === 'code' ||
      mirror === 'files' ||
      (mirror === 'view' && getModuleDefinition(moduleType)?.runResult?.turtle === true))
  const hasRun =
    mirror === 'code'
      ? !!(
          readStageResult(work.currentStageResult) ||
          work.currentOutput ||
          work.lastRunStatus ||
          work.lastRunAt
        )
      : mirror === 'files'
        ? !!iframeSrc
        : !!(work.currentTurtleResult || work.lastRunStatus || work.lastRunAt)
  const resultOnly = resultFirst && !showCode

  return (
    <section
      className={`show-it-tile${single ? ' show-it-tile--single' : ''}`}
      aria-label={label}
      data-testid="show-it-tile"
    >
      <header className="show-it-tile__head">
        <h3 className="show-it-tile__label">{label}</h3>
        {resultFirst && canToggleCode && (
          <button
            type="button"
            className="btn-ghost-outline show-it-tile__code-toggle"
            aria-pressed={showCode}
            onClick={() => setShowCode((on) => !on)}
          >
            {showCode ? 'Hide code' : 'Show code'}
          </button>
        )}
      </header>
      <div className="show-it-tile__body">
        {isInformation ? (
          <p className="show-it-tile__empty">Nothing to show on this task.</p>
        ) : resultOnly && !hasRun ? (
          <p className="show-it-tile__empty">{label} hasn&apos;t run their code yet.</p>
        ) : (
          <StudentWorkspaceBody
            lesson={taskLesson}
            task={task}
            student={work}
            session={session}
            isInformation={false}
            isQuiz={isQuiz}
            isActivity={isActivity && !isSessionSandbox}
            activityState={
              isActivity && !isSessionSandbox ? readActivityAnswer(task, work.currentAnswer) : null
            }
            isSessionSandbox={isSessionSandbox}
            mirror={mirror}
            isCodeArrangeTask={false}
            ModuleTeacherLiveView={ModuleTeacherLiveView}
            moduleDisplayState={moduleDisplayState}
            files={files}
            activeFile={activeFile}
            setActiveFile={setActiveFile}
            activeFileObj={activeFileObj}
            scratchState={scratchState}
            spriteState={mirror === 'blocks' ? (work.currentSpriteState ?? null) : null}
            cursorState={null}
            blockDragState={null}
            iframeSrc={iframeSrc}
            outputOpen
            showMarks={false}
            fitCode
            resultOnly={resultOnly}
          />
        )}
      </div>
    </section>
  )
}

// "Side by side" / "One at a time" with arrows to step through the builds. Shared by the panel
// (presentation window) and the tutor's class grid. `onSetView(view, index)` writes the tutor's
// choice to the showIt node, which drives every screen.
export function ShowItControls({ view, index, count, onSetView }) {
  const single = view === 'single'
  return (
    <div className="show-it-controls" role="group" aria-label="Show it view">
      <button
        type="button"
        className={single ? 'btn-ghost-outline' : 'btn-primary'}
        aria-pressed={!single}
        onClick={() => onSetView('side', index)}
      >
        Side by side
      </button>
      <button
        type="button"
        className={single ? 'btn-primary' : 'btn-ghost-outline'}
        aria-pressed={single}
        onClick={() => onSetView('single', index)}
      >
        One at a time
      </button>
      {single && (
        <>
          <button
            type="button"
            className="btn-ghost-outline"
            aria-label="Previous build"
            disabled={index <= 0}
            onClick={() => onSetView('single', index - 1)}
          >
            ←
          </button>
          <span className="show-it-controls__count" aria-live="polite">
            Build {index + 1} of {count}
          </span>
          <button
            type="button"
            className="btn-ghost-outline"
            aria-label="Next build"
            disabled={index >= count - 1}
            onClick={() => onSetView('single', index + 1)}
          >
            →
          </button>
        </>
      )}
    </div>
  )
}

/**
 * "Show it": the builds the tutor picked (session.showIt), side by side, on the presentation
 * window and every student screen. Read-only, labelled Build 1/2/3, never a name. It stays
 * until the tutor stops it (or moves the class to another task). Renders nothing when
 * nothing is being shown.
 */
export default function ShowItPanel({ session, lesson, presentation = false, onSetView = null }) {
  const showIt = getShowIt(session)
  if (!showIt) return null
  // Task ids are numbers or strings in lessons; showIt.taskId is stored as a string.
  const task = flattenTasks(lesson?.tasks).find((t) => String(t.id) === showIt.taskId) ?? null
  const builds = getShowItBuilds(session)
  if (!task || builds.length === 0) return null
  const view = showIt.view ?? defaultShowItView(task)
  const single = view === 'single'
  const index = clampShowItIndex(showIt.index, builds.length)
  const shown = single ? [builds[index]] : builds

  return (
    <div
      className={`show-it-panel${presentation ? ' show-it-panel--presentation' : ''}`}
      role="region"
      aria-label="Show it"
      data-testid="show-it-panel"
    >
      <header className="show-it-panel__header">
        <span className="show-it-panel__kicker">📺 Show it</span>
        <span className="show-it-panel__task">{task.title}</span>
        {onSetView && builds.length > 1 && (
          <ShowItControls view={view} index={index} count={builds.length} onSetView={onSetView} />
        )}
      </header>
      <div
        className={`show-it-panel__tiles${single ? ' show-it-panel__tiles--single' : ''}`}
        style={{ '--show-it-count': shown.length }}
        data-view={view}
      >
        {shown.map((build) => (
          <ShowItTile
            key={build.label}
            label={build.label}
            student={build.student}
            task={task}
            lesson={lesson}
            session={session}
            single={single}
            canToggleCode={presentation || !!onSetView}
          />
        ))}
      </div>
    </div>
  )
}
