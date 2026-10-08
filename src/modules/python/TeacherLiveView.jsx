import React from 'react'
import PythonEditor from './PythonEditor.jsx'
import { taskShowsBlocks } from '../../shared/blockGuides'

const attachedEditorStyle = { borderRadius: '0 0 8px 8px' }

export default function PythonTeacherLiveView({
  task,
  displayState,
  readOnly,
  onChange,
  onActivity,
  isInSandbox,
}) {
  return (
    <PythonEditor
      showBlocks={taskShowsBlocks(task)}
      code={displayState ?? ''}
      onChange={onChange}
      onActivity={onActivity}
      readOnly={readOnly}
      pyodideStatus="idle"
      editorStyle={isInSandbox ? undefined : attachedEditorStyle}
    />
  )
}
