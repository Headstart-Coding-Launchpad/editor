import { useState } from 'react'
import { SHARE_TTL_DAYS } from '../../shared/exportWork/shareLink.js'
import { revokeShareLink } from '../../shared/exportWork/shareService.js'

const KIND_LABELS = { python: 'Python', scratch: 'Scratch', html: 'Web page' }

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// The share links made for every student at End Session (report.shareLinks, request #77,
// src/shared/exportWork/sessionShareLinks.js), shown in TeacherReportModal — which the Reports
// panel and the Admin lesson panel reuse. Copy one, copy all, or revoke one. Nothing is sent.
export default function ReportShareLinksSection({ report }) {
  const [copied, setCopied] = useState(null) // a shareId, or 'all'
  const [revoked, setRevoked] = useState({}) // shareId → true | error message
  const links = Array.isArray(report?.shareLinks) ? report.shareLinks : []
  if (links.length === 0) return null
  const labels = new Map((report.students ?? []).map((st) => [st.studentKey, st.studentLabel]))
  const labelOf = (link) => labels.get(link.studentKey) ?? link.studentKey
  const made = links.filter((link) => link.url && revoked[link.shareId] !== true)
  const expires = links.find((link) => link.expiresAt)?.expiresAt

  async function handleCopy(key, text) {
    if (await copyText(text)) {
      setCopied(key)
      setTimeout(() => setCopied((prev) => (prev === key ? null : prev)), 1500)
    }
  }

  async function handleRevoke(shareId) {
    try {
      await revokeShareLink(shareId)
      setRevoked((prev) => ({ ...prev, [shareId]: true }))
    } catch (error) {
      setRevoked((prev) => ({ ...prev, [shareId]: `Revoke failed: ${error.message}` }))
    }
  }

  return (
    <section data-testid="report-share-links">
      <div style={s.head}>
        <h3 style={s.title}>Share links for parents</h3>
        {made.length > 0 && (
          <button
            className="btn-ghost-outline"
            style={s.btn}
            onClick={() =>
              handleCopy('all', made.map((link) => `${labelOf(link)}: ${link.url}`).join('\n'))
            }
          >
            {copied === 'all' ? 'Copied' : `Copy all (${made.length})`}
          </button>
        )}
      </div>
      <p style={s.hint}>
        Made when the session ended: each student&apos;s last code task, read-only, with no names.
        {expires
          ? ` They work until ${new Date(expires).toLocaleDateString()}.`
          : ` They work for ${SHARE_TTL_DAYS} days.`}{' '}
        Nothing has been sent to anyone.
      </p>
      <ul style={s.list}>
        {links.map((link) => {
          const state = link.shareId ? revoked[link.shareId] : undefined
          return (
            <li key={link.shareId ?? link.studentKey} style={s.row}>
              <span style={s.who}>{labelOf(link)}</span>
              {link.url ? (
                <>
                  <span style={s.what}>
                    {KIND_LABELS[link.kind] ?? link.kind}
                    {link.taskTitle ? ` · ${link.taskTitle}` : ''}
                  </span>
                  {state === true ? (
                    <span style={s.muted}>Revoked</span>
                  ) : (
                    <>
                      <a href={link.url} target="_blank" rel="noreferrer" style={s.link}>
                        Open
                      </a>
                      <button
                        className="btn-ghost-outline"
                        style={s.btn}
                        onClick={() => handleCopy(link.shareId, link.url)}
                      >
                        {copied === link.shareId ? 'Copied' : 'Copy'}
                      </button>
                      <button
                        className="btn-ghost-outline"
                        style={s.btn}
                        onClick={() => handleRevoke(link.shareId)}
                      >
                        Revoke
                      </button>
                    </>
                  )}
                  {typeof state === 'string' && <span style={s.error}>{state}</span>}
                </>
              ) : (
                <span style={s.muted}>No link: {link.error ?? 'the work could not be shared'}</span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

const s = {
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '0.95rem', margin: 0 },
  hint: { fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: '#6b7280', margin: '6px 0' },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' },
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    padding: '6px 0',
    borderBottom: '1px solid #f3f4f6',
    fontFamily: 'var(--font-body)',
    fontSize: '0.85rem',
  },
  who: { fontWeight: 600, minWidth: 90 },
  what: { flex: '1 1 160px', color: '#374151' },
  link: { color: 'var(--colour-primary)', fontWeight: 600 },
  btn: { fontSize: 12, padding: '3px 10px' },
  muted: { color: '#6b7280' },
  error: { color: '#b91c1c', fontSize: '0.8rem' },
}
