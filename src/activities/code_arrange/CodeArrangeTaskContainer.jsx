import React, { useEffect, useRef, useState } from 'react'
import CodeArrangeTask from './CodeArrangeTask'
import {
  assembleCodeArrangement,
  deriveSlotStateFromCode,
  getCodeArrangeEntryFile,
  getCodeArrangeSlotCode,
  getNewTileMisses,
  isArrangementComplete,
} from '../../shared/codeArrange'
import { useRemoteRunTrigger } from '../../shared/useRemoteRunTrigger'
import definition from './definition.js'
import { useIsLeavingTaskSlide } from '../../app/components/TaskSlideTransition'

// Synthetic filename used to persist the student's own tile arrangement
// alongside the ordinary per-task saved code, using the exact same
// studentFileStorageKey()-keyed helpers every other task type already uses
// (see src/app/studentStorage.js). It cannot collide with an authored HTML
// filename since authors name real files like "index.html". The name and the
// stored format (a JSON slot map) come from the activity definition.
const CODE_ARRANGE_SLOTS_FILENAME = definition.storage.filename

function fileContent(files, name) {
  return files?.find((file) => file.name === name)?.content ?? ''
}

// Wires the presentational CodeArrangeTask component to the shared student
// code-state hook (`cs`, from useStudentCodeState). The tile arrangement
// itself is new UI-only state owned here; whenever the assembled program
// differs from what the shared code slot actually holds (cs.code, or the
// entry file in cs.files for html) we push it through the exact same
// handleCodeChange / handleFileChange entry points a normal Python/HTML task
// uses, so Run, checks, teacher live view, and local-storage persistence for
// the *code* are 100% the existing pipeline — nothing here re-implements them.
// Comparing against the real slot (not just the last value pushed) re-syncs
// the slot whenever something else resets it while the board stays mounted —
// a live task load restoring the starter (''), an identity arriving late — so
// Run never executes (and logs) an empty program under a complete board.
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
//     StudentWorkspace for the identical pattern) — UNLESS displayCodeArrangeSlots
//     is available for an isForcedTeacherLive viewer, in which case that live
//     per-tile stream is preferred (see below).
//
// Every non-read-only slot change is also mirrored live via
// cs.handleCodeArrangeSlotsChange (same pattern as Scratch's
// currentCursor/currentBlockDrag in useStudentCodeState.js) to two
// destinations, separate from the assembled code/file sync above which only
// fires once every blank is filled:
//   - currentCodeArrangeSlots (written on every placement during a lesson,
//     watched or not) for a teacher watching a student in StudentModal — see
//     StudentWorkspaceBody.jsx, which prefers it over deriving from
//     currentCode/currentFiles — and for StudentCard's "X/N slots filled".
//   - teacherLive.codeArrangeSlots for an isForcedTeacherLive viewer (Go
//     Live/presentation), read here as displayCodeArrangeSlots and preferred
//     over deriving from liveCode. Without either destination, a watcher
//     would see a blank/stale board until the arrangement was complete.
// A live drag also streams its in-flight position (cs.handleCodeArrangeDragCursor
// → teacherLive.codeArrangeCursor → displayCodeArrangeCursor), broadcast-only,
// so a Go-Live viewer sees the tile move as it's dragged rather than only
// snapping into place on drop — mirrors ScratchWorkspace's cursor/blockDrag.
export default function CodeArrangeTaskContainer({
  task,
  cs,
  viewingTaskId,
  currentTaskId,
  isViewingPrev,
  isForcedTeacherLive,
  isTeacherEditing,
  displayCode,
  displayFiles,
  displayOutput,
  displayRunStatus,
  displayCheckPassed,
  displayCheckAttempted,
  displayCodeArrangeSlots,
  displayCodeArrangeCursor,
  teacherLiveCode,
  teacherLiveFiles,
}) {
  const isHtml = task.moduleType === 'html'
  const entryFile = getCodeArrangeEntryFile(task)
  const isLiveMirror = isForcedTeacherLive || isTeacherEditing
  const taskId = isViewingPrev ? viewingTaskId : currentTaskId
  // Outgoing slide of a task transition (TaskSlideTransition remounts the previous task's tree
  // with its stale props and callbacks, after the next task has loaded): a purely visual
  // snapshot. Otherwise the remounted board reloads its saved arrangement and pushes the
  // assembled program through cs.handleCodeChange / handleFileChange into the shared code slot,
  // i.e. into the NEXT task's editor, and re-publishes its slots onto that task.
  const isLeavingSlide = useIsLeavingTaskSlide()
  const readOnly = isViewingPrev || isLiveMirror
  // No saves, live mirroring, assembled-code pushes or remote Runs (readOnly also changes
  // what is displayed; the leaving snapshot keeps the student's own display).
  const detached = readOnly || isLeavingSlide
  const [slotState, setSlotState] = useState({})
  // The latest arrangement, ahead of the re-render: a reset or teacher edit applied earlier in
  // the same commit must not have the re-sync effect below push the board it just replaced.
  const slotStateRef = useRef({})
  const loadedForTaskRef = useRef(null)

  useEffect(() => {
    // A teacher live mirror is reconstructed below from synced code, never
    // from this browser's own local storage — skip the local load entirely.
    if (isLiveMirror) return
    if (loadedForTaskRef.current === taskId) return
    loadedForTaskRef.current = taskId
    const raw = cs.readSavedTaskFile(taskId, CODE_ARRANGE_SLOTS_FILENAME)
    // Routed through handleCodeArrangeSlotsChange (not a bare setSlotState) so
    // a teacher already watching this student when the task loads — or who
    // starts watching before the student places a new tile — sees this
    // student's actual saved progress immediately, not a blank board.
    // A missing or malformed saved arrangement loads as an empty board.
    const saved = definition.deserialize(raw, task)
    slotStateRef.current = saved
    setSlotState(saved)
    if (!isLeavingSlide) cs.handleCodeArrangeSlotsChange?.(saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId, isLiveMirror])

  // A student's own drop of a tile into a blank where it is known to be wrong (tile feedback,
  // getTileFlag in src/shared/codeArrange.js) is logged as a tile miss for the report, never as
  // an attempt. Teacher edits and resets are not the student's drops.
  function handleSlotStateChange(next, options) {
    const prev = slotStateRef.current
    slotStateRef.current = next
    setSlotState(next)
    if (!detached && !options?.fromTeacher) {
      for (const miss of getNewTileMisses(task, prev, next)) cs.recordCodeArrangeTileMiss?.(miss)
    }
    if (!detached) {
      cs.saveTaskAuxFile(taskId, CODE_ARRANGE_SLOTS_FILENAME, definition.serialize(next))
      if (options) cs.handleCodeArrangeSlotsChange?.(next, options)
      else cs.handleCodeArrangeSlotsChange?.(next)
    }
  }

  // A teacher edited this student's tiles from StudentModal ("Edit answers").
  // Applied like a student placement (saved locally, assembled into code by
  // the re-sync effect below) but flagged so it doesn't count as the student
  // superseding the teacher's edit. Scoped to the task it was made on (every task the Builder
  // seeds shares the same slot ids, so another task's tiles would often "fit") and one-shot:
  // acknowledged once applied, so a later remount — revisiting the task after the student has
  // moved the tiles — never re-applies it over their newer arrangement.
  const teacherEditAt = cs.teacherCodeArrangeEdit?.at ?? null
  useEffect(() => {
    if (!teacherEditAt || detached) return
    const edit = cs.teacherCodeArrangeEdit
    if (edit.taskId != null && String(edit.taskId) !== String(taskId)) return
    const slots = edit.slots
    if (!slots || typeof slots !== 'object' || Array.isArray(slots)) return
    handleSlotStateChange(definition.deserialize(slots, task), { fromTeacher: true })
    cs.acknowledgeTeacherCodeArrangeEdit?.(teacherEditAt)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherEditAt])

  // A teacher "Start again" / "Complete" reset (StudentModal) of this task: the hook resets the
  // code slot and hands the board its matching tiles (empty, or the authored solution), applied
  // like the teacher's answer edit above so the board and the code agree, then acknowledged so
  // a later remount never applies it again.
  const remoteResetAt = cs.codeArrangeReset?.at ?? null
  useEffect(() => {
    if (!remoteResetAt || detached) return
    const reset = cs.codeArrangeReset
    if (reset.taskId != null && String(reset.taskId) !== String(taskId)) return
    const slots = reset.slots
    if (!slots || typeof slots !== 'object' || Array.isArray(slots)) return
    handleSlotStateChange(definition.deserialize(slots, task), { fromTeacher: true })
    cs.acknowledgeCodeArrangeReset?.(remoteResetAt)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteResetAt])

  // Keep the shared code slot in step with the tiles: push the assembled program whenever the
  // board is complete and the slot holds something else. Never while a program runs (Run reads
  // the slot, and the tiles are locked meanwhile) or in the personal sandbox (the slot holds the
  // sandbox's code then). Only a real difference pushes, so this cannot loop.
  const assembledCode = assembleCodeArrangement(task, slotState)
  const slotCode = getCodeArrangeSlotCode(
    task,
    isHtml ? { files: Array.isArray(cs.files) ? cs.files : [] } : { code: cs.code }
  )
  const syncBlocked = detached || !!cs.running || !!cs.inPersonalSandbox
  useEffect(() => {
    if (syncBlocked) return
    const latest = assembleCodeArrangement(task, slotStateRef.current)
    if (latest === null || latest === slotCode) return
    handleAssembledCodeChange(latest)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assembledCode, slotCode, syncBlocked])

  // Teacher remote Run: only a complete arrangement has runnable code.
  useRemoteRunTrigger(
    cs.remoteRunToken,
    () => {
      if (!cs.running && isArrangementComplete(task, slotState)) cs.handleRun()
    },
    { enabled: !detached, onHandled: cs.acknowledgeRemoteRun }
  )

  function handleAssembledCodeChange(assembledCode) {
    if (detached) return
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
    ? isHtml
      ? fileContent(displayFiles, entryFile)
      : (displayCode ?? '')
    : isTeacherEditing
      ? isHtml
        ? fileContent(teacherLiveFiles, entryFile)
        : (teacherLiveCode ?? '')
      : null

  // A Go-Live/presentation viewer prefers the live per-tile slot stream
  // (displayCodeArrangeSlots, mirrored on every drop — see
  // handleCodeArrangeSlotsChange in useStudentCodeState.js) over deriving
  // from liveCode, which only updates once every blank is filled and would
  // otherwise leave the board blank until the teacher finishes. isTeacherEditing
  // has no such stream (a different, lower-frequency mechanism), so it always
  // derives from code.
  const selectedAnswer =
    isForcedTeacherLive && displayCodeArrangeSlots
      ? displayCodeArrangeSlots
      : isLiveMirror
        ? deriveSlotStateFromCode(task, liveCode ?? '')
        : slotState

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
    : isLiveMirror || isViewingPrev
      ? false
      : cs.checkPassed
  const checkAttempted = isForcedTeacherLive
    ? !!displayCheckAttempted
    : isLiveMirror || isViewingPrev
      ? false
      : cs.checkAttempted
  const iframeSrc = isForcedTeacherLive
    ? cs.teacherLiveIframeSrc
    : isTeacherEditing || isViewingPrev
      ? null
      : cs.iframeSrc

  return (
    <CodeArrangeTask
      task={task}
      moduleType={task.moduleType}
      selectedAnswer={selectedAnswer}
      onSelectAnswer={detached ? undefined : handleSlotStateChange}
      output={output}
      runStatus={runStatus}
      inputPrompt={inputPrompt}
      onInputSubmit={detached ? undefined : cs.handleInputSubmit}
      running={readOnly ? false : cs.running}
      checkPassed={checkPassed}
      checkAttempted={checkAttempted}
      pyodideStatus={cs.pyodideStatus}
      iframeSrc={iframeSrc}
      iframeRef={cs.iframeRef}
      onRun={detached ? undefined : cs.handleRun}
      onStop={detached ? undefined : cs.handleStop}
      onDragCursor={detached ? undefined : cs.handleCodeArrangeDragCursor}
      externalDragCursor={isForcedTeacherLive ? displayCodeArrangeCursor : null}
      disabled={readOnly}
      showQuestion={false}
    />
  )
}
