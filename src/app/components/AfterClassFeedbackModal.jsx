import React from 'react'
import AfterClassFeedbackForm from './AfterClassFeedbackForm'
import NamedBadgeExportButton from './NamedBadgeExportButton'

// Shown after "End & Go to Home" so the tutor still reaches the after-class feedback step.
// Save or Skip both finish via onDone (which navigates home).
export default function AfterClassFeedbackModal({
  report,
  tasks,
  onSave,
  onDone,
  namedBadgeRows = null,
  lesson = null,
}) {
  return (
    <div
      className="ui-modal-backdrop"
      style={s.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="After-class feedback"
    >
      <div style={s.modal}>
        <h3 style={s.title}>How did {report?.lessonTitle || 'the lesson'} go?</h3>
        <NamedBadgeExportButton rows={namedBadgeRows} lesson={lesson} style={s.badgeExport} />
        <AfterClassFeedbackForm
          tasks={tasks}
          saveLabel="Save and go home"
          onSkip={onDone}
          onSave={async (feedback, notes) => {
            await onSave(feedback, notes)
            onDone()
          }}
        />
      </div>
    </div>
  )
}

const s = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
    padding: 24,
  },
  modal: {
    background: '#fff',
    borderRadius: 12,
    width: 'min(560px, 94vw)',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: 20,
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  badgeExport: { marginBottom: 12 },
  title: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.05rem',
    margin: '0 0 12px',
  },
}
