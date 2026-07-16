import React from 'react'
import { normalizeChecks } from '../checks'
import { ScratchCheckListEditor } from './scratchEditors'
import { DEFAULT_SPRITES } from './scratch'

export default function CheckEditor({ task, onUpdate, checks, onChange, feedbackEditor = false }) {
  return (
    <ScratchCheckListEditor
      checks={normalizeChecks(checks ?? task.check)}
      onChange={nextChecks => {
        if (onChange) onChange(nextChecks)
        else onUpdate({ ...task, check: nextChecks })
      }}
      sprites={task.sprites?.length > 0 ? task.sprites : DEFAULT_SPRITES}
      feedbackEditor={feedbackEditor}
    />
  )
}
