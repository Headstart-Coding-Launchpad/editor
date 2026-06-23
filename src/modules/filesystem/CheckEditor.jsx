import React from 'react'
import { FsCheckListEditor } from './filesystemEditors'

export default function CheckEditor({ task, onUpdate }) {
  return (
    <FsCheckListEditor
      checks={task.check}
      onChange={checks => onUpdate({ ...task, check: checks, _checkTested: false })}
    />
  )
}
