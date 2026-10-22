import React, { useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * The tutor's editor for a task's "Type this out" text (the Copy code panel), opened from a
 * student's modal. Saves for this student or for the whole class, or clears this student's own
 * version so they follow the class / lesson text again. See src/shared/copyCodeOverrides.js.
 *
 * @param {object} props
 * @param {string} props.studentName
 * @param {string} props.taskTitle
 * @param {string} props.initialText what this student sees now
 * @param {boolean} props.hasOwnOverride this student has a version of their own
 * @param {(scope: 'student'|'class', text: string) => void} props.onSave
 * @param {() => void} props.onClearStudent
 * @param {() => void} props.onClose
 */
export default function CopyCodeEditDialog({
  studentName,
  taskTitle,
  initialText,
  hasOwnOverride,
  onSave,
  onClearStudent,
  onClose,
}) {
  const [text, setText] = useState(initialText ?? '')
  return createPortal(
    <div
      className="ui-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="copy-code-edit-title"
      style={s.overlay}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          onClose()
        }
      }}
    >
      <div style={s.dialog}>
        <h2 id="copy-code-edit-title" style={s.title}>
          ⌨️ Type this out · {taskTitle}
        </h2>
        <p style={s.note}>
          What the Type this out box shows. Clear the text to hide the box. The lesson itself is not
          changed.
        </p>
        <textarea
          style={s.textarea}
          value={text}
          onChange={(event) => setText(event.target.value)}
          spellCheck={false}
          aria-label="Type this out text"
          data-testid="copy-code-edit-text"
          autoFocus
        />
        <div style={s.actions}>
          <button
            type="button"
            className="btn-primary"
            onClick={() => onSave('student', text)}
            data-testid="copy-code-save-student"
          >
            Save for {studentName}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => onSave('class', text)}
            data-testid="copy-code-save-class"
          >
            Save for whole class
          </button>
          {hasOwnOverride && (
            <button
              type="button"
              className="btn-ghost"
              onClick={onClearStudent}
              data-testid="copy-code-clear-student"
            >
              Use class text for {studentName}
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    zIndex: 1200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  dialog: {
    background: 'var(--ui-surface)',
    color: 'var(--colour-text)',
    borderRadius: 10,
    width: 'min(640px, 100%)',
    maxHeight: '90vh',
    overflow: 'auto',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  title: { margin: 0, fontSize: '1.05rem' },
  note: { margin: 0, fontSize: '0.85rem', color: 'var(--colour-text-muted, #6b7280)' },
  textarea: {
    minHeight: 200,
    fontFamily: 'var(--font-code)',
    fontSize: 13,
    padding: 10,
    borderRadius: 8,
    border: '1px solid #cbd5e1',
    resize: 'vertical',
  },
  actions: { display: 'flex', flexWrap: 'wrap', gap: 8 },
}
