import React from 'react'
import { Field } from './TaskEditorFields'
import { ActivityGallery } from './ActivityPickers'
import TaskPreviewPanel from './TaskPreviewPanel'
import ActivityPreview from '../../../activities/ActivityPreview.jsx'
import { getTaskActivityUi } from '../../../activities/registry.js'
import { UNKNOWN_ACTIVITY_ID } from '../../../activities/resolve.js'

// Builder section for a `taskType: 'activity'` task: the gallery (to switch activity), the
// description shown above the activity, the activity's own BuilderEditor, and a student preview
// played through ActivityHost with in-memory state (plan step 2.4).
export default function ActivitySection({ task, lesson, onUpdate, onChooseActivity }) {
  const ui = getTaskActivityUi(task)
  const known = !!ui && ui.id !== UNKNOWN_ACTIVITY_ID
  const Editor = known ? ui.BuilderEditor : null
  const hasExplainer = task.explainer !== null && task.explainer !== undefined

  return (
    <>
      <ActivityGallery task={task} onSelect={onChooseActivity} />

      {known && (
        <Field
          label="Description"
          hint={
            hasExplainer
              ? 'the explainer above is shown instead while it is enabled'
              : 'shown above the activity'
          }
        >
          <textarea
            className="te-input te-act-description"
            value={task.description ?? ''}
            aria-label="Activity description"
            placeholder="e.g. Click the bits to turn them on. Make each number."
            onChange={(e) => {
              const next = { ...task }
              if (e.target.value) next.description = e.target.value
              else delete next.description
              onUpdate(next)
            }}
          />
        </Field>
      )}

      {Editor ? (
        <Editor task={task} onUpdate={onUpdate} lessonType={lesson.type} />
      ) : known ? (
        <div className="te-act-note">
          {ui.label} has no Builder editor yet: edit this task in YAML or JSON.
        </div>
      ) : null}

      {known && (
        <TaskPreviewPanel task={task} draft={lesson.draft}>
          <ActivityPreview task={task} lessonType={lesson.type} />
        </TaskPreviewPanel>
      )}
    </>
  )
}
