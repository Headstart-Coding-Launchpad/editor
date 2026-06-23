import React from 'react'
import { normalizeChecks } from '../../shared/checks'
import { CheckListEditor } from '../../builder/components/task-editor/CheckEditors'

export default function CheckEditor({ task, lesson, onUpdate, interactionMode, output, activePythonCode }) {
  return (
    <CheckListEditor
      checks={normalizeChecks(task.check)}
      onChange={checks => onUpdate({ ...task, check: checks })}
      interactionMode={interactionMode}
      allowVariableChecks={interactionMode !== 'submit'}
      allowDomChecks={false}
      lessonType={lesson.type}
      output={output}
      code={activePythonCode}
    />
  )
}
