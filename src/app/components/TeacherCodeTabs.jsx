import React from 'react'
import { formatStageLabel, getStageRole } from '../../shared/taskUtils'

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
  unifiedStages = false,
  showLiveTab = false,
  onLive,
  liveReferenceVisibleToAll = false,
  onToggleLiveReference,
}) {
  const isLiveTab = activeTab === 'live'
  // Unified stage tabs have no separate Starter / Complete tab, so the default 'starter' (and
  // 'complete') tab is shown on the stage with that role: otherwise no tab looked selected.
  let shownTab = activeTab
  if (unifiedStages && (activeTab === 'starter' || activeTab === 'complete')) {
    const index = stages.findIndex((stage) => getStageRole(stage) === activeTab)
    if (index >= 0) shownTab = `stage_${index}`
    else if (activeTab === 'starter' && stages.length > 0) shownTab = 'stage_0'
  }
  return (
    <div className="ui-tabs ui-tabs--editor" role="tablist" aria-label="Teacher code workspace">
      {!unifiedStages && (
        <button
          type="button"
          className={`ui-tab${activeTab === 'starter' ? ' is-active' : ''}`}
          role="tab"
          aria-selected={activeTab === 'starter'}
          onClick={onStarter}
        >
          {starterLabel}
        </button>
      )}
      {stages.map((stage, i) => {
        const selected = shownTab === `stage_${i}`
        return (
          <button
            key={i}
            type="button"
            className={`ui-tab${selected ? ' is-active' : ''}`}
            role="tab"
            aria-selected={selected}
            onClick={() => onStage?.(i)}
          >
            {formatStageLabel(stage, i, { showSupportRole: unifiedStages })}
          </button>
        )
      })}
      {!unifiedStages && onComplete && (
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
      {showLiveTab && (
        <button
          type="button"
          className={`ui-tab${isLiveTab ? ' is-active' : ''}`}
          role="tab"
          aria-selected={isLiveTab}
          onClick={onLive}
        >
          Live
        </button>
      )}
      {hasStudents && isLiveTab && (onToggleLiveReference || onSendToAll) ? (
        <div style={tabActions}>
          {/* One-off: shows for the current task only and drops off on the next one,
              like "Reveal to all" for a stage. */}
          {onSendToAll && (
            <button
              type="button"
              style={sendStageBtn}
              title="Show your live code to every student for this task only"
              onClick={() => {
                if (window.confirm('Reveal your live code to all students for this task?')) {
                  onSendToAll('reveal_live')
                }
              }}
            >
              Reveal live code to all
            </button>
          )}
          {/* Pinned: keeps showing on every task until turned off. */}
          {onToggleLiveReference && (
            <button
              type="button"
              style={{
                ...sendStageBtn,
                ...(onSendToAll ? { marginLeft: 6 } : {}),
                ...(liveReferenceVisibleToAll ? sendStageBtnActive : {}),
              }}
              aria-pressed={liveReferenceVisibleToAll}
              title={
                liveReferenceVisibleToAll
                  ? 'Stop showing your live code to the class'
                  : 'Keep showing your live code to the whole class on every task until you turn it off'
              }
              onClick={() => onToggleLiveReference(!liveReferenceVisibleToAll)}
            >
              {liveReferenceVisibleToAll
                ? '📌 Live code: kept on'
                : '📌 Keep showing live code to class'}
            </button>
          )}
        </div>
      ) : (
        hasStudents &&
        onSendToAll &&
        !isLiveTab && (
          <div style={tabActions}>
            <button
              type="button"
              style={sendStageBtn}
              title="Send this stage's code to all students"
              onClick={() => {
                // A non-starter stage (support/complete role) is always safe to "reveal" — a
                // read-only reference — rather than force-reset every student's saved work to
                // it, regardless of whether this module type uses the unified tab layout. This
                // is the same safe path the per-student Reveal action already uses for every
                // module type (see StudentModal.jsx's onRevealSupportStage).
                const stage = activeTab.startsWith('stage_')
                  ? stages[parseInt(activeTab.replace('stage_', ''), 10)]
                  : null
                const isRevealableStage = stage && getStageRole(stage) !== 'starter'
                const action = isRevealableStage
                  ? `reveal_stage_${activeTab.replace('stage_', '')}`
                  : activeTab === 'complete'
                    ? 'complete'
                    : activeTab.startsWith('stage_')
                      ? activeTab
                      : 'starter'
                const verb = isRevealableStage ? 'Reveal' : 'Send'
                if (
                  window.confirm(
                    `${verb} ${activeTab === 'starter' ? starterLabel : activeTab === 'complete' ? completeLabel : (stage?.label ?? activeTab)} to all students?`
                  )
                ) {
                  onSendToAll(action)
                }
              }}
            >
              {activeTab.startsWith('stage_') &&
              getStageRole(stages[parseInt(activeTab.replace('stage_', ''), 10)]) !== 'starter'
                ? 'Reveal to all'
                : 'Send to all'}
            </button>
          </div>
        )
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

const sendStageBtnActive = {
  background: 'rgba(124,58,237,0.22)',
  borderColor: 'rgba(124,58,237,0.5)',
}
