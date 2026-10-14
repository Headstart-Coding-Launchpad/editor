import { useEffect, useRef } from 'react'
import { SLOW_MO_SNAPSHOT_CAP, describeSlowMoSnapshot, slowMoSnapshotFields } from './timeline.js'
import './slowMo.css'

/**
 * The state timeline under the stage: one card per slow-mo step (the task's `slowMo.timeline`
 * fields). It scrolls sideways (a swipe on a tablet) and follows the newest step. Tapping a card
 * shows the stage at that moment (`onSelect(index)`); the run itself is untouched, and "Back to
 * now" returns. `renderCostume(snapshot)` draws the costume thumbnail.
 */
export default function SlowMoTimeline({
  snapshots,
  timeline,
  capped = false,
  selectedIndex = null,
  onSelect,
  onBackToNow,
  renderCostume,
}) {
  const stripRef = useRef(null)
  const count = snapshots?.length ?? 0

  // Follow the newest step unless the student is looking back at one.
  useEffect(() => {
    if (selectedIndex != null) return
    const strip = stripRef.current
    if (strip) strip.scrollLeft = strip.scrollWidth
  }, [count, selectedIndex])

  if (!timeline?.length) return null
  const showCostume = timeline.includes('costume')

  return (
    <section className="slowmo-timeline" aria-label="Slow-mo timeline">
      <div className="slowmo-timeline-head">
        <h3 className="slowmo-timeline-title">Timeline</h3>
        {selectedIndex != null && (
          <button type="button" className="slowmo-now-btn" onClick={onBackToNow}>
            <span aria-hidden="true">⏭️ </span>Back to now
          </button>
        )}
      </div>
      {count === 0 ? (
        <p className="slowmo-timeline-empty">Each step you watch appears here.</p>
      ) : (
        <ol className="slowmo-timeline-strip" ref={stripRef}>
          {snapshots.map((snapshot, index) => {
            const fields = slowMoSnapshotFields(snapshot, timeline).filter(
              (row) => row.field !== 'costume'
            )
            const selected = index === selectedIndex
            return (
              <li key={`${snapshot.step}-${index}`} className="slowmo-snap-item">
                <button
                  type="button"
                  className={`slowmo-snap${selected ? ' slowmo-snap--selected' : ''}`}
                  aria-pressed={selected}
                  aria-label={describeSlowMoSnapshot(snapshot, timeline)}
                  onClick={() => onSelect?.(selected ? null : index)}
                >
                  <span className="slowmo-snap-step">Step {snapshot.step}</span>
                  {showCostume && (
                    <span className="slowmo-snap-costume">
                      {renderCostume?.(snapshot)}
                      <span className="slowmo-snap-costume-name">{snapshot.costume || '–'}</span>
                    </span>
                  )}
                  {fields.map((row, i) => (
                    <span key={`${row.field}-${row.label}-${i}`} className="slowmo-snap-field">
                      <span className="slowmo-snap-label">{row.label}</span> {row.value}
                    </span>
                  ))}
                </button>
              </li>
            )
          })}
        </ol>
      )}
      {capped && (
        <p className="slowmo-timeline-note">
          The timeline keeps the first {SLOW_MO_SNAPSHOT_CAP} steps. Press Restart to start a new
          one.
        </p>
      )}
    </section>
  )
}

/** The banner over the stage while it shows an earlier step. */
export function SlowMoPreviewBanner({ snapshot, onBackToNow }) {
  if (!snapshot) return null
  return (
    <div className="slowmo-preview-banner" role="status">
      <span>Looking back at step {snapshot.step}</span>
      <button type="button" className="slowmo-now-btn" onClick={onBackToNow}>
        Back to now
      </button>
    </div>
  )
}
