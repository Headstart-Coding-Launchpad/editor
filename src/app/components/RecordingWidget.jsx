import React, { useEffect, useRef, useState } from 'react'
import { extractYouTubeId } from '../../shared/youtube'

// Loaded once per page and cached, since YouTube's IFrame API script defines a single
// global callback (window.onYouTubeIframeAPIReady) that every player instance shares.
let youTubeApiPromise = null
function loadYouTubeIframeApi() {
  if (typeof window === 'undefined') return Promise.resolve(null)
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (youTubeApiPromise) return youTubeApiPromise
  youTubeApiPromise = new Promise((resolve) => {
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previous === 'function') previous()
      resolve(window.YT)
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    document.head.appendChild(script)
  })
  return youTubeApiPromise
}

// Small fixed-corner pop-out for a class's recorded session (solo mode only — see
// lesson-schema.md `recordingUrl`). Hiding pauses playback via the IFrame Player API;
// the player itself stays mounted (just CSS-hidden), so reopening resumes in place
// without needing to track/restore a timestamp by hand.
const PANEL_WIDTH = 320
const EXPANDED_PANEL_WIDTH = '50vw'

export default function RecordingWidget({ recordingUrl }) {
  const videoId = extractYouTubeId(recordingUrl)
  const [visible, setVisible] = useState(true)
  const [expanded, setExpanded] = useState(false)
  const hostRef = useRef(null)
  const playerRef = useRef(null)

  useEffect(() => {
    if (!videoId) return undefined
    let cancelled = false
    loadYouTubeIframeApi().then((YT) => {
      if (cancelled || !YT || !hostRef.current) return
      playerRef.current = new YT.Player(hostRef.current, {
        videoId,
        width: '100%',
        height: '100%',
        host: 'https://www.youtube-nocookie.com',
        playerVars: { rel: 0, modestbranding: 1, enablejsapi: 1 },
      })
    })
    return () => {
      cancelled = true
      try {
        playerRef.current?.destroy?.()
      } catch {
        /* player never finished loading */
      }
      playerRef.current = null
    }
  }, [videoId])

  if (!videoId) return null

  function hide() {
    try {
      playerRef.current?.pauseVideo?.()
    } catch {
      /* player not ready yet */
    }
    setVisible(false)
  }

  function show() {
    setVisible(true)
    try {
      playerRef.current?.playVideo?.()
    } catch {
      /* player not ready yet */
    }
  }

  return (
    <>
      <div
        style={{
          ...s.panel,
          display: visible ? 'flex' : 'none',
          width: expanded ? EXPANDED_PANEL_WIDTH : PANEL_WIDTH,
        }}
      >
        <div style={s.header}>
          <span style={s.title}>Class recording</span>
          <div style={s.headerActions}>
            <button
              type="button"
              style={s.iconBtn}
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? 'Make video smaller' : 'Make video bigger'}
            >
              {expanded ? '⤡' : '⤢'}
            </button>
            <button type="button" style={s.iconBtn} onClick={hide} aria-label="Hide recording">
              &ndash;
            </button>
          </div>
        </div>
        <div style={s.playerWrap}>
          <div ref={hostRef} style={s.playerHost} />
        </div>
      </div>
      {!visible && (
        <button type="button" style={s.reopenTab} onClick={show}>
          ▶ Watch recording
        </button>
      )}
    </>
  )
}

const s = {
  panel: {
    position: 'fixed',
    right: 16,
    bottom: 16,
    zIndex: 1100,
    flexDirection: 'column',
    minWidth: PANEL_WIDTH,
    maxWidth: '92vw',
    background: 'var(--ui-surface)',
    borderRadius: 10,
    boxShadow: '0 12px 36px rgba(0,0,0,0.25)',
    overflow: 'hidden',
    fontFamily: 'var(--font-body)',
    transition: 'width 0.15s ease',
  },
  header: {
    background: 'var(--colour-primary)',
    color: '#fff',
    padding: '8px 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontFamily: 'var(--font-title)',
    fontWeight: 700,
    fontSize: '0.85rem',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    width: 22,
    height: 22,
    padding: 0,
    border: 'none',
    borderRadius: 4,
    background: 'rgba(255,255,255,0.2)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 700,
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  // YT.Player() replaces the target element with a bare <iframe> (defaulting to a
  // fixed 640x390 box), so the aspect-ratio box has to live on this wrapper — which
  // stays in the DOM — rather than on playerHost, which gets swapped out on mount.
  playerWrap: {
    width: '100%',
    aspectRatio: '16 / 9',
    background: '#000',
  },
  playerHost: {
    width: '100%',
    height: '100%',
  },
  reopenTab: {
    position: 'fixed',
    right: 16,
    bottom: 16,
    zIndex: 1100,
    background: 'var(--colour-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 999,
    padding: '10px 16px',
    fontFamily: 'var(--font-body)',
    fontWeight: 600,
    fontSize: '0.85rem',
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
  },
}
