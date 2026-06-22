import React, { useState } from 'react'
import { formatEstimatedMinutes, getTotalEstimatedMinutes } from '../../shared/taskUtils'

function taskIconType(task) {
  if (task.taskType === 'draft') return 'draft'
  if (task.taskType === 'information') return 'information'
  if (task.taskType === 'quiz') return 'quiz'
  if (task.toolbox || task.starterBlocks || task.completeBlocks) return 'scratch'
  return 'code'
}

function TaskFormatIcon({ type }) {
  const common = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (type === 'draft') return (
    <svg {...common}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  )
  if (type === 'scratch') return (
    <svg {...common}>
      <rect x="2" y="2" width="9" height="9" rx="1.5" />
      <rect x="13" y="2" width="9" height="9" rx="1.5" />
      <rect x="2" y="13" width="9" height="9" rx="1.5" />
      <rect x="13" y="13" width="9" height="9" rx="1.5" />
    </svg>
  )
  if (type === 'information') return (
    <svg {...common}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </svg>
  )
  if (type === 'quiz') return (
    <svg {...common}>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  )
  return (
    <svg {...common}>
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  )
}

function removeTaskFromTree(items, taskId) {
  let removed = null
  const next = items.map(item => {
    if (item.type === 'group') {
      const subtasks = (item.subtasks ?? []).filter(task => {
        if (task.id === taskId) {
          removed = task
          return false
        }
        return true
      })
      return { ...item, subtasks }
    }
    if (item.id === taskId) {
      removed = item
      return null
    }
    return item
  }).filter(Boolean)
  return { next, removed }
}

function insertTaskIntoTree(items, task, target) {
  if (!task) return items

  if (target.groupId) {
    return items.map(item => {
      if (item.type !== 'group' || item.id !== target.groupId) return item
      const subtasks = [...(item.subtasks ?? [])]
      const index = Math.max(0, Math.min(target.index, subtasks.length))
      subtasks.splice(index, 0, task)
      return { ...item, subtasks }
    })
  }

  const next = [...items]
  const index = Math.max(0, Math.min(target.index, next.length))
  next.splice(index, 0, task)
  return next
}

