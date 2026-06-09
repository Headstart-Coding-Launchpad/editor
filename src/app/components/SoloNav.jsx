import React from 'react'

export default function SoloNav({
  flatTasks,
  currentIndex,
  cs,
  hasPersonalSandbox,
  isQuizTask,
  isInformationTask,
  canNavigateNextSolo,
  onNavigate,
}) {
  return (
    <div style={s.soloNav}>
      {!cs.inPersonalSandbox && (
        <button
          className="btn-secondary"
          style={s.soloNavBtn}
          disabled={currentIndex <= 0}
          onClick={() => onNavigate(flatTasks[currentIndex - 1]?.id)}
        >
          Previous
        </button>
      )}
      {cs.inPersonalSandbox ? (
        <span style={s.soloNavLabel}>Personal Sandbox</span>
      ) : (
        <span style={s.soloNavLabel}>
          Task {currentIndex + 1} of {flatTasks.length}
        </span>
      )}
      {!cs.inPersonalSandbox && hasPersonalSandbox && !isQuizTask && !isInformationTask && (
        <button
          className="btn-ghost-outline"
          style={{ ...s.soloNavBtn, fontSize: 14 }}
          onClick={cs.handleEnterPersonalSandbox}
          title="Open your personal sandbox to experiment freely"
        >
          Open Sandbox
        </button>
      )}
      {!cs.inPersonalSandbox && (
        <button
          className={`btn-secondary${cs.checkPassed && currentIndex < flatTasks.length - 1 ? ' btn-next-success' : ''}`}
          style={{
            ...s.soloNavBtn,
            ...(canNavigateNextSolo && currentIndex < flatTasks.length - 1
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
  soloNavBtn: {
    fontSize: 16,
    padding: '12px 28px',
    fontWeight: 600,
  },
  soloNavLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'var(--font-body)',
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--colour-text)',
  },
}
