import React from 'react'
import { s } from './styles'

export default function Field({ label, hint, children }) {
  return (
    <label style={s.field}>
      <span style={s.fieldLabel}>
        {label}
        {hint && <span style={s.fieldHint}> ({hint})</span>}
      </span>
      {children}
    </label>
  )
}
