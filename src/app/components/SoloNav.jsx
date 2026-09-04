import React from 'react'
import { useIsMobile } from '../../shared/useIsMobile'

export default function SoloNav({
  flatTasks,
  currentIndex,
  cs,
  canNavigateNextSolo,
  onNavigate,
  compact = false,
}) {
  const isMobile = useIsMobile()
  const navStyle = compact ? s.soloNavCompact : s.soloNav
  const btnStyle = compact ? s.soloNavBtnCompact : s.soloNavBtn
  const labelStyle = compact
    ? { ...s.soloNavLabelCompact, ...(isMobile ? { minWidth: 0 } : {}) }
    : s.soloNavLabel

  return (
    <div style={navStyle}>
      {!cs.inPersonalSandbox && (
        <button
          className="btn-secondary"
          style={btnStyle}
          disabled={currentIndex <= 0}
          onClick={() => onNavigate(flatTasks[currentIndex - 1]?.id)}
        >
          Previous
        </button>
      )}
      {cs.inPersonalSandbox ? (
        <span style={labelStyle}>{isMobile ? 'Sandbox' : 'Personal Sandbox'}</span>
      ) : (
        <span style={labelStyle}>
          {isMobile
            ? `${currentIndex + 1}/${flatTasks.length}`
            : `Task ${currentIndex + 1} of ${flatTasks.length}`}
        </span>
      )}
      {!cs.inPersonalSandbox && (
        <button
          className={`btn-secondary${cs.checkPassed && currentIndex < flatTasks.length - 1 ? ' btn-next-success' : ''}`}
          style={{
            ...btnStyle,
            ...(!compact && canNavigateNextSolo && currentIndex < flatTasks.length - 1
              ? { fontSize: 18, padding: '14px 36px' }
              : {}),
          }}
          disabled={currentIndex >= flatTasks.length - 1 || !canNavigateNextSolo}
          onClick={() => onNavigate(flatTasks[currentIndex + 1]?.id)}
          title={!canNavigateNextSolo ? 'Pass the completion check before moving on' : 'Next task'}
        >
          Next
        </button>
      )}
    </div>
  )
}

const s = {
  soloNav: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px 16px',
    borderTop: '2px solid #e5e7eb',
    background: '#f5f5f5',
    flexShrink: 0,
  },
  soloNavCompact: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  soloNavBtn: {
    fontSize: 16,
    padding: '12px 28px',
    fontWeight: 600,
  },
  soloNavBtnCompact: {
    fontSize: 12,
    padding: '6px 10px',
    fontWeight: 700,
    lineHeight: 1.1,
    minHeight: 30,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  soloNavLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'var(--font-body)',
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--colour-text)',
  },
  soloNavLabelCompact: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.78rem',
    fontWeight: 700,
    color: '#fff',
    opacity: 0.9,
    whiteSpace: 'nowrap',
    minWidth: 70,
    textAlign: 'center',
  },
}
