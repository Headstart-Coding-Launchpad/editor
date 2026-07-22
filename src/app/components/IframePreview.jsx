import React, { useState, useEffect, useRef } from 'react'

export default function IframePreview({ src, iframeRef, height = 300, fill = false, leadingActions = null, rightActions = null, onConsoleError }) {
  const [tab, setTab] = useState('preview')
  const [logs, setLogs] = useState([])
  const logEndRef = useRef(null)

  // Clear console on each new run
  useEffect(() => { setLogs([]) }, [src])

  // Auto-scroll console to bottom when new entries arrive
  useEffect(() => {
    if (tab === 'console') logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs, tab])

  // Listen for postMessage events from the iframe
  useEffect(() => {
    function onMessage(e) {
      if (!e.data || e.data.source !== 'hsc-console') return
      if (iframeRef?.current && e.source !== iframeRef.current.contentWindow) return
      setLogs(prev => [...prev, {
        id: Date.now() + Math.random(),
        level: e.data.level,
        args: e.data.args,
      }])
      if (e.data.level === 'error') onConsoleError?.(src)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [iframeRef, onConsoleError, src])

  const wrapStyle = fill
    ? { ...s.wrap, flex: 1, minHeight: 0, flexShrink: 1 }
    : { ...s.wrap, height }

  const errCount = logs.filter(l => l.level === 'error').length

  return (
    <div style={wrapStyle}>
      <div style={s.header} className="ui-tabs">
        {leadingActions && <div style={s.leadingActions}>{leadingActions}</div>}
        <button
          className={`ui-tab${tab === 'preview' ? ' is-active' : ''}`}
          style={tab === 'preview' ? { ...s.tab, ...s.tabActive } : s.tab}
          onClick={() => setTab('preview')}
        >
          Preview
        </button>
        <button
          className={`ui-tab${tab === 'console' ? ' is-active' : ''}`}
          style={tab === 'console' ? { ...s.tab, ...s.tabActive } : s.tab}
          onClick={() => setTab('console')}
        >
          Console
          {errCount > 0 && <span style={s.badge}>{errCount}</span>}
        </button>
        {rightActions && <div style={s.trailingActions}>{rightActions}</div>}
      </div>

      {/* Always rendered so the iframe doesn't reload on tab switch */}
      <iframe
        ref={iframeRef}
        src={src ?? 'about:blank'}
        style={{ ...s.frame, display: tab === 'preview' ? 'block' : 'none' }}
        sandbox="allow-scripts allow-modals allow-same-origin"
        title="Output preview"
      />

      {tab === 'console' && (
        <div style={s.consolePane}>
          {logs.length === 0 ? (
            <div style={s.empty}>No console output yet — press Run to see output here</div>
          ) : (
            logs.map(entry => (
              <div key={entry.id} style={{ ...s.logRow, ...rowStyle(entry.level) }}>
                <span style={{ ...s.levelTag, ...tagStyle(entry.level) }}>{entry.level}</span>
                <span style={s.logText}>{entry.args.join(' ')}</span>
              </div>
            ))
          )}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  )
}

function rowStyle(level) {
  switch (level) {
    case 'error': return { background: 'rgba(239,68,68,0.06)', color: '#b91c1c' }
    case 'warn':  return { background: 'rgba(245,158,11,0.06)', color: '#92400e' }
    case 'info':  return { color: '#1e40af' }
    default:      return { color: 'var(--colour-text)' }
  }
}

function tagStyle(level) {
  switch (level) {
    case 'error': return { background: '#fee2e2', color: '#b91c1c' }
    case 'warn':  return { background: '#fef3c7', color: '#92400e' }
    case 'info':  return { background: '#dbeafe', color: '#1e40af' }
    default:      return { background: '#f3f4f6', color: '#374151' }
  }
}

const s = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    borderRadius: 10,
    overflow: 'hidden',
    border: '1px solid #e5e7eb',
    background: '#fff',
    flexShrink: 0,
  },
  header: {
    background: 'var(--colour-primary)',
    padding: '0 8px',
    display: 'flex',
    alignItems: 'stretch',
    flexShrink: 0,
  },
  leadingActions: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 2px',
    flexShrink: 0,
  },
  trailingActions: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    paddingLeft: 8,
    flexShrink: 0,
  },
  tab: {
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    color: 'rgba(255,255,255,0.65)',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.8rem',
    letterSpacing: '0.04em',
    padding: '9px 10px 7px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
  },
  tabActive: {
    color: '#fff',
    borderBottom: '2px solid #fff',
  },
  badge: {
    background: '#ef4444',
    color: '#fff',
    borderRadius: 10,
    fontSize: '0.7rem',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    padding: '1px 5px',
    lineHeight: '1.4',
    minWidth: 16,
    textAlign: 'center',
  },
  frame: {
    flex: 1,
    border: 'none',
    width: '100%',
    background: '#fff',
    minHeight: 0,
  },
  consolePane: {
    flex: 1,
    overflow: 'auto',
    background: '#fafafa',
    minHeight: 0,
  },
  empty: {
    padding: '20px 16px',
    color: '#9ca3af',
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
    textAlign: 'center',
  },
  logRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '4px 12px',
    borderBottom: '1px solid rgba(0,0,0,0.04)',
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: '13px',
    lineHeight: 1.5,
  },
  levelTag: {
    flexShrink: 0,
    fontSize: '0.68rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '1px 5px',
    borderRadius: 3,
    fontWeight: 700,
    fontFamily: 'var(--font-body)',
    marginTop: 2,
  },
  logText: {
    flex: 1,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
}
