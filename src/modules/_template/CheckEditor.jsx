import { normalizeChecks } from '../checks'
import { CheckListEditor } from '../../builder/components/task-editor/CheckEditors'

// The Builder's check editor for Template Module tasks. The scaffold only evaluates code checks
// (against the work text, when the student presses Check), so output, variable and DOM checks
// are hidden.
// TODO(new-module): offer the module's own check types (./checks.js) here with their fields.
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
