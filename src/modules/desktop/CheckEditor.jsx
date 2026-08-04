import React from 'react'
import { DesktopCheckListEditor } from './desktopEditors.jsx'

export default function CheckEditor({ task, onUpdate, checks, onChange, feedbackEditor = false }) {
  return (
    <DesktopCheckListEditor
      checks={checks ?? task.check}
      onChange={nextChecks => {
        if (onChange) onChange(nextChecks)
        else onUpdate({ ...task, check: nextChecks, _checkTested: false })
      }}
      feedbackEditor={feedbackEditor}
    />
  )
}
