import React from 'react'
import { normalizeChecks } from '../checks'
import { ScratchCheckListEditor } from './scratchEditors'
import { DEFAULT_SPRITES } from './scratch'

export default function CheckEditor({ task, onUpdate }) {
  return (
    <ScratchCheckListEditor
      checks={normalizeChecks(task.check)}
      onChange={checks => onUpdate({ ...task, check: checks })}
      sprites={task.sprites?.length > 0 ? task.sprites : DEFAULT_SPRITES}
    />
  )
}
