import React, { useState } from 'react'
import { flattenTasks, getTaskPriority } from '../../shared/taskUtils'
import { isHostedActivityTask } from '../../activities/registry.pure.js'
import { countOptionalAhead, countOptionalTasks } from '../../shared/classNavigation'

function isOptionalTask(task) {
  return getTaskPriority(task) === 'optional'
}

// While Skip optional tasks is on an optional row says Next jumps over it; otherwise it keeps
// the small "optional" badge.
function OptionalBadge({ task, skipped }) {
  if (!isOptionalTask(task)) return null
  if (skipped) {
    return (
      <span style={s.skippedTag} title="Skip optional tasks is on: Next jumps over this task">
        skipped by Next
      </span>
    )
  }
  return (
    <span style={s.optionalBadge} title="Optional task">
      optional
    </span>
  )
}

export default function TaskNavigator({
  tasks = [],
  currentTaskId,
  previewTaskId,
  session,
  students = [],
  onTaskSelect,
  onSandbox,
  isSandbox,
  sandboxStaging,
  collapsed,
  onToggle,
  // The tutor's "Skip optional tasks" switch (session.skipOptionalTasks): Next jumps over
  // optional tasks. Their rows stay visible, greyed, and still preview when clicked.
  skipOptional = false,
  onSkipOptionalChange,
}) {
  const total = students.length
  const runCount = students.filter((st) => st.lastRunStatus != null && st.lastRunAt).length
  const checkCount = students.filter((st) => st.checkPassed).length
  // The current task's line under its title. An information task has nothing to run, so it
  // has no line (it used to say "0/2 run"); a quiz or activity counts answers, not runs.
  function statLine(task) {
    if (task?.taskType === 'information') return null
    const checked = task?.check != null ? ` · ${checkCount} ✅` : ''
    if (isHostedActivityTask(task)) {
      const answered = students.filter((st) => st.lastRunStatus != null).length
      return `${answered}/${total} answered${checked}`
    }
    return `${runCount}/${total} run${checked}`
  }
  const flatTasks = flattenTasks(tasks)
  const optionalCount = countOptionalTasks(flatTasks)
  const optionalAhead = countOptionalAhead(flatTasks, currentTaskId)
  const isSkipped = (task) => skipOptional && isOptionalTask(task) && task.id !== currentTaskId
  // While the tutor previews another task, the class's own row says so.
  const previewing = previewTaskId != null && previewTaskId !== currentTaskId

  const [expandedGroups, setExpandedGroups] = useState(() => {
    const map = {}
    tasks.forEach((item) => {
      if (item.type === 'group') map[item.id] = true
    })
    return map
  })

  function toggleGroup(groupId) {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  if (collapsed) {
    return (
      <div style={s.collapsedWrap}>
        <button style={s.collapseBtn} onClick={onToggle} title="Show Tasks">
          ›
        </button>
        <span style={s.collapsedLabel}>Tasks</span>
      </div>
    )
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <span style={s.headerLabel}>Tasks</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {session?.state === 'active' && <span style={s.state}>LIVE</span>}
          <button style={s.toggleBtn} onClick={onToggle} title="Collapse Tasks">
            ‹
          </button>
        </div>
      </div>

      <div style={s.list}>
        {tasks.map((item, i) => {
          if (item.type === 'group') {
            const subtasks = item.subtasks ?? []
            const isCurrentGroup = subtasks.some((t) => t.id === currentTaskId)
            const isPreviewGroup = previewTaskId && subtasks.some((t) => t.id === previewTaskId)
            const expanded = expandedGroups[item.id] !== false

            return (
              <div key={item.id}>
                <button
                  style={{
                    ...s.groupHeader,
                    ...(isCurrentGroup ? s.groupHeaderActive : {}),
                    ...(isPreviewGroup && !isCurrentGroup ? s.groupHeaderPreview : {}),
                    ...(isSandbox || sandboxStaging ? { opacity: 0.45, cursor: 'default' } : {}),
                  }}
                  onClick={() => !isSandbox && !sandboxStaging && toggleGroup(item.id)}
                >
                  <span style={s.groupChevron}>{expanded ? '▾' : '▸'}</span>
                  <span style={s.groupHeaderTitle}>{item.title || 'Untitled Group'}</span>
                  <span style={s.groupBadge}>{subtasks.length}</span>
                </button>

                {expanded &&
                  subtasks.map((task) => {
                    const isCurrent = task.id === currentTaskId
                    const isPreview = previewTaskId && task.id === previewTaskId
                    const skipped = isSkipped(task)

                    return (
                      <button
                        key={task.id}
                        data-skipped={skipped ? 'true' : undefined}
                        style={{
                          ...s.subtaskItem,
                          ...(isCurrent ? s.subtaskItemActive : {}),
                          ...(isPreview && !isCurrent ? s.subtaskItemPreview : {}),
                          ...(skipped ? s.itemSkipped : {}),
                          ...(isSandbox || sandboxStaging
                            ? { opacity: 0.45, cursor: 'default' }
                            : {}),
                        }}
                        onClick={() => !isSandbox && !sandboxStaging && onTaskSelect?.(task.id)}
                      >
                        <span style={s.subtaskDot} />
                        <div style={s.detail}>
                          <span style={s.taskTitle}>{task.title}</span>
                          <OptionalBadge task={task} skipped={skipped} />
                          {isCurrent && previewing && (
                            <span style={s.classHereTag}>class is here</span>
                          )}
                          {isCurrent && total > 0 && statLine(task) && (
                            <span style={s.stat}>{statLine(task)}</span>
                          )}
                        </div>
                        {isCurrent && <span style={s.arrow}>◀</span>}
                        {isPreview && !isCurrent && <span style={s.previewEye}>👁</span>}
                      </button>
                    )
                  })}
              </div>
            )
          }

          // Standalone task
          const isCurrent = item.id === currentTaskId
          const isPreview = previewTaskId && item.id === previewTaskId
          const skipped = isSkipped(item)

          return (
            <button
              key={item.id}
              data-skipped={skipped ? 'true' : undefined}
              style={{
                ...s.item,
                ...(isCurrent ? s.itemActive : {}),
                ...(isPreview && !isCurrent ? s.itemPreview : {}),
                ...(skipped ? s.itemSkipped : {}),
                ...(isSandbox || sandboxStaging ? { opacity: 0.45, cursor: 'default' } : {}),
              }}
              onClick={() => !isSandbox && !sandboxStaging && onTaskSelect?.(item.id)}
            >
              <span style={s.num}>{item.id}</span>
              <div style={s.detail}>
                <span style={s.taskTitle}>{item.title}</span>
                <OptionalBadge task={item} skipped={skipped} />
                {isCurrent && previewing && <span style={s.classHereTag}>class is here</span>}
                {isCurrent && total > 0 && statLine(item) && (
                  <span style={s.stat}>{statLine(item)}</span>
                )}
              </div>
              {isCurrent && <span style={s.arrow}>◀</span>}
              {isPreview && !isCurrent && <span style={s.previewEye}>👁</span>}
            </button>
          )
        })}
      </div>

      {/* No Prev / Next here (calm teacher view): clicking a task previews it, and ← / → step
          the preview (TeacherView). The class moves from the presentation window, the
          countdown's Next task or the preview banner's Move class here. */}
      {/* Footer: the Skip optional tasks setting (a switch, not a task row) above Sandbox. */}
      <div style={s.sandboxArea} data-testid="task-nav-footer">
        {optionalCount > 0 && onSkipOptionalChange && (
          <button
            type="button"
            role="switch"
            aria-checked={skipOptional}
            aria-label="Skip optional tasks"
            style={s.skipSwitch}
            onClick={() => onSkipOptionalChange(!skipOptional)}
            title="When on, Next (presentation window and the countdown) jumps over optional tasks"
          >
            <span
              aria-hidden="true"
              style={{ ...s.switchTrack, ...(skipOptional ? s.switchTrackOn : {}) }}
            >
              <span style={{ ...s.switchKnob, ...(skipOptional ? s.switchKnobOn : {}) }} />
            </span>
            <span style={s.skipText}>
              <span style={s.skipLabel}>Skip optional tasks</span>
              <span style={s.skipHint}>
                {skipOptional
                  ? optionalAhead > 0
                    ? `Next skips ${optionalAhead} optional`
                    : 'No optional tasks ahead'
                  : `${optionalCount} optional in this lesson`}
              </span>
            </span>
          </button>
        )}
        {isSandbox ? (
          // The yellow sandbox bar above the work area has the one Deactivate Sandbox button
          // (there used to be two; HSC Audit, Visual Review 24).
          <p style={s.sandboxNote} data-testid="task-nav-sandbox-live">
            Sandbox is live. End it with Deactivate Sandbox in the yellow bar.
          </p>
        ) : sandboxStaging ? (
          <button
            className="btn-ghost-outline"
            style={{
              width: '100%',
              color: 'var(--colour-primary)',
              border: '1px solid var(--colour-primary)',
            }}
            onClick={onSandbox}
          >
            Cancel Sandbox
          </button>
        ) : (
          <button
            className="btn-ghost-outline"
            style={{
              width: '100%',
              color: 'var(--colour-primary)',
              border: '1px solid var(--colour-primary)',
            }}
            onClick={onSandbox}
          >
            Sandbox
          </button>
        )}
      </div>
    </div>
  )
}

const s = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  header: {
    background: 'var(--colour-primary)',
    color: '#fff',
    padding: '10px 14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
  },
  headerLabel: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.85rem',
    letterSpacing: '0.04em',
  },
  state: {
    fontSize: '0.7rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    background: '#22c55e',
    borderRadius: 4,
    padding: '2px 6px',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: '8px 0',
  },
  // Standalone task
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '9px 14px',
    background: 'transparent',
    border: 'none',
    borderRadius: 0,
    textAlign: 'left',
    cursor: 'pointer',
    borderLeft: '3px solid transparent',
    transition: 'background 0.1s',
  },
  itemActive: {
    background: '#f0eafa',
    borderLeftColor: 'var(--colour-primary)',
  },
  // The previewed row: a dashed amber outline, matching the amber preview banner.
  itemPreview: {
    background: '#fffbeb',
    outline: '2px dashed #f59e0b',
    outlineOffset: -2,
  },
  num: {
    width: 22,
    height: 22,
    background: 'var(--colour-primary)',
    color: '#fff',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    flexShrink: 0,
  },
  // Group header
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: '8px 14px',
    background: '#f8f5ff',
    border: 'none',
    borderLeft: '3px solid transparent',
    borderBottom: '1px solid #f0eafa',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  groupHeaderActive: {
    background: '#ede8ff',
    borderLeftColor: 'var(--colour-primary)',
  },
  groupHeaderPreview: {
    background: '#eff6ff',
    borderLeftColor: '#3b82f6',
  },
  groupChevron: {
    fontSize: '0.8rem',
    color: 'var(--colour-primary)',
    flexShrink: 0,
    lineHeight: 1,
  },
  groupHeaderTitle: {
    flex: 1,
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.86rem',
    color: 'var(--colour-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  groupBadge: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.7rem',
    color: '#6b7280',
    background: '#e5e7eb',
    borderRadius: 999,
    padding: '1px 6px',
    flexShrink: 0,
  },
  // Subtask inside a group
  subtaskItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    padding: '7px 14px 7px 28px',
    background: 'transparent',
    border: 'none',
    borderLeft: '3px solid #c4b5fd',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'background 0.1s',
  },
  subtaskItemActive: {
    background: '#f0eafa',
    borderLeftColor: 'var(--colour-primary)',
  },
  subtaskItemPreview: {
    background: '#fffbeb',
    outline: '2px dashed #f59e0b',
    outlineOffset: -2,
  },
  subtaskDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#c4b5fd',
    flexShrink: 0,
  },
  detail: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  taskTitle: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  optionalBadge: {
    alignSelf: 'flex-start',
    fontFamily: 'var(--font-body)',
    fontSize: '0.62rem',
    fontWeight: 700,
    color: '#0369a1',
    background: '#e0f2fe',
    border: '1px solid #7dd3fc',
    borderRadius: 4,
    padding: '1px 5px',
    lineHeight: 1.25,
    whiteSpace: 'nowrap',
  },
  stat: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.75rem',
    color: '#6b7280',
  },
  arrow: { fontSize: '0.7rem', color: 'var(--colour-primary)', flexShrink: 0 },
  previewEye: { fontSize: '0.75rem', flexShrink: 0 },
  toggleBtn: {
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.8)',
    fontSize: '1.1rem',
    cursor: 'pointer',
    padding: '0 4px',
    lineHeight: 1,
    borderRadius: 3,
  },
  collapsedWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    height: '100%',
    background: '#fff',
    borderRight: '1px solid #e5e7eb',
    paddingTop: 8,
    gap: 8,
  },
  collapseBtn: {
    background: 'var(--colour-primary)',
    border: 'none',
    color: '#fff',
    fontSize: '1.1rem',
    cursor: 'pointer',
    width: 28,
    height: 28,
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    lineHeight: 1,
  },
  collapsedLabel: {
    writingMode: 'vertical-rl',
    transform: 'rotate(180deg)',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.75rem',
    letterSpacing: '0.05em',
    color: 'var(--colour-primary)',
    opacity: 0.6,
    userSelect: 'none',
    marginTop: 4,
  },
  classHereTag: {
    alignSelf: 'flex-start',
    fontFamily: 'var(--font-body)',
    fontSize: '0.62rem',
    fontWeight: 700,
    color: '#fff',
    background: '#15803d',
    borderRadius: 4,
    padding: '1px 5px',
    whiteSpace: 'nowrap',
  },
  sandboxArea: {
    padding: '8px 12px 12px',
    borderTop: '1px solid #e5e7eb',
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  itemSkipped: {
    opacity: 0.55,
  },
  skippedTag: {
    alignSelf: 'flex-start',
    fontFamily: 'var(--font-body)',
    fontSize: '0.68rem',
    color: '#6b7280',
    whiteSpace: 'nowrap',
  },
  skipSwitch: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    padding: 0,
    background: 'transparent',
    border: 'none',
    textAlign: 'left',
    cursor: 'pointer',
  },
  switchTrack: {
    position: 'relative',
    width: 30,
    height: 16,
    borderRadius: 999,
    background: '#d1d5db',
    flexShrink: 0,
    transition: 'background 0.15s',
  },
  switchTrackOn: { background: 'var(--colour-primary)' },
  switchKnob: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: '#fff',
    transition: 'left 0.15s',
  },
  switchKnobOn: { left: 16 },
  skipText: { display: 'flex', flexDirection: 'column', minWidth: 0 },
  skipLabel: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.76rem',
    fontWeight: 600,
    color: 'var(--colour-text)',
  },
  skipHint: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.68rem',
    color: '#6b7280',
  },
  sandboxNote: {
    margin: 0,
    fontFamily: 'var(--font-body)',
    fontSize: '0.78rem',
    lineHeight: 1.35,
    color: '#92400e',
  },
}
