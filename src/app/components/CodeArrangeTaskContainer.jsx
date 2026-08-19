import React, { useEffect, useRef, useState } from 'react'
import CodeArrangeTask from './CodeArrangeTask'
import { deriveSlotStateFromCode, getCodeArrangeEntryFile } from '../../shared/codeArrange'

// Synthetic filename used to persist the student's own tile arrangement
// alongside the ordinary per-task saved code, using the exact same
// studentFileStorageKey()-keyed helpers every other task type already uses
// (see src/app/studentStorage.js). It cannot collide with an authored HTML
// filename since authors name real files like "index.html".
export const CODE_ARRANGE_SLOTS_FILENAME = '__code_arrange_slots__'

function fileContent(files, name) {
  return files?.find(file => file.name === name)?.content ?? ''
}

// Wires the presentational CodeArrangeTask component to the shared student
// code-state hook (`cs`, from useStudentCodeState). The tile arrangement
// itself is new UI-only state owned here; whenever it changes we assemble the
// full program and push it into cs.code / cs.files through the exact same
// handleCodeChange / handleFileChange entry points a normal Python/HTML task
// uses, so Run, checks, teacher live view, and local-storage persistence for
// the *code* are 100% the existing pipeline — nothing here re-implements them.
//
// The tile-to-slot arrangement itself is NOT part of that reused code/check
// pipeline (it's UI-only bookkeeping), so it needs its own handling for the
// two ways this component can be rendered read-only:
//   - isViewingPrev: the student reviewing their OWN earlier work on this
//     task. Their own saved arrangement (this browser's local storage) is the
//     right source, same as any other task type's own-history review.
//   - isForcedTeacherLive / isTeacherEditing: a teacher watching or editing a
//     STUDENT. This browser's local storage belongs to whoever is rendering
//     it, not the watched student, so it must never be read here. Instead the
//     board is reconstructed from the same synced code/files every other task
//     type mirrors in this situation (displayCode/displayFiles for a "Go
//     Live" broadcast viewer, teacherLiveCode/teacherLiveFiles for an
//     accepted teacher-edit session — see PythonEditor/HtmlEditor
//     StudentWorkspace for the identical pattern).
//
// Every non-read-only slot change is also mirrored live to
// currentCodeArrangeSlots via cs.handleCodeArrangeSlotsChange (gated by
// activeStudentView, same pattern as Scratch's currentCursor/currentBlockDrag
// in useStudentCodeState.js) — separate from the assembled code/file sync
// above, which only fires once every blank is filled. Without this, a
// teacher passively watching a student in StudentModal (not one of the two
// mirror modes above) would see stale code from a previous task until the
// student finished the arrangement. See StudentWorkspaceBody.jsx, which
// prefers currentCodeArrangeSlots over deriving from currentCode/currentFiles.
export default function CodeArrangeTaskContainer({
  task, cs, viewingTaskId, currentTaskId,
  isViewingPrev, isForcedTeacherLive, isTeacherEditing,
  displayCode, displayFiles, displayOutput, displayRunStatus, displayCheckPassed, displayCheckAttempted,
  teacherLiveCode, teacherLiveFiles,
}) {
  const isHtml = task.moduleType === 'html'
  const entryFile = getCodeArrangeEntryFile(task)
  const isLiveMirror = isForcedTeacherLive || isTeacherEditing
  const taskId = isViewingPrev ? viewingTaskId : currentTaskId
  const readOnly = isViewingPrev || isLiveMirror
  const [slotState, setSlotState] = useState({})
  const loadedForTaskRef = useRef(null)

  useEffect(() => {
    // A teacher live mirror is reconstructed below from synced code, never
    // from this browser's own local storage — skip the local load entirely.
    if (isLiveMirror) return
    if (loadedForTaskRef.current === taskId) return
    loadedForTaskRef.current = taskId
    const raw = cs.readSavedTaskFile(taskId, CODE_ARRANGE_SLOTS_FILENAME)
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          setSlotState(parsed)
          return
        }
      } catch {
        // Fall through to an empty arrangement below.
      }
    }
    setSlotState({})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, isLiveMirror])

  function handleSlotStateChange(next) {
    setSlotState(next)
    if (!readOnly) {
      cs.saveTaskAuxFile(taskId, CODE_ARRANGE_SLOTS_FILENAME, JSON.stringify(next))
      cs.handleCodeArrangeSlotsChange?.(next)
    }
  }

  function handleAssembledCodeChange(assembledCode) {
    if (readOnly) return
    if (isHtml) {
      cs.handleFileChange(entryFile, assembledCode)
    } else {
      cs.handleCodeChange(assembledCode)
    }
  }

  const savedView = isViewingPrev ? cs.readSavedTaskCode(viewingTaskId) : null

  // The synced code to mirror while a teacher is watching/editing — resolved
  // fresh on every render so the board tracks the stream as it updates.
  const liveCode = isForcedTeacherLive
    ? (isHtml ? fileContent(displayFiles, entryFile) : (displayCode ?? ''))
    : isTeacherEditing
      ? (isHtml ? fileContent(teacherLiveFiles, entryFile) : (teacherLiveCode ?? ''))
      : null

  const selectedAnswer = isLiveMirror ? deriveSlotStateFromCode(task, liveCode ?? '') : slotState

  const output = isForcedTeacherLive
    ? (displayOutput ?? '')
    : isTeacherEditing
      ? ''
      : isViewingPrev
        ? (savedView?.output ?? '')
        : cs.output
  const runStatus = isForcedTeacherLive
    ? (displayRunStatus ?? null)
    : isTeacherEditing
      ? null
      : isViewingPrev
        ? (savedView?.runStatus ?? null)
        : cs.runStatus
  const inputPrompt = readOnly ? null : cs.inputPrompt
  const checkPassed = isForcedTeacherLive
    ? !!displayCheckPassed
    : (isLiveMirror || isViewingPrev)
      ? false
      : cs.checkPassed
  const checkAttempted = isForcedTeacherLive
    ? !!displayCheckAttempted
    : (isLiveMirror || isViewingPrev)
      ? false
      : cs.checkAttempted
  const iframeSrc = isForcedTeacherLive
    ? cs.teacherLiveIframeSrc
    : (isTeacherEditing || isViewingPrev)
      ? null
      : cs.iframeSrc

  return (
    <CodeArrangeTask
      task={task}
      moduleType={task.moduleType}
      selectedAnswer={selectedAnswer}
      onSelectAnswer={readOnly ? undefined : handleSlotStateChange}
      onAssembledCodeChange={readOnly ? undefined : handleAssembledCodeChange}
      output={output}
      runStatus={runStatus}
      inputPrompt={inputPrompt}
      onInputSubmit={readOnly ? undefined : cs.handleInputSubmit}
      running={readOnly ? false : cs.running}
      checkPassed={checkPassed}
      checkAttempted={checkAttempted}
      pyodideStatus={cs.pyodideStatus}
      iframeSrc={iframeSrc}
      iframeRef={cs.iframeRef}
      onRun={readOnly ? undefined : cs.handleRun}
      onStop={readOnly ? undefined : cs.handleStop}
      disabled={readOnly}
      showQuestion={false}
    />
  )
}
