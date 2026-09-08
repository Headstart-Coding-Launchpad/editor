import React from 'react'

// Reuses the "introduction" information-task look (full-bleed primary-colour hero) —
// see .information-task--introduction in index.css — rather than inventing new styles.
export default function LessonCompleteScreen({ lessonTitle, onOpenPlayground }) {
  return (
    <div className="information-task information-task--introduction">
      <div className="information-intro__content">
        <h1>Lesson complete!</h1>
        <p>Well done finishing {lessonTitle ?? 'this lesson'}.</p>
        {onOpenPlayground && (
          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: 28 }}
            onClick={onOpenPlayground}
          >
            Open Playground
          </button>
        )}
      </div>
    </div>
  )
}
