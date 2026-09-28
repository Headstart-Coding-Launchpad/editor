// Renders an activity StudentView with local state, applying functional updates the way
// useActivityState does (synchronously, against the latest state), so UI tests can assert
// on the exact state the activity produced.
import React, { useRef, useState } from 'react'
import { render } from '@testing-library/react'
import { vi } from 'vitest'

function Harness({ View, task, initialState, onSubmit, device, readOnly, stateRef }) {
  const [state, setState] = useState(initialState)
  const latest = useRef(initialState)
  function onChange(update) {
    const next = typeof update === 'function' ? update(latest.current) : update
    latest.current = next
    stateRef.current = next
    setState(next)
  }
  return (
    <View
      task={task}
      state={state}
      onChange={readOnly ? undefined : onChange}
      onSubmit={readOnly ? undefined : onSubmit}
      readOnly={readOnly}
      device={device}
    />
  )
}

export function renderActivityUi(
  View,
  { task, initialState, device = {}, readOnly = false, submitResult = { passed: false } }
) {
  const stateRef = { current: initialState }
  const onSubmit = vi.fn(() => Promise.resolve(submitResult))
  const utils = render(
    <Harness
      View={View}
      task={task}
      initialState={initialState}
      onSubmit={onSubmit}
      device={device}
      readOnly={readOnly}
      stateRef={stateRef}
    />
  )
  return { ...utils, onSubmit, state: () => stateRef.current }
}
