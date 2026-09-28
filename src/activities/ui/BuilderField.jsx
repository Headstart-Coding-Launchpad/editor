import React from 'react'

// Labelled Builder form row. Shared by the Builder task editor (re-exported from
// src/builder/components/task-editor/TaskEditorFields.jsx) and each activity's BuilderEditor,
// so activity editors never import Builder internals.
export function Field({ label, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 600,
          fontSize: '0.88rem',
          color: 'var(--colour-text)',
        }}
      >
        {label}
        {hint && (
          <span style={{ fontWeight: 400, color: '#9ca3af', fontSize: '0.82rem', marginLeft: 4 }}>
            ({hint})
          </span>
        )}
      </span>
      {children}
    </div>
  )
}

export default Field
