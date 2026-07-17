import React from 'react'
import DropdownMenu from './DropdownMenu'

export default function StageDropdown({ stageOptions, onRequest, declinedNotice }) {
  return (
    <DropdownMenu
      label={declinedNotice ? 'Student declined' : 'Set Stage'}
      buttonClassName="btn-ghost"
      buttonStyle={declinedNotice ? { color: '#ef4444', borderColor: '#ef4444' } : undefined}
    >
      {close => (
        <>
          {stageOptions.map(opt => (
            <button
              key={opt.value}
              style={s.stageBtn}
              onClick={() => { close(); onRequest(opt.value, opt.label) }}
            >
              {opt.label}
            </button>
          ))}
        </>
      )}
    </DropdownMenu>
  )
}

const s = {
  stageBtn: {
    width: '100%',
    padding: '7px 12px',
    background: 'rgba(98,34,204,0.06)',
    color: 'var(--colour-primary-dark)',
    border: '1px solid rgba(98,34,204,0.18)',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'left',
  },
}
