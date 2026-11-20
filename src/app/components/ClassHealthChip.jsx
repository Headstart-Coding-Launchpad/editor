import { useEffect, useRef, useState } from 'react'
import { APP_VERSION, classHealth, formatAgo } from '../../shared/healthBeacon'

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

// The tutor's Class health chip (R1, sketch OK'd 20 Nov 2026), in TeacherSessionControls. Reads
// `students` or `session.students` (src/shared/healthBeacon.js), ages in server time. No writes.
export default function ClassHealthChip(props) {
  const { session, serverTimeOffset, onOpenStudent, onNudgeStudent } = props
  const appVersion = props.appVersion ?? APP_VERSION
  const [open, setOpen] = useState(false)
  const [, setTick] = useState(0)
  const wrapRef = useRef(null)
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), 15_000) // ages and the 10-minute window
    return () => clearInterval(id)
  }, [])
  useEffect(() => {
    if (!open) return
    const out = (e) =>
      e.type === 'keydown' ? e.key === 'Escape' : !wrapRef.current?.contains(e.target)
    const close = (e) => out(e) && setOpen(false)
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => ['mousedown', 'keydown'].forEach((t) => document.removeEventListener(t, close))
  }, [open])
  const students =
    props.students ??
    Object.entries(session?.students ?? {}).map(([id, s]) => ({ ...s, anonymousId: id }))
  if (students.length === 0) return null
  const now = Date.now() + (Number(serverTimeOffset) || 0)
  const h = classHealth(students, { now, appVersion })
  const n = h.rows.length
  const label = n
    ? `Class health: ${plural(n, 'student needs', 'students need')} a look`
    : 'Class health: every screen is fine'
  const fine = `${plural(h.fineCount, 'student', 'students')} fine`
  const versions = h.versionTotal ? ` · ${h.versionMatch} of ${h.versionTotal} match` : ''
  const act = (fn, id) => () => Promise.resolve(fn?.(id)).catch(() => {})
  const btn = 'class-health__btn'
  return (
    <div ref={wrapRef} className="class-health">
      <button
        type="button"
        className={`class-health__chip class-health__chip--${h.level} ${open ? 'class-health__chip--open' : ''}`}
        data-level={h.level}
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
      >
        <i className="class-health__dot" />
        <span className="class-health__label">Class health</span>
        {n > 0 && <b className="class-health__count">{n}</b>}
      </button>
      {open && (
        <div className="class-health__panel" role="dialog" aria-label="Class health">
          <div className="class-health__head">
            <h4>Class health</h4>
            {h.checkedAt != null && <span>checked {formatAgo(now - h.checkedAt)}</span>}
          </div>
          <div className="class-health__summary">
            {n
              ? `${n} of ${plural(h.total, 'student', 'students')} ${n === 1 ? 'needs' : 'need'} a look`
              : `All ${plural(h.total, 'screen is', 'screens are')} fine`}
          </div>
          {h.rows.map((r) => (
            <div key={r.id} className="class-health__row" data-student={r.id}>
              <i className={`class-health__dot class-health__dot--${r.level}`} />
              <div className="class-health__text">
                <b>{r.name}</b>
                <div title={r.message ?? undefined}>{r.headline}</div>
                {r.detail && <em>{r.detail}</em>}
                <div className="class-health__actions">
                  <button
                    className={`${btn} ${btn}--primary`}
                    onClick={() => setOpen(false) || act(onOpenStudent, r.id)()}
                  >
                    {`Open ${r.name}'s screen`}
                  </button>
                  {onNudgeStudent && (
                    <button className={btn} onClick={act(onNudgeStudent, r.id)}>
                      Nudge
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {h.fineCount > 0 && n > 0 && (
            <div className="class-health__row">
              <i className="class-health__dot class-health__dot--ok" />
              <div className="class-health__text">{fine}</div>
            </div>
          )}
          <div className="class-health__foot">
            <span>{`App v${appVersion}${versions}`}</span>
            <span>Errors: first line, quotes and links removed</span>
          </div>
        </div>
      )}
    </div>
  )
}
