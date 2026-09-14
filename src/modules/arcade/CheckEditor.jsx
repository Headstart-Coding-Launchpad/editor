import React from 'react'
import { normalizeChecks } from '../checks'
import { CheckListEditor } from '../../builder/components/task-editor/CheckEditors'

// Arcade games run in their own iframe with no captured text output, so only code checks
// are offered — they're evaluated against the student's code each time they press Run game
// (see handleArcadeRun in useStudentCodeState.js).
export default function CheckEditor({ task, lesson, onUpdate, interactionMode, activePythonCode }) {
  return (
    <CheckListEditor
      checks={normalizeChecks(task.check)}
      onChange={(checks) => onUpdate({ ...task, check: checks })}
      interactionMode={interactionMode}
      allowVariableChecks={false}
      allowDomChecks={false}
      allowOutputChecks={false}
      lessonType={lesson.type}
      code={activePythonCode}
    />
  )
}
