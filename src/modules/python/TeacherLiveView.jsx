import React from 'react'
import PythonEditor from './PythonEditor.jsx'
import { taskShowsBlocks } from '../../shared/blockGuides'
import { getTaskLockSets } from '../../shared/lockedLines'
import { getPeekBand } from '../../shared/variablesPanel/variablesPanel.js'

const attachedEditorStyle = { borderRadius: '0 0 8px 8px' }

export default function PythonTeacherLiveView({
  task,
  displayState,
  readOnly,
  onChange,
  onActivity,
  isInSandbox,
  // Lock sets for the shown code; defaults to the task's own (src/shared/lockedLines.js).
  lockedLines,
}) {
  return (
    <PythonEditor
      showBlocks={taskShowsBlocks(task)}
      code={displayState ?? ''}
      onChange={onChange}
      onActivity={onActivity}
      readOnly={readOnly}
      lockedLines={isInSandbox ? null : (lockedLines ?? getTaskLockSets(task))}
      // The #@peek "stopped here" band, before any run (src/shared/peekBandEditor.js).
      peekBand={isInSandbox ? null : getPeekBand(task, displayState ?? '')}
      pyodideStatus="idle"
      editorStyle={isInSandbox ? undefined : attachedEditorStyle}
    />
  )
}
