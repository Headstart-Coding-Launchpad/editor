import { LIVE_LAYOUTS } from '../../studentLiveDisplay'

const LAYOUT_LABELS = {
  explainer: { label: 'Explainer', full: 'Students see the explainer only' },
  both: { label: 'Both', full: 'Students see the explainer and the code' },
  code: { label: 'Code', full: 'Students see the code only' },
}

/**
 * Go Live / Stop live for the tutor dashboard's session controls. While the tutor is live
 * (from the dashboard or the presentation pop-up) it shows a "Live" chip; while the dashboard
 * is the publisher it also shows the Explainer / Both / Code control that forces the students'
 * layout. A student's broadcast blocks starting (stop that one first).
 */
export default function TeacherGoLiveControl({
  teacherLive,
  onStart,
  onStop,
  onLayoutChange,
  disabled = false,
}) {
  const active = !!teacherLive?.active
  const studentLive = active && teacherLive.source === 'student'
  const tutorLive = active && teacherLive.source === 'teacher'
  const layout = LIVE_LAYOUTS.includes(teacherLive?.layout) ? teacherLive.layout : 'both'
  const dashboardPublishes = tutorLive && teacherLive.publisher === 'dashboard'

  return (
    <>
      {tutorLive && (
        <span
          className="teacher-go-live__chip"
          style={s.chip}
          role="status"
          title="Students are watching your screen"
        >
          <span aria-hidden="true">🔴</span> Live
        </span>
      )}
      <button
        type="button"
        className={`${tutorLive ? 'btn-danger' : 'btn-primary'} teacher-session-controls__action`}
        onClick={tutorLive ? onStop : onStart}
        disabled={studentLive || (!tutorLive && disabled)}
        title={
          studentLive
            ? "A student's work is live. Stop that first."
            : tutorLive
              ? 'Stop Live: students go back to their own work'
              : 'Go Live: students watch your screen'
        }
      >
        {tutorLive ? '■ Stop live' : '📡 Go Live'}
      </button>
      {dashboardPublishes && (
        <div role="group" aria-label="Layout students see" style={s.group}>
          {LIVE_LAYOUTS.map((key) => (
            <button
              key={key}
              type="button"
              className="btn-ghost teacher-session-controls__action"
              aria-pressed={layout === key}
              title={LAYOUT_LABELS[key].full}
              style={layout === key ? s.pressed : undefined}
              onClick={() => onLayoutChange(key)}
            >
              {LAYOUT_LABELS[key].label}
            </button>
          ))}
        </div>
      )}
    </>
  )
}

const s = {
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 10px',
    borderRadius: 999,
    background: '#fde8e6',
    color: '#b3261e',
    fontWeight: 700,
    fontSize: 13,
  },
  group: { display: 'inline-flex', gap: 2 },
  pressed: { background: 'var(--colour-primary-soft, #e3edff)', fontWeight: 700 },
}
