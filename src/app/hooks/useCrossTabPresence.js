import { useEffect, useState } from 'react'

// Detects when the same student has this lesson open in more than one browser
// tab, so LaunchPad can warn them their work may be overwritten (both tabs
// write to the same localStorage key / Firebase path, and the one that saves
// last wins). Informational only — no locking or blocking behaviour.
//
// Each tab announces itself with a "ping" on mount over a BroadcastChannel
// scoped to this lesson+student; a peer tab replies with "pong". Per the
// BroadcastChannel spec, a channel never receives its own postMessage, so no
// self-filtering is needed. This is a presence check, not a live tab count:
// once a peer is detected the flag stays set for the rest of the session,
// even if that peer tab later closes.
export function useCrossTabPresence(lessonId, anonymousId) {
  const [otherTabOpen, setOtherTabOpen] = useState(false)

  useEffect(() => {
    setOtherTabOpen(false)
    if (!lessonId || !anonymousId || typeof BroadcastChannel === 'undefined') return

    const channel = new BroadcastChannel(`headstart_presence_${lessonId}_${anonymousId}`)
    channel.onmessage = event => {
      if (event.data?.type === 'ping') channel.postMessage({ type: 'pong' })
      if (event.data?.type === 'ping' || event.data?.type === 'pong') setOtherTabOpen(true)
    }
    channel.postMessage({ type: 'ping' })

    return () => channel.close()
  }, [lessonId, anonymousId])

  return otherTabOpen
}
