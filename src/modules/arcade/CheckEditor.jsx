import React from 'react'
import { normalizeChecks } from '../checks'
import { CheckListEditor } from '../../builder/components/task-editor/CheckEditors'
import Banner from '../../shared/Banner.jsx'

export default function CheckEditor({ task, lesson, onUpdate, interactionMode, activePythonCode }) {
  return (
    <>
      <Banner accent="#d97706" color="#92400e" style={{ borderRadius: 8, marginBottom: 10 }}>
        Checks aren&rsquo;t evaluated when a student plays the game yet — don&rsquo;t rely on this to gate progression.
      </Banner>
      <CheckListEditor checks={normalizeChecks(task.check)} onChange={checks => onUpdate({ ...task, check: checks })} interactionMode={interactionMode} allowVariableChecks={false} allowDomChecks={false} lessonType={lesson.type} code={activePythonCode} />
    </>
  )
}
