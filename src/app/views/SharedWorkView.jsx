// `/share/:id`: the public, read-only page for a share link a tutor made from "Export work"
// (Firestore `sharedWork/{id}`). No login, no student name, nothing written. The module that
// made the work renders it (its exporter's ShareView; src/shared/exportWork/exporters.js).
// A revoked or expired link reads as gone: the Firestore rules refuse it.
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import LoadingScreen from '../components/LoadingScreen'
import { loadExporter } from '../../shared/exportWork/exporters.js'
import { loadShareLink } from '../../shared/exportWork/shareService.js'

export default function SharedWorkView() {
  const { id } = useParams()
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const share = await loadShareLink(id)
        if (share.status !== 'live') {
          if (!cancelled) setState({ status: 'gone' })
          return
        }
        const exporter = await loadExporter(share.kind)
        if (!cancelled) {
          setState(
            exporter?.ShareView
              ? { status: 'live', share, View: exporter.ShareView }
              : { status: 'gone' }
          )
        }
      } catch {
        if (!cancelled) setState({ status: 'error' })
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (state.status === 'live') document.title = `${state.share.title} · Headstart Coding`
  }, [state])

  if (state.status === 'loading') return <LoadingScreen message="Loading…" />

  if (state.status !== 'live') {
    return (
      <div style={s.page}>
        <div style={s.gone}>
          <h1 style={s.title}>
            {state.status === 'error' ? 'Something went wrong' : 'This link has ended'}
          </h1>
          <p style={s.text}>
            {state.status === 'error'
              ? 'Please try again in a moment.'
              : 'Share links last 30 days, and a tutor can switch one off sooner.'}
          </p>
        </div>
      </div>
    )
  }

  const { share, View } = state
  return (
    <div style={s.page}>
      <header style={s.header}>
        <span style={s.brand}>Headstart Coding</span>
        <h1 style={s.heading}>{share.title}</h1>
        <span style={s.badge}>Read-only</span>
      </header>
      <main style={s.main}>
        <View payload={share.payload} title={share.title} />
      </main>
    </div>
  )
}

const s = {
  page: {
    minHeight: '100%',
    background: 'var(--ui-bg, #f5f5f5)',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    background: 'var(--colour-primary)',
    color: '#fff',
    padding: '10px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  brand: { fontFamily: 'var(--font-title)', fontWeight: 700, fontSize: '0.95rem' },
  heading: {
    margin: 0,
    fontFamily: 'var(--font-title)',
    fontSize: '1.05rem',
    fontWeight: 700,
    flex: '1 1 auto',
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
  badge: {
    fontSize: '0.75rem',
    background: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    padding: '2px 10px',
  },
  main: {
    flex: 1,
    width: '100%',
    maxWidth: 1200,
    margin: '0 auto',
    padding: 16,
    boxSizing: 'border-box',
  },
  gone: {
    margin: 'auto',
    padding: 24,
    maxWidth: 420,
    textAlign: 'center',
    fontFamily: 'var(--font-body)',
  },
  title: { fontFamily: 'var(--font-title)', fontSize: '1.3rem', margin: '0 0 8px' },
  text: { margin: 0, color: 'var(--colour-text-muted, #6b7280)' },
}
