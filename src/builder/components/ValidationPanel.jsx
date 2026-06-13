import React, { useState } from 'react'

export default function ValidationPanel({ errors, warnings }) {
  const [open, setOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(errors.length ? 'errors' : 'warnings')
  const [ignoredWarnings, setIgnoredWarnings] = useState(() => new Set())

  const visibleWarnings = warnings.filter(w => !ignoredWarnings.has(w))

  const summaryParts = []
  if (errors.length) summaryParts.push(`${errors.length} error${errors.length !== 1 ? 's' : ''}`)
  if (visibleWarnings.length) summaryParts.push(`${visibleWarnings.length} warning${visibleWarnings.length !== 1 ? 's' : ''}`)
  const summary = summaryParts.join(', ') || 'No issues'

  const items = activeTab === 'errors' ? errors : visibleWarnings
  const count = activeTab === 'errors' ? errors.length : visibleWarnings.length

  return (
    <section style={s.validation}>
      <button
        type="button"
        style={s.header}
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <span style={s.headerTitle}>Validation</span>
        <span style={{ ...s.summary, color: errors.length ? '#ef4444' : visibleWarnings.length ? '#f59e0b' : '#22c55e' }}>
          {summary}
        </span>
        <span style={{ ...s.chevron, transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
      </button>

      {open && (
        <>
          <div style={s.tabs}>
            <button
              style={{ ...s.tab, ...(activeTab === 'errors' ? s.tabActive : {}) }}
              onClick={() => setActiveTab('errors')}
            >
              Errors <span style={s.countBadge}>{errors.length}</span>
            </button>
            <button
              style={{ ...s.tab, ...(activeTab === 'warnings' ? s.tabActive : {}) }}
              onClick={() => setActiveTab('warnings')}
            >
              Warnings <span style={s.countBadge}>{visibleWarnings.length}</span>
            </button>
          </div>

          <div style={s.body}>
            {count === 0 ? (
              <p style={s.empty}>
                No {activeTab === 'errors' ? 'errors' : 'warnings'} found.
              </p>
            ) : (
              items.map((item, i) => (
                <div key={`${activeTab}-${i}`} style={activeTab === 'errors' ? s.errorItem : s.warningItem}>
                  <span style={{ flex: 1 }}>{item}</span>
                  {activeTab === 'warnings' && (
                    <button
                      type="button"
                      style={s.ignoreBtn}
                      onClick={() => setIgnoredWarnings(prev => new Set([...prev, item]))}
                      title="Ignore this warning until you change task"
                    >
                      Ignore
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </section>
  )
}

const s = {
  validation: {
    borderTop: '1px solid #e5e7eb',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 14px',
    background: '#fafafa',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
  },
  headerTitle: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.82rem',
    color: 'var(--colour-text)',
    flexShrink: 0,
  },
  summary: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.8rem',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  chevron: {
    marginLeft: 'auto',
    color: '#6b7280',
    fontSize: '1rem',
    lineHeight: 1,
    flexShrink: 0,
  },
  tabs: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    padding: 10,
    gap: 6,
    borderBottom: '1px solid #e5e7eb',
    background: '#fafafa',
  },
  tab: {
    border: '1px solid #e5e7eb',
    background: '#fff',
    color: 'var(--colour-text)',
    borderRadius: 6,
    padding: '7px 8px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.82rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  tabActive: {
    borderColor: 'var(--colour-primary)',
    color: 'var(--colour-primary)',
    background: '#f7f2ff',
  },
  countBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 20,
    height: 20,
    marginLeft: 6,
    padding: '0 6px',
    borderRadius: 999,
    background: '#eef2ff',
    color: 'var(--colour-primary)',
    fontSize: '0.72rem',
  },
  body: {
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxHeight: 220,
    overflowY: 'auto',
  },
  empty: {
    margin: 0,
    color: '#6b7280',
    fontFamily: 'var(--font-body)',
    fontSize: '0.86rem',
  },
  errorItem: {
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#991b1b',
    borderRadius: 6,
    padding: '8px 10px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.84rem',
    lineHeight: 1.45,
  },
  warningItem: {
    border: '1px solid #fde68a',
    background: '#fffbeb',
    color: '#92400e',
    borderRadius: 6,
    padding: '8px 10px',
    fontFamily: 'var(--font-body)',
    fontSize: '0.84rem',
    lineHeight: 1.45,
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
  },
  ignoreBtn: {
    flexShrink: 0,
    padding: '2px 8px',
    background: 'transparent',
    border: '1px solid #d97706',
    borderRadius: 4,
    color: '#92400e',
    fontFamily: 'var(--font-body)',
    fontSize: '0.76rem',
    cursor: 'pointer',
    lineHeight: 1.4,
  },
}
