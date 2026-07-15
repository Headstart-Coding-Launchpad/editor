import React, { useMemo } from 'react'
import ElectronicsWorkspace from './ElectronicsWorkspace.jsx'
import { DEFAULT_CIRCUIT, parseCircuit, serializeCircuit } from './circuit'

export default function StudentWorkspace({
  task, cs, isViewingPrev, isForcedTeacherLive,
  displayCode, displayOutput, displayRunStatus, displayCheckPassed,
  isTeacherEditing, teacherLiveCode,
}) {
  const raw = isForcedTeacherLive ? displayCode : isTeacherEditing ? teacherLiveCode : cs.code
  const circuit = useMemo(() => parseCircuit(raw, task?.starterCircuit ?? DEFAULT_CIRCUIT), [raw, task?.starterCircuit])
  const readOnly = isViewingPrev || isForcedTeacherLive || isTeacherEditing
  const showCodeTab = task?.microcontroller?.enabled === true

  function handleCircuitChange(nextCircuit) {
    cs.handleCodeChange(serializeCircuit(nextCircuit))
  }

  return (
    <ElectronicsWorkspace
      circuit={circuit}
      onChange={handleCircuitChange}
      readOnly={readOnly}
      showCodeTab={showCodeTab}
      code={task?.microcontroller?.starterCode ?? ''}
      onCheck={!readOnly ? cs.handleSubmit : undefined}
      onReset={!readOnly ? cs.handleResetCode : undefined}
      output={isForcedTeacherLive ? displayOutput : cs.output}
      runStatus={isForcedTeacherLive ? displayRunStatus : cs.runStatus}
      checkPassed={isForcedTeacherLive ? displayCheckPassed : cs.checkPassed}
      title="Electronics"
    />
  )
}
