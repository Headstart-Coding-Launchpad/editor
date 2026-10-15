import React from 'react'
import CodeArrangeTask from './CodeArrangeTask.jsx'
import CodeArrangeTaskContainer from './CodeArrangeTaskContainer.jsx'
import CodeArrangeBuilderEditor from './CodeArrangeBuilderEditor.jsx'
import { convertToCodeArrange } from './codeArrangeBuilder.js'
import { hostModuleFor, usesHostWorkspace } from './definition.js'
import { deriveSlotStateFromCode, getCodeArrangeEntryFile } from '../../shared/codeArrange'
import CoursePicture from '../../modules/turtle/CoursePicture.jsx'
import StagePane from '../../shared/stage/StagePane.jsx'
import { readStageResult } from '../../shared/stage/sync.js'
import TaskVariablesPanel from '../../shared/variablesPanel/TaskVariablesPanel.jsx'

// Code Arrange runs inside its host module (python / html / turtle), so the classroom renders
// `ModuleWorkspace` (wired to the module's work slot and Run through `cs`) in place of the
// module's StudentWorkspace, rather than ActivityHost. The other views are the tile board on
// its own.

// The tile board, controlled: `state` is the slot map. Read-only unless `onChange` is given
// and `readOnly` is false. The teacher's task panel shows the solution this way.
export function CodeArrangeStudentView({
  task,
  state,
  onChange,
  readOnly = false,
  lessonType = null,
  moduleType = null,
}) {
  const editable = !readOnly && !!onChange
  return (
    <CodeArrangeTask
      task={task}
      moduleType={moduleType ?? hostModuleFor(lessonType)}
      selectedAnswer={state}
      onSelectAnswer={editable ? onChange : undefined}
      disabled={!editable}
      showQuestion={false}
    />
  )
}

// StudentModal / StudentWorkspaceBody: the watched student's board. currentCodeArrangeSlots
// mirrors every tile placement live (see CodeArrangeTaskContainer.jsx / useStudentCodeState.js
// handleCodeArrangeSlotsChange) — `slots` prefers it over currentCode/currentFiles, which only
// update once the arrangement is fully assembled and would otherwise show stale code from a
// previous task while the student is still mid-arrangement. `onEditSlots` is set while the
// teacher is editing the student's answer.
export function CodeArrangeTeacherLiveView({
  task,
  student,
  mirror,
  files,
  slots,
  iframeSrc,
  iframeRef,
  onEditSlots,
  // The tutor's highlights on this board and the modal's tap-to-highlight (StudentWorkspaceBody).
  tileHighlights = null,
  onTargetTap = null,
}) {
  // A code_arrange task's code comes from its entry file on a files module (html).
  const isFilesMirror = mirror === 'files'
  const entryFile = getCodeArrangeEntryFile(task)
  const code = isFilesMirror
    ? (files.find((f) => f.name === entryFile)?.content ?? '')
    : (student.currentCode ?? '')
  const selectedAnswer =
    slots && typeof slots === 'object' ? slots : deriveSlotStateFromCode(task, code)
  // The same pass/fail the StudentCard shows: a teacher override wins, otherwise the last run.
  const hasOverride = !!student.checkOverridePushedAt
  const checkPassed = hasOverride
    ? student.checkOverridePassed === true
    : student.checkPassed === true
  const checkAttempted = hasOverride || student.lastRunStatus != null
  return (
    <CodeArrangeTask
      task={task}
      moduleType={isFilesMirror ? 'html' : hostModuleFor(task?.moduleType)}
      resultExtra={<ArrangeRunPicture task={task} student={student} />}
      selectedAnswer={selectedAnswer}
      output={student.currentOutput ?? ''}
      runStatus={student.lastRunStatus}
      checkPassed={checkPassed}
      checkAttempted={checkAttempted}
      iframeSrc={iframeSrc}
      iframeRef={iframeRef}
      onSelectAnswer={onEditSlots}
      disabled={!onEditSlots}
      showQuestion={false}
      tileHighlights={tileHighlights}
      onTargetTap={onTargetTap}
    />
  )
}

// A Turtle or Stage arrangement (usesHostWorkspace): the watched student's last run, finished —
// the drawing or course map (currentTurtleResult) or the Stage (currentStageResult) — and their
// name-tag panel, above the console. Nothing for a plain Python or HTML arrangement.
function ArrangeRunPicture({ task, student }) {
  if (!usesHostWorkspace(task)) return null
  const stageResult =
    task.moduleType === 'turtle' ? null : readStageResult(student.currentStageResult)
  return (
    <>
      {task.moduleType === 'turtle' ? (
        <div style={styles.picture} data-testid="code-arrange-tutor-picture">
          <CoursePicture task={task} result={student.currentTurtleResult ?? null} animate={false} />
        </div>
      ) : (
        <StagePane
          compact
          commands={stageResult?.commands ?? []}
          truncated={stageResult?.truncated === true}
          ran={!!stageResult}
          title="Student's stage"
          style={styles.stage}
        />
      )}
      <TaskVariablesPanel
        task={task}
        synced={student.currentVariables ?? null}
        audience="tutor"
        style={styles.variables}
      />
    </>
  )
}

const styles = {
  picture: {
    display: 'flex',
    height: 260,
    flexShrink: 0,
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    overflow: 'hidden',
  },
  stage: { flexShrink: 0, height: 240 },
  variables: { flexShrink: 0, maxHeight: 260 },
}

export default {
  StudentView: CodeArrangeStudentView,
  ModuleWorkspace: CodeArrangeTaskContainer,
  TeacherLiveView: CodeArrangeTeacherLiveView,
  BuilderEditor: CodeArrangeBuilderEditor,
  builderConvert: convertToCodeArrange,
}
