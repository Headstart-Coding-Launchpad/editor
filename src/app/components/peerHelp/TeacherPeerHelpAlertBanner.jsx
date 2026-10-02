import React from 'react'
import { notOkAlerts } from '../../../shared/peerHelp'

function nameOf(session, id) {
  return id ? (session?.students?.[id]?.displayName ?? 'A student who left') : 'a classmate'
}

/**
 * A stuck student pressed "🚩 Not OK" on peer help. Shown across the top of the teacher's view
 * until acknowledged, so it is never buried in a menu.
 */
export default function TeacherPeerHelpAlertBanner({ session, peerHelp }) {
  const alerts = notOkAlerts(peerHelp?.allPeerHelp)
  if (alerts.length === 0) return null
  return (
    <div style={s.wrap} role="alert" data-testid="peer-help-not-ok">
      {alerts.map((alert) => (
        <div key={alert.requestId} style={s.row}>
          <span>
            🚩 <strong>{nameOf(session, alert.stuckId)}</strong> said help from{' '}
            <strong>{alert.helperId ? nameOf(session, alert.helperId) : 'a classmate'}</strong> was
            not OK. Peer help between them has ended.
          </span>
          <span style={s.actions}>
            {alert.helperId && !session?.peerHelperOff?.[alert.helperId] && (
              <button
                type="button"
                className="btn-danger"
                style={s.btn}
                onClick={() => peerHelp.setHelperOff(alert.helperId, true)}
              >
                Stop them helping today
              </button>
            )}
            <button
              type="button"
              className="btn-ghost-outline"
              style={s.btn}
              onClick={() => peerHelp.acknowledgeNotOk(alert.requestId)}
            >
              Seen
            </button>
          </span>
        </div>
      ))}
    </div>
  )
}

const s = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: '6px 12px',
    background: 'var(--colour-error-bg)',
    color: 'var(--colour-error-text)',
    borderBottom: '2px solid var(--colour-error-edge)',
    fontSize: 13,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  actions: { display: 'flex', gap: 6 },
  btn: { fontSize: 12, padding: '3px 10px' },
}
