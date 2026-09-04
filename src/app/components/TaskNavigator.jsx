import React, { useState } from 'react'
import { flattenTasks, getTaskPriority } from '../../shared/taskUtils'

function OptionalBadge({ task }) {
  if (getTaskPriority(task) !== 'optional') return null
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
}) {
  const total = students.length
  const runCount = students.filter((st) => st.lastRunStatus != null && st.lastRunAt).length
  const checkCount = students.filter((st) => st.checkPassed).length
  const flatTasks = flattenTasks(tasks)
  // Navigate Prev/Next relative to what's currently displayed (preview or session task)
  const displayId = previewTaskId ?? currentTaskId
  const displayIndex = flatTasks.findIndex((t) => t.id === displayId)

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
                    const hasCheck = task.check != null

                    return (
                      <button
                        key={task.id}
                        style={{
                          ...s.subtaskItem,
                          ...(isCurrent ? s.subtaskItemActive : {}),
                          ...(isPreview && !isCurrent ? s.subtaskItemPreview : {}),
                          ...(isSandbox || sandboxStaging
                            ? { opacity: 0.45, cursor: 'default' }
                            : {}),
                        }}
                        onClick={() => !isSandbox && !sandboxStaging && onTaskSelect?.(task.id)}
                      >
                        <span style={s.subtaskDot} />
                        <div style={s.detail}>
                          <span style={s.taskTitle}>{task.title}</span>
                          <OptionalBadge task={task} />
                          {isCurrent && total > 0 && (
                            <span style={s.stat}>
                              {runCount}/{total} run
                              {hasCheck ? ` · ${checkCount} ✅` : ''}
                            </span>
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
          const hasCheck = item.check != null

          return (
            <button
              key={item.id}
              style={{
                ...s.item,
                ...(isCurrent ? s.itemActive : {}),
                ...(isPreview && !isCurrent ? s.itemPreview : {}),
                ...(isSandbox || sandboxStaging ? { opacity: 0.45, cursor: 'default' } : {}),
              }}
              onClick={() => !isSandbox && !sandboxStaging && onTaskSelect?.(item.id)}
            >
              <span style={s.num}>{item.id}</span>
              <div style={s.detail}>
                <span style={s.taskTitle}>{item.title}</span>
                <OptionalBadge task={item} />
                {isCurrent && total > 0 && (
                  <span style={s.stat}>
                    {runCount}/{total} run
                    {hasCheck ? ` · ${checkCount} ✅` : ''}
                  </span>
                )}
              </div>
              {isCurrent && <span style={s.arrow}>◀</span>}
              {isPreview && !isCurrent && <span style={s.previewEye}>👁</span>}
            </button>
          )
        })}
      </div>

      {/* Previous / Next — navigates relative to displayed task (preview or session) */}
      <div style={s.navButtons}>
        <button
          className="btn-secondary"
          style={{
            ...s.navBtn,
            ...(isSandbox || sandboxStaging ? { opacity: 0.45, cursor: 'default' } : {}),
          }}
          disabled={displayIndex <= 0}
          onClick={() => {
            if (isSandbox || sandboxStaging) return
            const prev = flatTasks[displayIndex - 1]
            if (prev) onTaskSelect?.(prev.id)
          }}
        >
          ← Prev
        </button>
        <button
          className="btn-secondary"
          style={{
            ...s.navBtn,
            ...(isSandbox || sandboxStaging ? { opacity: 0.45, cursor: 'default' } : {}),
          }}
          disabled={displayIndex >= flatTasks.length - 1}
          onClick={() => {
            if (isSandbox || sandboxStaging) return
            const next = flatTasks[displayIndex + 1]
            if (next) onTaskSelect?.(next.id)
          }}
        >
          Next →
        </button>
      </div>

      {/* Sandbox toggle */}
      <div style={s.sandboxArea}>
        {isSandbox ? (
          <button className="btn-danger" style={{ width: '100%' }} onClick={onSandbox}>
            Deactivate Sandbox
          </button>
        ) : sandboxStaging ? (
          <button
            className="btn-ghost"
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
            className="btn-ghost"
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
  itemPreview: {
    background: '#eff6ff',
    borderLeftColor: '#3b82f6',
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
    background: '#eff6ff',
    borderLeftColor: '#3b82f6',
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
  navButtons: {
    display: 'flex',
    gap: 8,
    padding: '8px 12px',
    borderTop: '1px solid #e5e7eb',
    flexShrink: 0,
  },
  navBtn: {
    flex: 1,
    fontSize: 13,
    padding: '6px 0',
  },
  sandboxArea: {
    padding: '8px 12px 12px',
    borderTop: '1px solid #e5e7eb',
    flexShrink: 0,
  },
}
