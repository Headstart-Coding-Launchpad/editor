import React, { useMemo } from 'react'
import ElectronicsWorkspace from './ElectronicsWorkspace.jsx'
import { DEFAULT_CIRCUIT, parseCircuit, serializeCircuit } from './circuit'
import { resolveSavedCarrySource } from '../../app/studentTaskContent'

export default function StudentWorkspace({
  lesson, task, cs, viewingTaskId, isViewingPrev, isForcedTeacherLive,
  displayCode, displayOutput, displayRunStatus, displayCheckPassed,
  isTeacherEditing, teacherLiveCode, teacherLiveWorkspace,
  onVisiblePanesChange, highlightedPanes,
}) {
  const viewedWork = isViewingPrev ? cs.readSavedTaskCode(viewingTaskId) : null
  const viewedCarry = isViewingPrev && viewedWork == null
    ? resolveSavedCarrySource({
      tasks: lesson.tasks,
      taskId: viewingTaskId,
      carryFromId: task?.carryCircuitFrom,
      carryField: 'carryCircuitFrom',
      readSavedState: cs.readSavedTaskCode,
      hasSavedState: saved => saved != null && Object.prototype.hasOwnProperty.call(saved, 'code'),
    })
    : null
  const viewedCode = viewedWork?.code ?? viewedCarry?.saved?.code ?? serializeCircuit(task?.starterCircuit ?? DEFAULT_CIRCUIT)
  const raw = isForcedTeacherLive ? displayCode : isTeacherEditing ? teacherLiveCode : isViewingPrev ? viewedCode : cs.code
  const circuit = useMemo(() => parseCircuit(raw, task?.starterCircuit ?? DEFAULT_CIRCUIT), [raw, task?.starterCircuit])
  const readOnly = isViewingPrev || isForcedTeacherLive || isTeacherEditing
  const showCodeTab = task?.microcontroller?.enabled === true

  function handleCircuitChange(nextCircuit) {
    cs.handleCodeChange(serializeCircuit(nextCircuit))
  }

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
      onTabChange={pane => onVisiblePanesChange?.([pane])}
      highlightedTabs={highlightedPanes}
      title="Electronics"
    />
  )
}
