import React, { useState } from 'react'
import { formatAppVersion, getAppBuildInfo } from '../shared/appVersion'
import { RELEASE_NOTES } from './releaseNotes'

export default function AppVersionFooter({ buildInfo = getAppBuildInfo() }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const label = formatAppVersion(buildInfo)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(label)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) {
      console.error('Copy version failed:', err)
    }
  }

  return (
    <footer style={s.footer}>
      {open && (
        <section style={s.notes} aria-label="What's new">
          <h2 style={s.notesTitle}>What's new</h2>
          {RELEASE_NOTES.map((release) => (
            <div key={release.version} style={s.release}>
              <div style={s.releaseHead}>
                <strong>v{release.version}</strong>
                <span>{release.title}</span>
                <span style={s.releaseDate}>{release.date}</span>
              </div>
              <ul style={s.list}>
                {release.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
      <div style={s.bar}>
        <button
          type="button"
          style={s.versionBtn}
          aria-expanded={open}
          title="Show what's new"
          onClick={() => setOpen((v) => !v)}
        >
          {label}
        </button>
        <button type="button" style={s.copyBtn} onClick={handleCopy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </footer>
  )
}

const s = {
  footer: {
    borderTop: '1px solid #e5e7eb',
    background: '#fff',
    padding: '8px 32px',
    flexShrink: 0,
    fontFamily: 'var(--font-body)',
    fontSize: '0.78rem',
    color: '#6b7280',
  },
  bar: {
    maxWidth: 1100,
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
  },
  versionBtn: {
    background: 'none',
    border: 'none',
    padding: 0,
    color: 'inherit',
    font: 'inherit',
    cursor: 'pointer',
  },
  copyBtn: {
    background: 'none',
    border: '1px solid #e5e7eb',
    borderRadius: 4,
    padding: '1px 8px',
    color: 'inherit',
    font: 'inherit',
    cursor: 'pointer',
  },
  notes: {
    maxWidth: 1100,
    margin: '0 auto 8px',
    color: '#374151',
  },
  notesTitle: {
    fontFamily: 'var(--font-title)',
    fontSize: '0.95rem',
    margin: '4px 0 8px',
  },
  release: { marginBottom: 8 },
  releaseHead: { display: 'flex', gap: 6, alignItems: 'baseline' },
  releaseDate: { color: '#9ca3af', marginLeft: 'auto' },
  list: { margin: '4px 0 0', paddingLeft: 20, lineHeight: 1.5 },
}
