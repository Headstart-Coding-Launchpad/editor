import React from 'react'
import { s } from './styles'

export default function Modal({ title, children, onClose }) {
  return (
    <div style={s.modalBackdrop} role="dialog" aria-modal="true">
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>{title}</span>
          <button style={s.closeBtn} onClick={onClose} title="Close">x</button>
        </div>
        <div style={s.modalBody}>
          {children}
        </div>
      </div>
    </div>
  )
}
