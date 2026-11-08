import React from 'react'

/**
 * The amber banner while the tutor previews a task the class is not on (calm teacher view):
 * "Previewing task 4 · Move the sprite. The class is still on task 2." with Move class here and
 * Back to task 2. Only the tutor sees it; students stay where they are. A greyed optional task
 * (Skip optional tasks on) says Next still skips it: moving the class there is a one-off.
 */
export default function TeacherPreviewBanner({
  taskNumber,
  taskTitle,
  classTaskNumber,
  skippedByNext = false,
  onCancel,
  onConfirm,
}) {
  return (
    <div className="teacher-preview-banner" data-testid="teacher-preview-banner" role="status">
      <div className="teacher-preview-banner__main">
        <span className="teacher-preview-banner__text">
          <span aria-hidden="true">👁</span> Previewing task {taskNumber}
          {taskTitle ? ` · ${taskTitle}` : ''}. The class is still on task {classTaskNumber}.
        </span>
        <div className="teacher-preview-banner__actions">
          <button className="btn-primary teacher-preview-banner__btn" onClick={onConfirm}>
            Move class here
          </button>
          <button className="btn-ghost-outline teacher-preview-banner__btn" onClick={onCancel}>
            Back to task {classTaskNumber}
          </button>
        </div>
      </div>
      <span className="teacher-preview-banner__hint">
        {skippedByNext
          ? 'Skip optional tasks is on, so Next skips this task. Moving the class here is a one-off: the switch stays on. '
          : 'Only you can see this; students stay where they are. '}
        Keys: ← → step through tasks without moving the class, Esc goes back.
      </span>
    </div>
  )
}
