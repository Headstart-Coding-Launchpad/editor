import React from 'react'
import PythonEditor from './PythonEditor.jsx'
import { taskShowsBlocks } from '../../shared/blockGuides'
import { getTaskLockSets } from '../../shared/lockedLines'

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
      pyodideStatus="idle"
      editorStyle={isInSandbox ? undefined : attachedEditorStyle}
    />
  )
}
