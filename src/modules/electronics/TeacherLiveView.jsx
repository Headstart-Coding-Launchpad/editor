import React, { useMemo } from 'react'
import ElectronicsWorkspace from './ElectronicsWorkspace.jsx'
import { DEFAULT_CIRCUIT, parseCircuit, serializeCircuit } from './circuit'

export default function ElectronicsTeacherLiveView({
  task,
  displayState,
  readOnly = true,
  onChange,
  onTabChange,
  onActivity,
  isInSandbox,
}) {
  const circuit = useMemo(() => parseCircuit(displayState, DEFAULT_CIRCUIT), [displayState])
  function handleLegacyCodeChange(nextCode) {
    onChange?.(
      serializeCircuit({
        ...circuit,
        microcontroller: { ...(circuit.microcontroller ?? {}), enabled: true, code: nextCode },
      })
    )
  }
  return (
    <ElectronicsWorkspace
      circuit={circuit}
      onChange={(next) => onChange?.(serializeCircuit(next))}
      availableComponents={task?.availableComponents}
      readOnly={readOnly}
      showCodeTab={task?.microcontroller?.enabled === true}
      code={task?.microcontroller?.starterCode ?? ''}
      onCodeChange={handleLegacyCodeChange}
      onTabChange={onTabChange}
      onActivity={onActivity}
      isInSandbox={isInSandbox}
      title="Electronics"
    />
  )
}
