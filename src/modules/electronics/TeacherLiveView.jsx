import React, { useMemo } from 'react'
import ElectronicsWorkspace from './ElectronicsWorkspace.jsx'
import { DEFAULT_CIRCUIT, parseCircuit, serializeCircuit } from './circuit'

export default function ElectronicsTeacherLiveView({ displayState, readOnly = true, onChange }) {
  const circuit = useMemo(() => parseCircuit(displayState, DEFAULT_CIRCUIT), [displayState])
  return (
    <ElectronicsWorkspace
      circuit={circuit}
      onChange={next => onChange?.(serializeCircuit(next))}
      readOnly={readOnly}
      title="Electronics"
    />
  )
}
