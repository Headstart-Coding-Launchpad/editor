import React from 'react'

export default function LoadingScreen({ message, compact = false }) {
  return (
    <div className={compact ? 'hsc-loading hsc-loading--compact' : 'sv-centre-screen hsc-loading'} role="status" aria-live="polite">
      <div className="hsc-loading__spinner" aria-hidden="true">
        <span />
        <span />
      </div>
      <p className="hsc-loading__message">{message}</p>
    </div>
  )
}
