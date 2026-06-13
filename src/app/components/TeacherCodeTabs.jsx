import React from 'react'

export default function TeacherCodeTabs({
  activeTab,
  stages = [],
  onStarter,
  onStage,
  onComplete,
  onSendToAll,
  hasStudents,
  starterLabel = 'Starter code',
  completeLabel = 'Complete code',
}) {
  return (
    <div className="ui-tabs ui-tabs--editor" role="tablist" aria-label="Teacher code workspace">
      <button
        type="button"
        className={`ui-tab${activeTab === 'starter' ? ' is-active' : ''}`}
        role="tab"
        aria-selected={activeTab === 'starter'}
        onClick={onStarter}
      >
        {starterLabel}
      </button>
      {stages.map((stage, i) => (
        <button
          key={i}
          type="button"
          className={`ui-tab${activeTab === `stage_${i}` ? ' is-active' : ''}`}
          role="tab"
          aria-selected={activeTab === `stage_${i}`}
          onClick={() => onStage?.(i)}
        >
          {stage.label || `Stage ${i + 1}`}
        </button>
      ))}
      {onComplete && (
        <button
          type="button"
          className={`ui-tab${activeTab === 'complete' ? ' is-active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'complete'}
          onClick={onComplete}
        >
          {completeLabel}
        </button>
      )}
      {hasStudents && onSendToAll && (
        <div style={tabActions}>
          <button
            type="button"
            style={sendStageBtn}
            title="Send this stage's code to all students"
            onClick={() => {
              const action = activeTab === 'complete' ? 'complete' : activeTab.startsWith('stage_') ? activeTab : 'starter'
              if (window.confirm(`Send ${activeTab === 'starter' ? starterLabel : activeTab === 'complete' ? completeLabel : stages[parseInt(activeTab.replace('stage_', ''), 10)]?.label ?? activeTab} to all students?`)) {
                onSendToAll(action)
              }
            }}
          >
            Send to all
          </button>
        </div>
      )}
    </div>
  )
}

const tabActions = {
  marginLeft: 'auto',
  display: 'flex',
  alignItems: 'center',
  paddingLeft: 8,
}

const sendStageBtn = {
  fontSize: 12,
  padding: '4px 10px',
  background: 'rgba(124,58,237,0.12)',
  color: 'var(--colour-primary)',
  border: '1px solid rgba(124,58,237,0.35)',
  borderRadius: 5,
  cursor: 'pointer',
  fontFamily: 'var(--font-body)',
  fontWeight: 600,
  whiteSpace: 'nowrap',
}