export default function TaskList({
  tasks,
  selectedTaskId,
  selectedGroupId,
  onSelect,
  onSelectGroup,
  onAdd,
  onAddDraft,
  onAddGroup,
  onAddSubtask,
  onDuplicate,
  onDelete,
  onDeleteGroup,
  onReorder,
  onReorderSubtask,
}) {
  const [expandedGroups, setExpandedGroups] = useState(() => {
    const map = {}
    tasks.forEach(item => { if (item.type === 'group') map[item.id] = true })
    return map
  })
  const [dragState, setDragState] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const totalEstimatedMinutes = getTotalEstimatedMinutes(tasks)

  function toggleGroup(groupId) {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  function moveUp(index) {
    if (index === 0) return
    const reordered = [...tasks]
    ;[reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]]
    onReorder(reordered)
  }

  function moveDown(index) {
    if (index === tasks.length - 1) return
    const reordered = [...tasks]
    ;[reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]]
    onReorder(reordered)
  }

  function handleDragStart(e, payload) {
    setDragState(payload)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/json', JSON.stringify(payload))
  }

  function handleDragEnd() {
    setDragState(null)
    setDropTarget(null)
  }

  function handleDragOver(e, target) {
    if (!dragState) return
    if (dragState.kind === 'group' && target.groupId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropTarget(target)
  }

  function handleDrop(e, target) {
    e.preventDefault()
    const payload = dragState ?? JSON.parse(e.dataTransfer.getData('application/json') || 'null')
    setDragState(null)
    setDropTarget(null)
    if (!payload) return

    if (payload.kind === 'group') {
      if (target.groupId) return
      const currentIndex = tasks.findIndex(item => item.type === 'group' && item.id === payload.id)
      if (currentIndex < 0) return
      const reordered = [...tasks]
      const [group] = reordered.splice(currentIndex, 1)
      const targetIndex = currentIndex < target.index ? target.index - 1 : target.index
      reordered.splice(Math.max(0, Math.min(targetIndex, reordered.length)), 0, group)
      onReorder(reordered)
      return
    }

    const { next, removed } = removeTaskFromTree(tasks, payload.id)
    if (!removed) return
    const adjustedTarget = { ...target }
    if (!target.groupId) {
      const oldTopIndex = tasks.findIndex(item => item.type !== 'group' && item.id === payload.id)
      if (oldTopIndex >= 0 && oldTopIndex < target.index) adjustedTarget.index -= 1
    } else if (target.groupId === payload.sourceGroupId) {
      const group = tasks.find(item => item.type === 'group' && item.id === target.groupId)
      const oldSubtaskIndex = group?.subtasks?.findIndex(task => task.id === payload.id) ?? -1
      if (oldSubtaskIndex >= 0 && oldSubtaskIndex < target.index) adjustedTarget.index -= 1
    }
    onReorder(insertTaskIntoTree(next, removed, adjustedTarget))
  }

  function dropStyle(target) {
    const active =
      dropTarget &&
      dropTarget.groupId === target.groupId &&
      dropTarget.index === target.index
    return active ? s.dropTarget : null
  }

  function moveSubtaskUp(groupId, subtaskIndex, subtasks) {
    if (subtaskIndex === 0) return
    const reordered = [...subtasks]
    ;[reordered[subtaskIndex - 1], reordered[subtaskIndex]] = [reordered[subtaskIndex], reordered[subtaskIndex - 1]]
    onReorderSubtask(groupId, reordered)
  }

  function moveSubtaskDown(groupId, subtaskIndex, subtasks) {
    if (subtaskIndex === subtasks.length - 1) return
    const reordered = [...subtasks]
    ;[reordered[subtaskIndex], reordered[subtaskIndex + 1]] = [reordered[subtaskIndex + 1], reordered[subtaskIndex]]
    onReorderSubtask(groupId, reordered)
  }

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <div style={s.headerTitle}>
          <span style={s.label}>Tasks</span>
          <span style={s.totalTime}>Total: {formatEstimatedMinutes(totalEstimatedMinutes)}</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="btn-primary" style={s.addBtn} onClick={onAdd} title="Add standalone task">
            + Task
          </button>
          <button
            type="button"
            style={s.addGroupBtn}
            onClick={onAddGroup}
            title="Add task group"
          >
            + Group
          </button>
          {onAddDraft && (
            <button
              type="button"
              style={s.addDraftBtn}
              onClick={onAddDraft}
              title="Add a draft placeholder task"
            >
              + Draft
            </button>
          )}
        </div>
      </div>

      <div style={s.list}>
        {tasks.length === 0 && (
          <p style={s.empty}>No tasks yet. Click "+ Task" to create one.</p>
        )}

        {tasks.map((item, i) => {
          if (item.type === 'group') {
            const expanded = expandedGroups[item.id] !== false
            const isGroupSelected = selectedGroupId === item.id
            const subtasks = item.subtasks ?? []

            return (
              <div key={item.id}>
                <div
                  style={{
                    ...s.groupHeader,
                    ...(isGroupSelected ? s.groupHeaderActive : {}),
                    ...(dropStyle({ groupId: null, index: i }) ?? {}),
                  }}
                  draggable
                  onDragStart={e => handleDragStart(e, { kind: 'group', id: item.id })}
                  onDragEnd={handleDragEnd}
                  onDragOver={e => handleDragOver(e, { groupId: null, index: i })}
                  onDrop={e => handleDrop(e, { groupId: null, index: i })}
                  onClick={() => {
                    onSelectGroup(item.id)
                    if (!expandedGroups[item.id]) toggleGroup(item.id)
                  }}
                >
                  <button
                    type="button"
                    style={s.chevronBtn}
                    onClick={e => { e.stopPropagation(); toggleGroup(item.id) }}
                    aria-label={expanded ? 'Collapse group' : 'Expand group'}
                  >
                    {expanded ? '▾' : '▸'}
                  </button>
                  <span style={s.groupIcon}>⊞</span>
                  <span style={s.groupTitle}>
                    {item.title || <em style={{ opacity: 0.5 }}>Untitled Group</em>}
                  </span>
                  <span style={s.groupCount}>{subtasks.length}</span>
                  <div style={s.actions} onClick={e => e.stopPropagation()}>
                    <button style={s.iconBtn} onClick={() => moveUp(i)} title="Move group up" disabled={i === 0}>▲</button>
                    <button style={s.iconBtn} onClick={() => moveDown(i)} title="Move group down" disabled={i === tasks.length - 1}>▼</button>
                    <button style={{ ...s.iconBtn, color: '#ef4444' }} onClick={() => onDeleteGroup(item.id)} title="Delete group and all subtasks">✕</button>
                  </div>
                </div>

                {expanded && (
                  <div
                    style={{
                      ...s.subtaskList,
                      ...(dropStyle({ groupId: item.id, index: subtasks.length }) ?? {}),
                    }}
                    onDragOver={e => handleDragOver(e, { groupId: item.id, index: subtasks.length })}
                    onDrop={e => handleDrop(e, { groupId: item.id, index: subtasks.length })}
                  >
                    {subtasks.map((subtask, j) => {
                      const isActive = subtask.id === selectedTaskId
                      return (
                        <div
                          key={subtask.id}
                          style={{
                            ...s.subtaskItem,
                            ...(isActive ? s.subtaskItemActive : {}),
                            ...(dropStyle({ groupId: item.id, index: j }) ?? {}),
                          }}
                          draggable
                          onDragStart={e => handleDragStart(e, { kind: 'task', id: subtask.id, sourceGroupId: item.id })}
                          onDragEnd={handleDragEnd}
                          onDragOver={e => { e.stopPropagation(); handleDragOver(e, { groupId: item.id, index: j }) }}
                          onDrop={e => { e.stopPropagation(); handleDrop(e, { groupId: item.id, index: j }) }}
                          onClick={() => onSelect(subtask.id)}
                        >
                          <span style={s.subtaskNum}>{j + 1}</span>
                          <span style={s.taskTypeIcon} title={`${taskIconType(subtask)} task`}>
                            <TaskFormatIcon type={taskIconType(subtask)} />
                          </span>
                          <span style={s.title}>
                            {subtask.title || <em style={{ opacity: 0.5 }}>Untitled</em>}
                          </span>
                          <div style={s.actions} onClick={e => e.stopPropagation()}>
                            <button style={s.iconBtn} onClick={() => moveSubtaskUp(item.id, j, subtasks)} title="Move up" disabled={j === 0}>▲</button>
                            <button style={s.iconBtn} onClick={() => moveSubtaskDown(item.id, j, subtasks)} title="Move down" disabled={j === subtasks.length - 1}>▼</button>
                            <button style={s.iconBtn} onClick={() => onDuplicate(subtask, item.id)} title="Duplicate subtask">⧉</button>
                            <button style={{ ...s.iconBtn, color: '#ef4444' }} onClick={() => onDelete(subtask.id)} title="Delete subtask">✕</button>
                          </div>
                        </div>
                      )
                    })}
                    <div
                      style={{ ...s.groupEndDropZone, ...(dropStyle({ groupId: item.id, index: subtasks.length }) ?? {}) }}
                      onDragOver={e => { e.stopPropagation(); handleDragOver(e, { groupId: item.id, index: subtasks.length }) }}
                      onDrop={e => { e.stopPropagation(); handleDrop(e, { groupId: item.id, index: subtasks.length }) }}
                    />
                    <button
                      type="button"
                      style={s.addSubtaskBtn}
                      onClick={() => onAddSubtask(item.id)}
                    >
                      + Add subtask
                    </button>
                  </div>
                )}
              </div>
            )
          }

          // Standalone task
          const isActive = item.id === selectedTaskId
          const isDraft = item.taskType === 'draft'
          return (
            <div
              key={item.id}
              style={{
                ...s.item,
                ...(isDraft ? s.itemDraft : {}),
                ...(isActive ? (isDraft ? s.itemDraftActive : s.itemActive) : {}),
                ...(dropStyle({ groupId: null, index: i }) ?? {}),
              }}
              draggable
              onDragStart={e => handleDragStart(e, { kind: 'task', id: item.id, sourceGroupId: null })}
              onDragEnd={handleDragEnd}
              onDragOver={e => handleDragOver(e, { groupId: null, index: i })}
              onDrop={e => handleDrop(e, { groupId: null, index: i })}
              onClick={() => onSelect(item.id)}
            >
              <span style={isDraft ? s.numDraft : s.num}>{i + 1}</span>
              <span style={{ ...s.taskTypeIcon, ...(isDraft ? s.taskTypeIconDraft : {}) }} title={`${taskIconType(item)} task`}>
                <TaskFormatIcon type={taskIconType(item)} />
              </span>
              <span style={s.title}>
                {item.title || <em style={{ opacity: 0.5 }}>Untitled</em>}
              </span>
              {isDraft && <span style={s.draftBadge}>DRAFT</span>}
              <div style={s.actions} onClick={e => e.stopPropagation()}>
                <button style={s.iconBtn} onClick={() => moveUp(i)} title="Move up" disabled={i === 0}>▲</button>
                <button style={s.iconBtn} onClick={() => moveDown(i)} title="Move down" disabled={i === tasks.length - 1}>▼</button>
                <button style={s.iconBtn} onClick={() => onDuplicate(item)} title="Duplicate">⧉</button>
                <button style={{ ...s.iconBtn, color: '#ef4444' }} onClick={() => onDelete(item.id)} title="Delete">✕</button>
              </div>
            </div>
          )
        })}
        <div
          style={{ ...s.endDropZone, ...(dropStyle({ groupId: null, index: tasks.length }) ?? {}) }}
          onDragOver={e => handleDragOver(e, { groupId: null, index: tasks.length })}
          onDrop={e => handleDrop(e, { groupId: null, index: tasks.length })}
        />
      </div>
    </div>
  )
}

