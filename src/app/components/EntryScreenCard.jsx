import React from 'react'

// The chrome every pre-lesson screen shares: a centred card with the purple Headstart
// header, the wordmark, the lesson title and an optional description, above a white body.
// ChoiceScreen, NameEntry, WaitingRoom and JoinSessionPrompt each carried their own copy
// of these styles, so the four drifted apart in card width, corner radius and shadow
// while claiming to be the same thing.
//
// The variation that is real is kept as props:
//   overlay    — render over the lesson (JoinSessionPrompt) rather than as a full page
//   pageStyle  — ChoiceScreen's scrollable, padded page
//   cardStyle  — per-screen width/radius/shadow
//   titleStyle — NameEntry's larger title
//   bodyStyle  — centred vs left-aligned body
//   cardClassName — ChoiceScreen alone never carried the global .card class, so it
//     has no 1px border; kept as-is rather than restyled during a refactor
export default function EntryScreenCard({
  title,
  description,
  overlay = false,
  pageStyle,
  cardStyle,
  titleStyle,
  bodyStyle,
  cardClassName = 'card',
  children,
}) {
  return (
    <div style={overlay ? s.overlay : { ...s.page, ...pageStyle }}>
      <div style={{ ...s.card, ...cardStyle }} className={cardClassName}>
        <div style={s.header}>
          <span style={s.logo}>Headstart Coding - LaunchPad</span>
          <h1 style={{ ...s.title, ...titleStyle }}>{title}</h1>
          {description && <p style={s.description}>{description}</p>}
        </div>
        <div style={{ ...s.body, ...bodyStyle }}>{children}</div>
      </div>
    </div>
  )
}

const s = {
  page: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    background: 'linear-gradient(135deg, #d3c0f9 0%, #b89df5 100%)',
  },
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  card: {
    width: 400,
    maxWidth: '100%',
    overflow: 'hidden',
    borderRadius: 18,
    boxShadow: '0 8px 30px rgba(98, 34, 204, 0.18), 0 4px 10px rgba(0, 0, 0, 0.06)',
  },
  header: {
    background: 'var(--colour-primary)',
    padding: '24px 28px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  logo: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.85rem',
    color: 'var(--colour-secondary)',
  },
  title: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1.4rem',
    color: '#fff',
    margin: 0,
  },
  description: {
    fontFamily: 'var(--font-body)',
    fontSize: '0.95rem',
    lineHeight: 1.5,
    color: 'rgba(255, 255, 255, 0.86)',
    marginTop: 2,
  },
  body: {
    padding: '24px 28px 28px',
    background: '#fff',
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
}

// Body layout shared by the screens that centre their content.
export const centredBody = {
  padding: '28px',
  gap: 12,
  alignItems: 'center',
  textAlign: 'center',
}

// The quiet "no thanks" link under a primary action (NameEntry's solo link,
// JoinSessionPrompt's decline link).
export const ghostLink = {
  background: 'none',
  border: 'none',
  fontFamily: 'var(--font-body)',
  fontSize: '0.85rem',
  color: '#9ca3af',
  cursor: 'pointer',
  textDecoration: 'underline',
  padding: 0,
}
