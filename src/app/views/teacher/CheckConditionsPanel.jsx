import React, { useState } from 'react'
import { formatCheckValue } from './checkFormatting'

export default function CheckConditionsPanel({ check, taskTitle }) {
  const [open, setOpen] = useState(false)
  const checks = Array.isArray(check) ? check : [check]
  return (
    <div style={styles.wrap}>
      <button style={styles.header} onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <span style={styles.title}>Check Conditions{taskTitle ? ` \u2014 ${taskTitle}` : ''}</span>
        <span style={styles.chevron}>{open ? '\u25b2' : '\u25bc'}</span>
      </button>
      {open && (
        <div style={styles.body}>
          {checks.map((c, i) => (
            <div key={i} style={styles.row}>
              <span style={styles.badge}>{i + 1}</span>
              <span style={styles.type}>{c.type?.replace(/_/g, ' ')}</span>
              <span style={styles.value}>{formatCheckValue(c)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const styles = {
  wrap: { flexShrink: 0, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' },
  header: {
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '9px 14px', background: '#f9fafb', border: 'none', cursor: 'pointer', textAlign: 'left',
  },
  title: { fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '0.8rem', letterSpacing: '0.03em', color: 'var(--colour-primary)' },
  chevron: { fontSize: '0.65rem', color: '#9ca3af', flexShrink: 0 },
  body: { display: 'flex', flexDirection: 'column', gap: 0 },
  row: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '7px 14px', borderTop: '1px solid #f3f4f6',
    fontFamily: 'var(--font-body)', fontSize: '0.82rem',
  },
  badge: {
    background: 'var(--colour-primary)', color: '#fff', borderRadius: 4,
    fontWeight: 700, fontSize: '0.7rem', padding: '1px 6px', flexShrink: 0,
  },
  type: { color: '#6b7280', fontWeight: 600, fontSize: '0.75rem', flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.03em' },
  value: { color: 'var(--colour-text)', fontFamily: 'var(--font-code)', fontSize: '0.8rem' },
}
