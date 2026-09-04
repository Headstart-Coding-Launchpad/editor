import React, { useCallback, useMemo } from 'react'
import ElectronicsWorkspace from './ElectronicsWorkspace.jsx'
import { DEFAULT_CIRCUIT, parseCircuit, serializeCircuit } from './circuit'
import { resolveSavedCarrySource } from '../../app/studentTaskContent'

export default function StudentWorkspace({
  lesson,
  task,
  cs,
  viewingTaskId,
  isViewingPrev,
  isForcedTeacherLive,
  displayCode,
  displayOutput,
  displayRunStatus,
  displayCheckPassed,
  isTeacherEditing,
  teacherLiveCode,
  teacherLiveWorkspace,
  onVisiblePanesChange,
  highlightedPanes,
  forcedPaneCommand,
}) {
  const forcedTab =
    forcedPaneCommand?.panes?.find((p) => p === 'breadboard' || p === 'code') ?? null
  const viewedWork = isViewingPrev ? cs.readSavedTaskCode(viewingTaskId) : null
  const viewedCarry =
    isViewingPrev && viewedWork == null
      ? resolveSavedCarrySource({
          tasks: lesson.tasks,
          taskId: viewingTaskId,
          carryFromId: task?.carryCircuitFrom,
          carryField: 'carryCircuitFrom',
          readSavedState: cs.readSavedTaskCode,
          hasSavedState: (saved) =>
            saved != null && Object.prototype.hasOwnProperty.call(saved, 'code'),
        })
      : null
  const viewedCode =
    viewedWork?.code ??
    viewedCarry?.saved?.code ??
    serializeCircuit(task?.starterCircuit ?? DEFAULT_CIRCUIT)
  const raw = isForcedTeacherLive
    ? displayCode
    : isTeacherEditing
      ? teacherLiveCode
      : isViewingPrev
        ? viewedCode
        : cs.code
  const circuit = useMemo(
    () => parseCircuit(raw, task?.starterCircuit ?? DEFAULT_CIRCUIT),
    [raw, task?.starterCircuit]
  )
  const readOnly = isViewingPrev || isForcedTeacherLive || isTeacherEditing
  const showCodeTab = task?.microcontroller?.enabled === true

  function handleCircuitChange(nextCircuit) {
    cs.handleCodeChange(serializeCircuit(nextCircuit))
  }

  // Stable identity matters here: ElectronicsWorkspace reports its visible tab from an
  // effect that lists this callback as a dependency. An inline arrow was rebuilt on every
  // render, so the effect re-ran every render, wrote a fresh array into the parent's pane
  // state, and re-rendered - an unbounded loop ("Maximum update depth exceeded") on every
  // electronics task. The other pane-reporting modules pass a plain state setter straight
  // through, which is already stable; this wrapper has to be memoised to match.
  const handleTabChange = useCallback(
    (pane) => {
      onVisiblePanesChange?.([pane])
    },
    [onVisiblePanesChange]
  )

  function handleLegacyCodeChange(nextCode) {
    handleCircuitChange({
      ...circuit,
      microcontroller: { ...(circuit.microcontroller ?? {}), enabled: true, code: nextCode },
    })
  }

  return (
    <ElectronicsWorkspace
      circuit={circuit}
      onChange={handleCircuitChange}
      availableComponents={task?.availableComponents}
      readOnly={readOnly}
      showCodeTab={showCodeTab}
      code={task?.microcontroller?.starterCode ?? ''}
      onCodeChange={handleLegacyCodeChange}
      onRunMicroPython={!readOnly ? cs.handleRun : undefined}
      onStopMicroPython={!readOnly ? cs.handleStop : undefined}
      onCheck={!readOnly ? cs.handleSubmit : undefined}
      onReset={!readOnly ? cs.handleResetCode : undefined}
      output={isForcedTeacherLive ? displayOutput : cs.output}
      runStatus={isForcedTeacherLive ? displayRunStatus : cs.runStatus}
      running={cs.running}
      checkPassed={isForcedTeacherLive ? displayCheckPassed : cs.checkPassed}
      activeTab={isTeacherEditing ? teacherLiveWorkspace : undefined}
      onTabChange={handleTabChange}
      highlightedTabs={highlightedPanes}
      forcedTab={forcedTab}
      forcedTabToken={forcedPaneCommand?.pushedAt ?? null}
      title="Electronics"
    />
  )
}
