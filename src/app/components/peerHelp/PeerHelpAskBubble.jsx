import React, { useEffect, useRef } from 'react'

const AUTO_CLOSE_MS = 30_000

/**
 * Right after ✋ Help, where peer help is possible: "Can a classmate help too?" Ignoring it
 * (it closes itself) means no. Yes is the opt-in; the teacher still decides whether anyone is
 * asked.
 */
export default function PeerHelpAskBubble({ onYes, onNo }) {
  const onNoRef = useRef(onNo)
  onNoRef.current = onNo
  useEffect(() => {
    const timer = setTimeout(() => onNoRef.current(), AUTO_CLOSE_MS)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div style={s.bubble} role="dialog" aria-label="Can a classmate help too?">
      <span style={s.line}>Your teacher is coming.</span>
      <strong style={s.question}>Can a classmate help too?</strong>
      <div style={s.actions}>
        <button type="button" className="btn-primary" style={s.btn} onClick={onYes}>
          👍 Yes
        </button>
        <button type="button" className="btn-ghost-outline" style={s.btn} onClick={onNo}>
          No thanks
        </button>
      </div>
    </div>
  )
}

const s = {
  bubble: {
    position: 'fixed',
    top: 64,
    right: 16,
    zIndex: 950,
    width: 'min(300px, calc(100vw - 32px))',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    padding: 14,
    background: 'var(--ui-surface)',
    color: 'var(--colour-text)',
    border: '2px solid #0d9488',
    borderRadius: 14,
    boxShadow: 'var(--ui-shadow)',
  },
  line: { fontSize: 15 },
  question: { fontSize: 17 },
  actions: { display: 'flex', gap: 8, marginTop: 4 },
  btn: { fontSize: 15, padding: '6px 14px' },
}
