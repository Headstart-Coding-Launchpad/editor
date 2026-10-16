import React from 'react'
import BadgeStickerSheet from './badges/BadgeStickerSheet'

export default function SessionEndedScreen({
  savedCodeTaskCount = 0,
  savedOtherTaskCount = 0,
  onDownloadAllCode,
  onContinueSolo,
  soloCompanion,
  onTrySoloChallenge,
  onOpenPlayground,
  moments = [],
}) {
  const workedOnCount = savedCodeTaskCount + savedOtherTaskCount
  const momentCount = moments.length
  return (
    <div style={s.centreScreen}>
      <h2 style={s.title}>Session ended</h2>
      {/* A small celebration first: what they did today, before any housekeeping. */}
      <section style={s.celebration} aria-label="What you did today">
        <span style={s.celebrationIcon} aria-hidden="true">
          🎉
        </span>
        <p style={s.celebrationTitle}>Great work today!</p>
        {(workedOnCount > 0 || momentCount > 0) && (
          <p style={s.celebrationText}>
            {workedOnCount > 0 && (
              <>
                You worked on <strong>{workedOnCount}</strong>{' '}
                {workedOnCount === 1 ? 'task' : 'tasks'}
              </>
            )}
            {workedOnCount > 0 && momentCount > 0 && ' and earned '}
            {workedOnCount === 0 && momentCount > 0 && 'You earned '}
            {momentCount > 0 && (
              <>
                <strong>{momentCount}</strong> coding {momentCount === 1 ? 'moment' : 'moments'}
              </>
            )}
            .
          </p>
        )}
      </section>
      {moments.length > 0 && (
        <section style={s.moments} aria-label="Your coding moments">
          <h3 style={s.momentsTitle}>
            <span aria-hidden="true">🎖️</span> Your coding moments
          </h3>
          <BadgeStickerSheet moments={moments} animate />
        </section>
      )}
      {workedOnCount > 0 && (
        // One notice for all saved work (there used to be two near-identical yellow boxes).
        <div style={s.backupNotice}>
          <strong>Saved only on this device.</strong>
          <span>
            Your work is kept in this browser, which can be cleared, or lost if you change device.
            {savedCodeTaskCount > 0 &&
              ` Download your ${
                savedCodeTaskCount === 1 ? 'Python code' : `${savedCodeTaskCount} Python code tasks`
              } to keep a copy.`}
            {savedOtherTaskCount > 0 &&
              (savedCodeTaskCount > 0
                ? ` Your work in ${
                    savedOtherTaskCount === 1
                      ? 'one other task'
                      : `${savedOtherTaskCount} other tasks`
                  } can't be downloaded yet.`
                : ` It can't be downloaded yet.`)}
          </span>
          {savedCodeTaskCount > 0 && (
            <button className="btn-primary" style={s.downloadButton} onClick={onDownloadAllCode}>
              Download all my code
            </button>
          )}
        </div>
      )}
      <p
        style={{
          color: 'var(--colour-muted)',
          fontFamily: 'var(--font-body)',
          fontSize: '0.95rem',
          margin: 0,
        }}
      >
        What would you like to do next?
      </p>
      <button
        className="btn-primary"
        style={{ padding: '12px 32px', fontSize: 15 }}
        onClick={onContinueSolo}
      >
        Go Through the Lesson Again
      </button>
      {soloCompanion && onTrySoloChallenge && (
        <button
          className="btn-ghost-outline"
          style={s.secondaryButton}
          onClick={onTrySoloChallenge}
        >
          Try the Solo Challenge
        </button>
      )}
      {onOpenPlayground && (
        <button className="btn-ghost-outline" style={s.secondaryButton} onClick={onOpenPlayground}>
          Open Playground
        </button>
      )}
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
    overflowY: 'auto',
  },
  title: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.5rem',
    color: 'var(--colour-primary)',
  },
  celebration: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  celebrationIcon: { fontSize: '2.6rem', lineHeight: 1 },
  celebrationTitle: {
    margin: 0,
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.2rem',
    color: 'var(--colour-text)',
  },
  celebrationText: {
    margin: 0,
    fontFamily: 'var(--font-body)',
    fontSize: '1rem',
    color: 'var(--colour-text)',
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
  moments: {
    width: 'min(560px, 100%)',
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  momentsTitle: {
    margin: 0,
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1rem',
    color: 'var(--colour-primary)',
  },
  downloadButton: { alignSelf: 'center', padding: '10px 20px', fontSize: 14 },
  secondaryButton: { padding: '12px 32px', fontSize: 15 },
}
