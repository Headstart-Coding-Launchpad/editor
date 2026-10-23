import React, { useMemo, useState } from 'react'
import StudentWorkspaceBody from './student-modal/StudentWorkspaceBody'
import { getLessonModule } from '../../modules/registry'
import { getModuleDefinition } from '../../modules/definitions'
import { flattenTasks, deriveTaskContext } from '../../shared/taskUtils'
import { getEffectiveLessonForTask } from '../../shared/composedLesson'
import { decodeFileKey } from '../../shared/fileKeys'
import { decodeSessionFiles, parseScratchState } from '../../shared/workspaceData'
import { readActivityAnswer } from '../../activities/state.js'
import { getShowIt, getShowItBuilds } from '../../shared/showIt'

function moduleDisplayStateOf(module, raw) {
  if (!module) return null
  if (raw != null && raw !== '') return module.deserializeState ? module.deserializeState(raw) : raw
  return module.defaultState ?? null
}

// One build, read-only, rendered by the same body the tutor's student view uses. The student
// record is stripped to the work itself: no name, no id, so nothing here can print either.
function ShowItTile({ label, student, task, lesson, session }) {
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

  return (
    <section className="show-it-tile" aria-label={label} data-testid="show-it-tile">
      <h3 className="show-it-tile__label">{label}</h3>
      <div className="show-it-tile__body">
        {isInformation ? (
          <p className="show-it-tile__empty">Nothing to show on this task.</p>
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
          />
        )}
      </div>
    </section>
  )
}

/**
 * "Show it": the builds the tutor picked (session.showIt), side by side, on the presentation
 * window and every student screen. Read-only, labelled Build 1/2/3, never a name. It stays
 * until the tutor stops it (or moves the class to another task). Renders nothing when
 * nothing is being shown.
 */
export default function ShowItPanel({ session, lesson, presentation = false }) {
  const showIt = getShowIt(session)
  if (!showIt) return null
  // Task ids are numbers or strings in lessons; showIt.taskId is stored as a string.
  const task = flattenTasks(lesson?.tasks).find((t) => String(t.id) === showIt.taskId) ?? null
  const builds = getShowItBuilds(session)
  if (!task || builds.length === 0) return null

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
      </header>
      <div className="show-it-panel__tiles" style={{ '--show-it-count': builds.length }}>
        {builds.map((build) => (
          <ShowItTile
            key={build.label}
            label={build.label}
            student={build.student}
            task={task}
            lesson={lesson}
            session={session}
          />
        ))}
      </div>
    </div>
  )
}
