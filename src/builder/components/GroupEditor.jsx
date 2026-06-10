import React from 'react'

export default function GroupEditor({ group, onUpdate }) {
  return (
    <div style={s.wrap}>
      <div style={s.field}>
        <span style={s.label}>Group title</span>
        <input
          style={s.input}
          value={group.title}
          onChange={e => onUpdate({ ...group, title: e.target.value })}
          placeholder="e.g. Functions"
          autoFocus
        />
      </div>
      <p style={s.hint}>
        This group contains {group.subtasks?.length ?? 0} subtask{(group.subtasks?.length ?? 0) !== 1 ? 's' : ''}.
        Subtasks are shown as a single step in the student progress indicator.
        Use the task list to add, reorder, or delete subtasks.
      </p>
    </div>
  )
}

const s = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 16, padding: 4 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.88rem',
    color: 'var(--colour-text)',
  },
  input: {
    border: '1px solid #d1d5db',
    borderRadius: 6,
    padding: '8px 10px',
    fontSize: '0.95rem',
    fontFamily: 'var(--font-body)',
    color: 'var(--colour-text)',
    outline: 'none',
  },
  hint: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.86rem',
    color: '#6b7280',
    lineHeight: 1.6,
    margin: 0,
  },
}
