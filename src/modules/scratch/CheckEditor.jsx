import React from 'react'
import { normalizeChecks } from '../../shared/checks'
import { ScratchCheckListEditor } from '../../builder/components/task-editor/ScratchEditors'
import { DEFAULT_SPRITES } from '../../shared/scratch'

export default function CheckEditor({ task, onUpdate }) {
  return (
    <ScratchCheckListEditor
      checks={normalizeChecks(task.check)}
      onChange={checks => onUpdate({ ...task, check: checks })}
      sprites={task.sprites?.length > 0 ? task.sprites : DEFAULT_SPRITES}
    />
  )
}
