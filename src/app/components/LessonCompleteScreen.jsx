import React from 'react'

// Reuses the "introduction" information-task look (full-bleed primary-colour hero) —
// see .information-task--introduction in index.css — rather than inventing new styles.
export default function LessonCompleteScreen({
  lessonTitle,
  onOpenPlayground,
  soloCompanion,
  onTrySoloChallenge,
  onReplayLesson,
}) {
  return (
    <div className="information-task information-task--introduction">
      <div className="information-intro__content">
        <h1>Lesson complete!</h1>
        <p>Well done finishing {lessonTitle ?? 'this lesson'}.</p>
        <p>What would you like to do next?</p>
        {onReplayLesson && (
          <button
            type="button"
            className="btn-ghost-outline"
            style={{ marginTop: 28 }}
            onClick={onReplayLesson}
          >
            Go Through the Lesson Again
          </button>
        )}
        {soloCompanion && onTrySoloChallenge && (
          <button
            type="button"
            className="btn-ghost-outline"
            style={{ marginTop: 12 }}
            onClick={onTrySoloChallenge}
          >
            Try the Solo Challenge
          </button>
        )}
        {onOpenPlayground && (
          <button
            type="button"
            className="btn-primary"
            style={{ marginTop: 12 }}
            onClick={onOpenPlayground}
          >
            Open Playground
          </button>
        )}
      </div>
    </div>
  )
}
