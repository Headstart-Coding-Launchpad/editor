import React from 'react'

export default function TeacherEndSessionModal({ onClose, onEnd, onEndAndGoHome }) {
  return (
    <div
      className="teacher-end-modal__overlay"
      role="dialog"
      aria-modal="true"
      aria-label="End session"
      onClick={onClose}
    >
      <div className="teacher-end-modal" onClick={(e) => e.stopPropagation()}>
        <div className="teacher-end-modal__header">
          <h2 className="teacher-end-modal__title">End Session?</h2>
        </div>
        <div className="teacher-end-modal__content">
          <p className="teacher-end-modal__body">
            This will end the session for all students. They will see a session-ended screen. You
            can rate the lesson and leave notes afterwards.
          </p>
          <div className="teacher-end-modal__actions">
            <button className="btn-ghost teacher-end-modal__btn" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-danger teacher-end-modal__btn" onClick={onEnd}>
              End Session
            </button>
            <button className="btn-primary teacher-end-modal__btn" onClick={onEndAndGoHome}>
              End &amp; Go to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
