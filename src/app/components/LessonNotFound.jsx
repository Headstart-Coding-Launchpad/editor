import React from 'react'
import EntryScreenCard, { centredBody } from './EntryScreenCard'

// A wrong code, or a lesson that failed to load (a network error looks the same, so never
// "doesn't exist"): the join screen's purple card, no spinner, one big way back to the join
// screen (a hash link: the app uses HashRouter). Students, the tutor window and preview.
export default function LessonNotFound() {
  return (
    <EntryScreenCard title="Hmm, no lesson there" pageStyle={s.page} bodyStyle={centredBody}>
      <span style={s.icon} aria-hidden="true">
        {'\u{1F50D}'}
      </span>
      <p style={s.text}>We can&apos;t find that lesson. Check the code and try again.</p>
      <a className="btn-primary" style={s.tryAgain} href="#/">
        Try again
      </a>
    </EntryScreenCard>
  )
}

const s = {
  page: { padding: 16 },
  icon: { fontSize: '2.4rem', lineHeight: 1 },
  text: { maxWidth: 260, fontFamily: 'var(--font-body)', lineHeight: 1.5 },
  // 54px tall: an easy tap on a tablet.
  tryAgain: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: 54,
    fontSize: '1.05rem',
    textDecoration: 'none',
  },
}
