import React from 'react'

function getLanguageLabel(language) {
  if (language === 'python') return 'Python'
  if (language === 'html') return 'HTML'
  if (language === 'css') return 'CSS'
  if (language === 'javascript') return 'JavaScript'
  return 'Code'
}

export default function CopyCodePanel({ code, language = 'python' }) {
  const text = typeof code === 'string' ? code : ''

  if (!text.trim()) return null

  const languageLabel = getLanguageLabel(language)

  return (
    <section
      style={s.panel}
      aria-label={`${languageLabel} reference code`}
      onCopy={e => e.preventDefault()}
      onCut={e => e.preventDefault()}
      onDragStart={e => e.preventDefault()}
      onContextMenu={e => e.preventDefault()}
    >
      <div style={s.header}>
        <span style={s.title}>{languageLabel} reference</span>
      </div>
      <pre style={s.pre}>
        <code style={s.code}>{text}</code>
      </pre>
    </section>
  )
}

const s = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    minWidth: 0,
    maxHeight: 240,
    border: '1px solid #cbd5e1',
    borderRadius: 8,
    background: '#f8fafc',
    overflow: 'hidden',
    boxShadow: '0 1px 2px rgba(15,23,42,0.05)',
    marginBottom: 8,
    userSelect: 'none',
    WebkitUserSelect: 'none',
    MozUserSelect: 'none',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    padding: '7px 10px',
    background: '#eef2f7',
    borderBottom: '1px solid #cbd5e1',
  },
  title: {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: '0.82rem',
    color: '#334155',
    lineHeight: 1.2,
  },
  pre: {
    margin: 0,
    padding: '11px 12px',
    overflow: 'auto',
    whiteSpace: 'pre',
    lineHeight: 1.55,
    fontSize: 13,
    color: '#111827',
  },
  code: {
    fontFamily: 'var(--font-code)',
    fontVariantLigatures: 'none',
    fontFeatureSettings: '"liga" 0, "calt" 0',
  },
}
