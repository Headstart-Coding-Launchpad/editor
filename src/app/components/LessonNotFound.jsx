import EntryScreenCard, { centredBody } from './EntryScreenCard'
import { reloadPage } from '../pythonReload'

// No lesson, on the join screen's purple card: no spinner, one big action. Missing: back to the
// join screen. Failed load: say so; Try again reloads (no way back: offline, it can't load). Staff
// pass staffLessonId: the id shows and the way back is the Teacher Dashboard (#/?teacher=true).
export default function LessonNotFound({ loadFailed = false, staffLessonId = null }) {
  const staff = staffLessonId != null
  const back = staff
    ? { href: '#/?teacher=true', label: 'Back to Teacher Dashboard' }
    : { href: '#/', label: 'Try again' }
  return (
    <EntryScreenCard
      title={loadFailed ? "Hmm, that didn't load" : 'Hmm, no lesson there'}
      pageStyle={s.page}
      bodyStyle={centredBody}
    >
      <span style={s.icon} aria-hidden="true">
        {loadFailed ? '\u{1F4E1}' : '\u{1F50D}'}
      </span>
      <p style={s.text}>
        {loadFailed
          ? 'Something went wrong loading the lesson. Check your internet and try again.'
          : "We can't find that lesson. Check the code and try again."}
      </p>
      {loadFailed ? (
        <button type="button" className="btn-primary" style={s.primary} onClick={reloadPage}>
          Try again
        </button>
      ) : (
        <a className="btn-primary" style={s.primary} href={back.href}>
          {back.label}
        </a>
      )}
      {staff && <p style={s.lessonId}>Lesson: {staffLessonId}</p>}
    </EntryScreenCard>
  )
}

const s = {
  page: { padding: 16, minHeight: '100vh', boxSizing: 'border-box' },
  icon: { fontSize: '2.4rem', lineHeight: 1 },
  text: { maxWidth: 260, fontFamily: 'var(--font-body)', lineHeight: 1.5 },
  // 54px tall: an easy tap on a tablet.
  primary: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: 54,
    fontSize: '1.05rem',
    textDecoration: 'none',
  },
  lessonId: { fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--colour-muted)' },
}
