import React from 'react'
import { useIsMobile } from '../../shared/useIsMobile'

// isSolo: true = solo, false = live teacher session, undefined = don't show badge (teacher view)
export default function TopBar({ lessonTitle, lessonLevel, displayName, isSandbox, isSolo, right }) {
  const isMobile = useIsMobile()

  const statusDot = isSolo === true
    ? <span style={{ ...s.statusDot, background: '#6b7280' }} title="Solo mode" />
    : isSolo === false
      ? <span style={{ ...s.statusDot, background: '#22c55e' }} title="Live session" />
      : null

  return (
    <header style={s.bar}>
      <div style={s.left}>
        {!isMobile && (
          <span style={s.logo}>
            <svg width="20" height="20" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ flexShrink: 0 }}>
              <g transform="translate(256 256) rotate(45) scale(1.14) translate(-256 -256)" fill="#ffffff">
                <path d="M256 38C306 82 333 143 325 202C320 239 304 272 283 301L272 355C270 367 262 378 256 378C250 378 242 367 240 355L229 301C208 272 192 239 187 202C179 143 206 82 256 38ZM256 125C236 125 220 141 220 161C220 181 236 197 256 197C276 197 292 181 292 161C292 141 276 125 256 125Z" fillRule="evenodd"/>
                <path d="M223 300L169 347C160 355 157 367 160 378L174 426L236 354L223 300Z"/>
                <path d="M289 300L343 347C352 355 355 367 352 378L338 426L276 354L289 300Z"/>
                <path d="M232 388C237 415 245 441 256 466C267 441 275 415 280 388H232Z"/>
              </g>
            </svg>
            Headstart Coding - LaunchPad
          </span>
        )}
        {!isMobile && <span style={s.divider}>·</span>}
        {lessonLevel && <span style={s.level}>{lessonLevel}</span>}
        <span style={{ ...s.title, fontSize: isMobile ? '0.8rem' : '0.95rem' }}>{lessonTitle}</span>
        {isSandbox && <span style={s.sandboxBadge}>SANDBOX</span>}
        {!isSandbox && (isMobile ? statusDot : (
          <>
            {isSolo === true  && <span style={{ ...s.modeBadge, background: '#6b7280' }}>SOLO</span>}
            {isSolo === false && <span style={{ ...s.modeBadge, background: '#22c55e' }}>LIVE</span>}
          </>
        ))}
      </div>
      <div style={s.rightSlot}>
        {right}
        {displayName && !isSolo && (
          <span style={{ ...s.name, fontSize: isMobile ? '0.75rem' : '0.9rem' }}>{displayName}</span>
        )}
      </div>
    </header>
  )
}

const s = {
  bar: {
    background: 'var(--colour-primary)',
    color: 'var(--colour-text-on-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'nowrap',
    padding: '0 16px',
    height: 52,
    flexShrink: 0,
    gap: 8,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    overflow: 'hidden',
    flex: '1 1 auto',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '1rem',
    whiteSpace: 'nowrap',
    color: '#ffffff',
    flexShrink: 0,
  },
  level: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.75rem',
    whiteSpace: 'nowrap',
    background: 'rgba(255,255,255,0.15)',
    color: '#ffffff',
    padding: '2px 8px',
    borderRadius: 4,
    flexShrink: 0,
  },
  divider: {
    opacity: 0.4,
    flexShrink: 0,
  },
  title: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.95rem',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minWidth: 0,
  },
  sandboxBadge: {
    background: 'var(--colour-secondary)',
    color: 'var(--colour-text-on-secondary)',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.7rem',
    padding: '2px 8px',
    borderRadius: 4,
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  modeBadge: {
    color: '#fff',
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.7rem',
    padding: '2px 8px',
    borderRadius: 4,
    letterSpacing: '0.05em',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  rightSlot: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'nowrap',
    gap: 8,
    minWidth: 0,
    flex: '0 1 auto',
  },
  name: {
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.9rem',
    opacity: 0.9,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
  },
}
