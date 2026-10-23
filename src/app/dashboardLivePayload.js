import { findTaskById } from '../shared/taskUtils'
import { getEffectiveLessonForTask } from '../shared/composedLesson'
import { getModuleDefinition } from '../modules/definitions'
import { onSandboxFilesChannel, sandboxCodeFor } from './teacherSandboxWork'
import { normaliseLiveLayout } from './studentLiveDisplay'

// The teacherLive payload for a Go Live started from the tutor dashboard (publisher
// 'dashboard'). `work` is the dashboard editor's work for the module in its stored form
// (TeacherView's workByKind[kind]); the module's own wire turns it into the code string or
// files map, exactly as the sandbox push does. The module comes from the task's effective
// lesson, never the raw lesson type (composed lessons).
//
// Not mirrored from the pop-up: the dashboard has no run output, check state, pointer/selection,
// ink or module live extras (Arcade's design), so those go out as empty values.
export function buildDashboardLivePayload({ lesson, taskId, work, layout = 'both' }) {
  const effective = getEffectiveLessonForTask(lesson, taskId)
  const lessonType = effective?.type ?? lesson?.type
  const definition = getModuleDefinition(lessonType)
  const task = findTaskById(lesson?.tasks, taskId)
  const onFiles = !!definition && onSandboxFilesChannel(definition)
  const filesMap = onFiles && definition ? definition.wire.toFilesMap(work) : {}
  const code = !definition || onFiles ? '' : (sandboxCodeFor(definition, work) ?? '')
  const extras = definition?.wire.liveExtras?.({}) ?? {}
  return {
    source: 'teacher',
    publisher: 'dashboard',
    sourceStudentId: null,
    sourceStudentName: null,
    taskId,
    lessonType,
    layout: normaliseLiveLayout(layout),
    code,
    files: filesMap,
    activeFile: onFiles ? (task?.entryFile ?? Object.keys(filesMap)[0] ?? '') : '',
    arcadeDesign: extras.arcadeDesign ?? null,
    turtleResult: extras.turtleResult ?? null,
    inspector: extras.inspector ?? null,
    variablesPanel: extras.variablesPanel ?? null,
    stage: extras.stage ?? null,
    output: '',
    runStatus: null,
    checkPassed: false,
    checkAttempted: false,
    checkSuggestion: '',
    selection: null,
    activity: null,
    answer: null,
    codeArrangeSlots: null,
    codeArrangeCursor: null,
  }
}
