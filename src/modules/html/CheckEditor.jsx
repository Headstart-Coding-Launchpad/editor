import React from 'react'
import { normalizeChecks } from '../checks'
import { CheckListEditor } from '../../builder/components/task-editor/CheckEditors'

export default function CheckEditor({
  task,
  lesson,
  onUpdate,
  interactionMode,
  output,
  activeFiles,
}) {
  const code = (activeFiles ?? [])
    .map((file) => `--- ${file.name} ---\n${file.content ?? ''}`)
    .join('\n\n')
  return (
    <CheckListEditor
      checks={normalizeChecks(task.check)}
      onChange={(checks) => onUpdate({ ...task, check: checks })}
      interactionMode={interactionMode}
      allowVariableChecks={false}
      allowDomChecks={interactionMode !== 'submit'}
      lessonType={lesson.type}
      output={output}
      code={code}
    />
  )
}
