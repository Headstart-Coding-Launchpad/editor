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
    // The scroller never centres with justify-content (that clips the top of a column taller
    // than the screen); the inner column's auto margins centre it only when there is room.
    <div className="session-ended" data-testid="session-ended" style={s.scroller}>
      <div style={s.column}>
        <h2 style={s.title}>Session ended</h2>
        {/* A small celebration first: what they did today, before any housekeeping. */}
        <section style={s.celebration} aria-label="What you did today">
          <p style={s.celebrationText}>
            <span aria-hidden="true">🎉</span>{' '}
            <span style={s.celebrationTitle}>Great work today!</span>
            {(workedOnCount > 0 || momentCount > 0) && (
              <span>
                {' '}
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
              </span>
            )}
          </p>
        </section>
        {moments.length > 0 && (
          <section style={s.moments} aria-label="Your coding moments">
            <h3 className="lesson-complete__moments-label" style={s.momentsTitle}>
              Your coding moments
            </h3>
            <BadgeStickerSheet variant="strip" small moments={moments} animate />
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
                  savedCodeTaskCount === 1
                    ? 'Python code'
                    : `${savedCodeTaskCount} Python code tasks`
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
        {/* The same two side-by-side buttons as the Lesson complete screen. */}
        <div className="lesson-complete__actions session-ended__actions">
          <button type="button" className="lesson-complete__primary" onClick={onContinueSolo}>
            Go Through the Lesson Again
          </button>
          {soloCompanion && onTrySoloChallenge && (
            <button
              type="button"
              className="lesson-complete__secondary"
              onClick={onTrySoloChallenge}
            >
              Try the Solo Challenge
            </button>
          )}
        </div>
        {onOpenPlayground && (
          <button type="button" className="lesson-complete__again" onClick={onOpenPlayground}>
            Open Playground
          </button>
        )}
      </div>
    </div>
  )
}

const s = {
  scroller: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: '24px 32px',
    overflowY: 'auto',
  },
  column: {
    margin: 'auto',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 14,
    maxWidth: '100%',
    textAlign: 'center',
  },
  title: {
    margin: 0,
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.6rem',
    color: 'var(--colour-primary)',
  },
  celebration: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  celebrationTitle: { fontWeight: 700 },
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
    gap: 8,
    padding: '12px 16px',
    border: '1px solid #fde047',
    borderRadius: 'var(--ui-radius)',
    background: '#fef9c3',
    color: '#854d0e',
    fontFamily: 'var(--font-body)',
    fontSize: '0.9rem',
    lineHeight: 1.5,
  },
  moments: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
  },
  momentsTitle: { color: 'var(--colour-primary)' },
  downloadButton: { alignSelf: 'center', padding: '8px 18px', fontSize: 14 },
}
