// Admin ▸ Shared work: every share link tutors made from "Export work" (Firestore
// `sharedWork`), newest first, with Revoke for the live ones. Links show no student name;
// revoking (or the 30-day expiry) makes the public /share/:id page say the link has ended.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { getModuleLabel } from '../modules/definitions'
import { shareDaysLeft, shareStatus, shareUrl } from '../shared/exportWork/shareLink.js'
import { listShareLinks, revokeShareLink } from '../shared/exportWork/shareService.js'
import {
  AdminBadge,
  AdminCell,
  AdminMessage,
  AdminSection,
  AdminTable,
  adminUiStyles,
} from './AdminUi'

const STATUS_BADGE = {
  live: { background: '#dcfce7', color: '#15803d' },
  expired: { background: '#f3f4f6', color: '#6b7280' },
  revoked: { background: '#fee2e2', color: '#b91c1c' },
}
const STATUS_LABEL = { live: 'Live', expired: 'Expired', revoked: 'Revoked' }

function formatDate(value) {
  const ms = typeof value?.toMillis === 'function' ? value.toMillis() : null
  return ms ? new Date(ms).toLocaleDateString() : '—'
}

export default function SharedWorkPanel() {
  const [links, setLinks] = useState(null)
  const [error, setError] = useState(null)
  const [showAll, setShowAll] = useState(false)
  const [revokingId, setRevokingId] = useState(null)

  const load = useCallback(async () => {
    try {
      setLinks(await listShareLinks())
      setError(null)
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const now = Date.now()
  const shown = useMemo(
    () => (links ?? []).filter((link) => showAll || shareStatus(link, now) === 'live'),
    [links, showAll, now]
  )

  async function handleRevoke(link) {
    if (!confirm(`Revoke the share link for "${link.title}"? It stops working straight away.`))
      return
    setRevokingId(link.id)
    try {
      await revokeShareLink(link.id)
      await load()
    } catch (err) {
      setError(`Could not revoke: ${err.message}`)
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <AdminSection
      title="Shared work"
      subtitle="Name-hidden share links tutors made with Export work (30 days each)"
    >
      <label style={s.toggle}>
        <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
        Show expired and revoked links too
      </label>
      {!links && !error && <AdminMessage>Loading share links…</AdminMessage>}
      {error && <AdminMessage tone="error">{error}</AdminMessage>}
      {links && shown.length === 0 && (
        <AdminMessage>{showAll ? 'No share links yet.' : 'No live share links.'}</AdminMessage>
      )}
      {shown.length > 0 && (
        <AdminTable headers={['Work', 'Kind', 'Made', 'Status', 'Actions']}>
          {shown.map((link) => {
            const status = shareStatus(link, now)
            const days = shareDaysLeft(link, now)
            return (
              <tr key={link.id}>
                <AdminCell>
                  {status === 'live' ? (
                    <a
                      href={shareUrl(link.id, { base: import.meta.env.BASE_URL })}
                      target="_blank"
                      rel="noreferrer"
                      style={adminUiStyles.linkText}
                    >
                      {link.title}
                    </a>
                  ) : (
                    <span style={adminUiStyles.strongText}>{link.title}</span>
                  )}
                </AdminCell>
                <AdminCell>{getModuleLabel(link.kind) ?? link.kind}</AdminCell>
                <AdminCell>{formatDate(link.createdAt)}</AdminCell>
                <AdminCell>
                  <AdminBadge style={STATUS_BADGE[status]}>{STATUS_LABEL[status]}</AdminBadge>
                  {status === 'live' && days != null && (
                    <span style={s.days}>
                      {days === 0 ? 'last day' : `${days} day${days === 1 ? '' : 's'} left`}
                    </span>
                  )}
                </AdminCell>
                <AdminCell>
                  {status === 'live' && (
                    <button
                      className="btn-danger"
                      style={adminUiStyles.actionBtn}
                      disabled={revokingId === link.id}
                      onClick={() => handleRevoke(link)}
                    >
                      {revokingId === link.id ? '…' : 'Revoke'}
                    </button>
                  )}
                </AdminCell>
              </tr>
            )
          })}
        </AdminTable>
      )}
    </AdminSection>
  )
}

const s = {
  toggle: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'var(--font-body)',
    fontSize: '0.88rem',
  },
  days: { marginLeft: 8, fontSize: '0.8rem', color: '#6b7280' },
}