const s = {
  wrap: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: {
    background: 'var(--colour-primary)',
    color: '#fff',
    padding: '8px 10px 8px 14px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexShrink: 0,
  },
  label: { fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '0.85rem', letterSpacing: '0.04em' },
  headerTitle: { display: 'flex', flexDirection: 'column', gap: 2 },
  totalTime: { fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: '0.7rem', opacity: 0.84 },
  addBtn: { fontSize: 11, padding: '4px 8px' },
  addGroupBtn: {
    fontSize: 11,
    padding: '4px 8px',
    background: 'rgba(255,255,255,0.15)',
    border: '1px solid rgba(255,255,255,0.4)',
    color: '#fff',
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
  },
  addDraftBtn: {
    fontSize: 11,
    padding: '4px 8px',
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.3)',
    color: 'rgba(255,255,255,0.75)',
    borderRadius: 6,
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
  },
  list: { flex: 1, overflowY: 'auto' },
  dropTarget: {
    boxShadow: 'inset 0 2px 0 var(--colour-secondary)',
    background: '#fff7e6',
  },
  endDropZone: {
    height: 18,
  },
  empty: {
    padding: '16px 14px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
    color: '#9ca3af',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px 8px 14px',
    cursor: 'pointer',
    borderLeft: '3px solid transparent',
    transition: 'background 0.1s',
  },
  itemActive: {
    background: '#f0eafa',
    borderLeftColor: 'var(--colour-primary)',
  },
  num: {
    width: 20,
    height: 20,
    background: 'var(--colour-primary)',
    color: '#fff',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.72rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    flexShrink: 0,
  },
  title: {
    flex: 1,
    fontFamily: 'var(--font-body)',
    fontSize: '0.87rem',
    fontWeight: 600,
    color: 'var(--colour-text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  taskTypeIcon: {
    width: 20,
    height: 20,
    borderRadius: 5,
    color: 'var(--colour-primary)',
    background: '#f7f2ff',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  actions: { display: 'flex', gap: 2, flexShrink: 0 },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    padding: '2px 4px',
    fontSize: '0.8rem',
    cursor: 'pointer',
    borderRadius: 4,
    color: '#6b7280',
    opacity: 0.7,
  },
  itemDraft: {
    background: '#fafafa',
    borderLeft: '3px solid #d1d5db',
    opacity: 0.85,
  },
  itemDraftActive: {
    background: '#f1f5f9',
    borderLeftColor: '#6b7280',
    opacity: 1,
  },
  numDraft: {
    width: 20,
    height: 20,
    background: '#9ca3af',
    color: '#fff',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.72rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    flexShrink: 0,
  },
  taskTypeIconDraft: {
    color: '#9ca3af',
    background: '#f3f4f6',
  },
  draftBadge: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.62rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    color: '#9ca3af',
    background: '#f3f4f6',
    border: '1px solid #e5e7eb',
    borderRadius: 4,
    padding: '1px 5px',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  // Group styles
  groupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 10px 7px 6px',
    cursor: 'pointer',
    background: '#f8f5ff',
    borderLeft: '3px solid transparent',
    borderBottom: '1px solid #f0eafa',
    transition: 'background 0.1s',
  },
  groupHeaderActive: {
    background: '#ede8ff',
    borderLeftColor: 'var(--colour-primary)',
  },
  chevronBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--colour-primary)',
    fontSize: '0.85rem',
    cursor: 'pointer',
    padding: '0 2px',
    lineHeight: 1,
    flexShrink: 0,
  },
  groupIcon: {
    fontSize: '0.8rem',
    color: 'var(--colour-primary)',
    opacity: 0.7,
    flexShrink: 0,
  },
  groupTitle: {
    flex: 1,
    fontFamily: 'var(--font-body)',
    fontSize: '0.87rem',
    fontWeight: 700,
    color: 'var(--colour-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  groupCount: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.72rem',
    color: '#6b7280',
    background: '#e5e7eb',
    borderRadius: 999,
    padding: '1px 6px',
    flexShrink: 0,
  },
  subtaskList: {
    borderLeft: '3px solid #c4b5fd',
    marginLeft: 14,
    background: '#fafafa',
  },
  groupEndDropZone: {
    height: 12,
    margin: '1px 4px',
    borderRadius: 3,
    border: '1px dashed #d1c4e9',
  },
  subtaskItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 10px 7px 10px',
    cursor: 'pointer',
    borderLeft: '2px solid transparent',
    transition: 'background 0.1s',
  },
  subtaskItemActive: {
    background: '#f0eafa',
    borderLeftColor: 'var(--colour-primary)',
  },
  subtaskNum: {
    width: 18,
    height: 18,
    background: '#c4b5fd',
    color: '#4e1aa3',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.65rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    flexShrink: 0,
  },
  addSubtaskBtn: {
    width: '100%',
    padding: '6px 10px',
    background: 'transparent',
    border: 'none',
    borderTop: '1px dashed #e5e7eb',
    color: 'var(--colour-primary)',
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'left',
    opacity: 0.8,
  },
}
