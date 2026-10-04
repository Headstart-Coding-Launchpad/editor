import React from 'react'

export default function TeacherPreviewBanner({ taskNumber, taskTitle, onCancel, onConfirm }) {
  return (
    <div className="teacher-preview-banner">
      <span className="teacher-preview-banner__text">
        Preview — Task {taskNumber}: {taskTitle ?? ''}
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="teacher-preview-banner__btn" onClick={onCancel}>
          Back to Current Task
        </button>
        <button className="btn-primary teacher-preview-banner__btn" onClick={onConfirm}>
          Move All to This Task
        </button>
      </div>
    </div>
  )
}
