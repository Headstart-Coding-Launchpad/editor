import React from 'react'
import { normalizeChecks } from '../checks'
import { CheckListEditor } from '../../builder/components/task-editor/CheckEditors'

export default function CheckEditor({ task, lesson, onUpdate, interactionMode, activePythonCode }) {
  return <CheckListEditor checks={normalizeChecks(task.check)} onChange={checks => onUpdate({ ...task, check: checks })} interactionMode={interactionMode} allowVariableChecks={false} allowDomChecks={false} lessonType={lesson.type} code={activePythonCode} />
}
