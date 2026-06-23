import React from 'react'
import PythonEditor from './PythonEditor.jsx'

const attachedEditorStyle = { borderRadius: '0 0 8px 8px' }

export default function PythonTeacherLiveView({ displayState, readOnly, onChange, onActivity, isInSandbox }) {
  return (
    <PythonEditor
      code={displayState ?? ''}
      onChange={onChange}
      onActivity={onActivity}
      readOnly={readOnly}
      pyodideStatus="idle"
      editorStyle={isInSandbox ? undefined : attachedEditorStyle}
    />
  )
}
