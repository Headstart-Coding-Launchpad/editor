import React from 'react'

export default function StudentEditorHeader({ task, running, onRun, onSubmit, onReset }) {
  const isSubmit = task?.interactionMode === 'submit'

  return (
    <div className="sv-editor-header ui-tabs ui-tabs--editor">
      <span className="sv-editor-title">Code</span>
      <div className="sv-editor-actions">
        <button
          className="btn-primary sv-editor-primary-btn"
          onClick={isSubmit ? onSubmit : onRun}
          data-highlight-target={isSubmit ? undefined : 'run'}
          disabled={running}
        >
          {isSubmit ? 'Submit' : running ? 'Running…' : 'Run'}
        </button>
        <button
          className="btn-ghost-outline sv-reset-btn"
          onClick={onReset}
          title="Reset code to the starter code for this task"
        >
          Reset Code
        </button>
      </div>
    </div>
  )
}
