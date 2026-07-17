import React, { useState } from 'react'
import DropdownMenu from './DropdownMenu'

export default function OverrideDropdown({ student, onOverrideCheck }) {
  const [showFailModal, setShowFailModal] = useState(false)
  const [failHint, setFailHint] = useState('')
  const hasOverride = !!student.checkOverridePushedAt

  function applyOverride(passed, hint) {
    onOverrideCheck(student.anonymousId, passed, passed ? null : (hint || null))
    setShowFailModal(false)
    setFailHint('')
  }

  return (
    <>
      <DropdownMenu
        label={hasOverride ? (student.checkOverridePassed ? 'Override: Pass' : 'Override: Fail') : 'Override'}
        buttonClassName="btn-ghost"
      >
        {close => (
          <>
            <button
              style={s.passBtn}
              onClick={() => { close(); applyOverride(true, null) }}
            >
              ✓ Pass
            </button>
            <button
              style={s.failBtn}
              onClick={() => { close(); setShowFailModal(true) }}
            >
              ✕ Fail
            </button>
          </>
        )}
      </DropdownMenu>

      {showFailModal && (
        <div style={s.modalOverlay} onClick={e => { if (e.target === e.currentTarget) { setShowFailModal(false); setFailHint('') } }}>
          <div style={s.modal}>
            <div style={s.modalHeader}>
              <span style={s.modalTitle}>Override: Fail</span>
              <button style={s.modalClose} onClick={() => { setShowFailModal(false); setFailHint('') }}>✕</button>
            </div>
            <div style={s.modalBody}>
              <p style={s.modalHint}>Optional hint for student (supports Markdown):</p>
              <textarea
                style={s.hintTextarea}
                placeholder="e.g. Check your indentation, or try using a `for` loop…"
                value={failHint}
                onChange={e => setFailHint(e.target.value)}
                rows={5}
                autoFocus
              />
            </div>
            <div style={s.modalFooter}>
              <button className="btn-ghost-outline" style={{ fontSize: 13 }} onClick={() => { setShowFailModal(false); setFailHint('') }}>
                Cancel
              </button>
              <button className="btn-danger" style={{ fontSize: 13 }} onClick={() => applyOverride(false, failHint)}>
                Apply Fail
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const s = {
  passBtn: {
    width: '100%',
    padding: '7px 12px',
    background: 'rgba(34,197,94,0.12)',
    color: '#166534',
    border: '1px solid rgba(34,197,94,0.35)',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'left',
  },
  failBtn: {
    width: '100%',
    padding: '7px 12px',
    background: 'rgba(239,68,68,0.12)',
    color: '#991b1b',
    border: '1px solid rgba(239,68,68,0.35)',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'left',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 1100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modal: {
    background: '#fff',
    borderRadius: 10,
    width: 'min(480px, 90vw)',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    overflow: 'hidden',
  },
  modalHeader: {
    background: 'var(--colour-primary)',
    color: '#fff',
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  modalTitle: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1rem',
  },
  modalClose: {
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: '#fff',
    borderRadius: 5,
    width: 28,
    height: 28,
    fontSize: '0.85rem',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
  },
  modalBody: {
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  modalHint: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    color: '#374151',
    margin: 0,
  },
  hintTextarea: {
    fontFamily: 'var(--font-code)',
    fontSize: '0.85rem',
    padding: '8px 10px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    resize: 'vertical',
    width: '100%',
    color: 'var(--colour-text)',
  },
  modalFooter: {
    padding: '12px 16px',
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    borderTop: '1px solid #e5e7eb',
    flexShrink: 0,
  },
}
