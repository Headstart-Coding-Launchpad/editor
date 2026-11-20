import React, { useEffect, useRef, useState } from 'react'
import { classHealth, formatAgo } from '../../shared/healthBeacon'

// How often the chip re-reads the clock (ages and the 10-minute "recent" window).
const TICK_MS = 15_000

/**
 * The tutor's Class health chip (R1, sketch OK'd by Ryan 20 Nov 2026): one pill in the top row,
 * green when every online student's screen is fine, amber when someone has errors, a screen
 * error or a shaky connection, red when someone's Python failed to load or is stuck. The count
 * is the students who need a look. Clicking opens a list of them, red first, each with
 * "Open <name>'s screen" (the usual student modal, which sets activeStudentView) and Nudge.
 * Reads only: it writes nothing itself. Data: students/{id}/healthBeacon and /health
 * (src/shared/healthBeacon.js).
 */
export default function ClassHealthChip({ students, appVersion, onOpenStudent, onNudgeStudent }) {
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const wrapRef = useRef(null)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!open) return
    setNow(Date.now())
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const health = classHealth(students, { now, appVersion })
  const count = health.rows.length
  const headline =
    count === 0
      ? `All ${health.total} ${health.total === 1 ? 'screen is' : 'screens are'} fine`
      : `${count} of ${health.total} ${health.total === 1 ? 'student' : 'students'} ${
          count === 1 ? 'needs' : 'need'
        } a look`
  const title =
    count === 0
      ? 'Class health: every screen is fine'
      : `Class health: ${count} ${count === 1 ? 'student needs' : 'students need'} a look`

  return (
    <div ref={wrapRef} className="class-health">
      <button
        type="button"
        className={`class-health__chip class-health__chip--${health.level}${
          open ? ' class-health__chip--open' : ''
        }`}
        data-level={health.level}
        data-testid="class-health-chip"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={title}
        title={title}
        onClick={() => setOpen((v) => !v)}
      >
        <i className="class-health__dot" aria-hidden="true" />
        <span className="class-health__label">Class health</span>
        {count > 0 && (
          <b className="class-health__count" data-testid="class-health-count">
            {count}
          </b>
        )}
      </button>

      {open && (
        <div className="class-health__panel" role="dialog" aria-label="Class health">
          <div className="class-health__head">
            <h4>Class health</h4>
            {health.checkedAt != null && (
              <span>checked {formatAgo(Math.max(0, now - health.checkedAt))}</span>
            )}
          </div>
          <div className="class-health__summary">{headline}</div>
          {health.rows.map((row) => (
            <div
              key={row.id}
              className="class-health__row"
              data-testid="class-health-row"
              data-student={row.id}
            >
              <i className={`class-health__dot class-health__dot--${row.level}`} aria-hidden />
              <div className="class-health__text">
                <b>{row.name}</b>
                <div title={row.message ?? undefined}>{row.headline}</div>
                {row.detail && <em>{row.detail}</em>}
                <div className="class-health__actions">
                  <button
                    type="button"
                    className="class-health__btn class-health__btn--primary"
                    onClick={() => {
                      setOpen(false)
                      onOpenStudent?.(row.id)
                    }}
                  >
                    {`Open ${row.name}'s screen`}
                  </button>
                  {onNudgeStudent && (
                    <button
                      type="button"
                      className="class-health__btn"
                      onClick={() => {
                        Promise.resolve(onNudgeStudent(row.id)).catch(() => {})
                      }}
                    >
                      Nudge
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {health.fineCount > 0 && count > 0 && (
            <div className="class-health__row">
              <i className="class-health__dot class-health__dot--ok" aria-hidden />
              <div className="class-health__text">
                {health.fineCount} {health.fineCount === 1 ? 'student' : 'students'} fine
              </div>
            </div>
          )}
          <div className="class-health__foot">
            <span>
              {appVersion ? `App v${appVersion}` : 'App version unknown'}
              {health.versionTotal > 0 &&
                ` · ${health.versionMatch} of ${health.versionTotal} match`}
            </span>
            <span>No code or answers sent</span>
          </div>
        </div>
      )}
    </div>
  )
}
