import React from 'react'

export default function SessionEndedScreen({ savedCodeTaskCount = 0, savedOtherTaskCount = 0, onDownloadAllCode, onContinueSolo }) {
  return (
    <div style={s.centreScreen}>
      <h2 style={s.title}>Session ended</h2>
      <p style={{ color: 'var(--colour-text)', fontFamily: 'var(--font-body)', marginBottom: 8 }}>
        Great work today! Your progress has been saved in this browser.
      </p>
      {savedCodeTaskCount > 0 && (
        <div style={s.backupNotice}>
          <strong>Saved only on this device.</strong> Browser data can be cleared or lost when you change device. Download your {savedCodeTaskCount === 1 ? 'Python code' : `${savedCodeTaskCount} Python code tasks`} to keep a copy.
          <button className="btn-primary" style={s.downloadButton} onClick={onDownloadAllCode}>
            Download all my code
          </button>
        </div>
      )}
      {savedOtherTaskCount > 0 && (
        <div style={s.backupNotice}>
          <strong>Saved only on this device.</strong> Work in {savedOtherTaskCount === 1 ? 'one other task is' : `${savedOtherTaskCount} other tasks is`} saved locally too, but isn&apos;t downloadable yet. Browser data can be cleared or lost when you change device.
        </div>
      )}
      <p style={{ color: '#6b7280', fontFamily: 'var(--font-body)', fontSize: '0.9rem', margin: 0 }}>
        Want to keep practising on your own?
      </p>
      <button
        className="btn-primary"
        style={{ padding: '12px 32px', fontSize: 15 }}
        onClick={onContinueSolo}
      >
        Continue Solo
      </button>
    </div>
  )
}

const s = {
  centreScreen: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    gap: 16,
    padding: 32,
    textAlign: 'center',
  },
  title: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.5rem',
    color: 'var(--colour-primary)',
  },
  backupNotice: {
    maxWidth: 500,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: '14px 16px',
    border: '1px solid #fde047',
    borderRadius: 'var(--ui-radius)',
    background: '#fef9c3',
    color: '#854d0e',
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    lineHeight: 1.5,
  },
  downloadButton: { alignSelf: 'center', padding: '10px 20px', fontSize: 14 },
}
