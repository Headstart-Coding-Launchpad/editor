import React from 'react'
import ExplainerPanel from '../ExplainerPanel'
import StudentHintPanel from './StudentHintPanel'

// The StudentModal's left column, laid out like the student's own screen: the task's
// instructions card, then what this student is being shown (the hint on their banner, tagged
// "student is seeing this") and the Type this out text they can open. Folds to a thin rail so
// the workspace gets the width back.
export default function StudentModalLeftColumn({
  task,
  lessonType,
  student,
  session,
  isSessionSandbox,
  copyCode = null,
  collapsed,
  onCollapsedChange,
}) {
  if (collapsed) {
    return (
      <div style={s.rail} data-testid="student-modal-rail">
        <button
          type="button"
          style={s.railButton}
          aria-label="Show instructions"
          title="Show the instructions"
          onClick={() => onCollapsedChange(false)}
        >
          ▸
        </button>
        <span style={s.railLabel} aria-hidden="true">
          Instructions
        </span>
      </div>
    )
  }
  const explainer = task?.explainer ?? ''
  return (
    <div style={s.column} data-testid="student-modal-left">
      <div style={s.explainerWrap} data-testid="student-modal-instructions">
        <ExplainerPanel
          title={task?.title ?? 'Instructions'}
          content={explainer}
          collapsible={false}
          // Fills the column and scrolls inside itself only when the text is longer: never
          // clipped behind "show more" over empty space (sketch OK'd 8 Nov 2026).
          fill
          stretch
          topicType={lessonType}
          showLibrary={false}
          titleEndInset={40}
        />
        <button
          type="button"
          style={s.collapse}
          aria-label="Hide instructions"
          title="Fold the instructions away"
          onClick={() => onCollapsedChange(true)}
        >
          ◂
        </button>
      </div>
      <StudentHintPanel
        student={student}
        session={session}
        isSessionSandbox={isSessionSandbox}
        tag="student is seeing this"
      />
      {copyCode && (
        <div style={s.copy} data-testid="student-modal-copy-code">
          <span style={{ ...s.tag, background: '#166534' }}>student can open this</span>
          <div style={s.copyTitle}>⌨️ Type this out</div>
          <pre style={s.copyCode}>{copyCode}</pre>
        </div>
      )}
    </div>
  )
}

const s = {
  column: {
    width: 'clamp(240px, 22vw, 360px)',
    flexShrink: 0,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    overflowY: 'auto',
    paddingTop: 2,
  },
  explainerWrap: {
    position: 'relative',
    flex: '1 1 auto',
    minHeight: 160,
    display: 'flex',
    flexDirection: 'column',
  },
  collapse: {
    position: 'absolute',
    top: 4,
    right: 6,
    width: 30,
    height: 30,
    borderRadius: 6,
    border: 'none',
    background: 'rgba(255,255,255,0.2)',
    color: '#fff',
    fontSize: 14,
    cursor: 'pointer',
  },
  rail: {
    width: 44,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 10,
    padding: '6px 0',
    background: '#fff',
    border: '1px solid #e6e0f0',
    borderRadius: 8,
  },
  railButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: '1px solid #cdbdec',
    background: '#fff',
    color: 'var(--colour-primary)',
    fontWeight: 700,
    cursor: 'pointer',
  },
  railLabel: {
    writingMode: 'vertical-rl',
    transform: 'rotate(180deg)',
    fontWeight: 700,
    fontSize: 12.5,
    color: '#6b7280',
    letterSpacing: '0.04em',
  },
  tag: {
    position: 'absolute',
    right: 8,
    top: -10,
    background: 'var(--colour-primary)',
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
    borderRadius: 999,
    padding: '2px 8px',
  },
  copy: {
    position: 'relative',
    flexShrink: 0,
    marginTop: 6,
    padding: '10px 12px 8px',
    borderRadius: 8,
    border: '1px solid #86efac',
    background: '#dcfce7',
    color: '#166534',
    fontFamily: 'var(--font-body)',
  },
  copyTitle: { fontWeight: 700, fontSize: 14, marginBottom: 6 },
  copyCode: {
    margin: 0,
    padding: '6px 8px',
    borderRadius: 6,
    background: '#fff',
    color: '#111827',
    fontFamily: 'var(--font-code)',
    fontSize: 13,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    maxHeight: 180,
    overflowY: 'auto',
  },
}
