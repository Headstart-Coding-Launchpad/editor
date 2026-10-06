import { useCallback, useRef, useState } from 'react'

// Tracks an element's content-box size via ResizeObserver. Unlike `useIsMobile`
// (viewport width only, see useIsMobile.js), this measures the element itself —
// needed for layout decisions inside a split pane or modal, whose width has no
// fixed relationship to the browser viewport.
//
// Uses a callback ref rather than `useRef` + a mount-only `useEffect`: a parent can
// swap in a brand-new DOM node at this ref's position without the *owning* component
// remounting — TaskSlideTransition.jsx does exactly this on every task navigation,
// keying its child wrapper by `transitionKey` — and a plain `useEffect(..., [])` would
// only ever have observed the very first node, silently going stale (frozen at
// whatever size that first node last had) on every task change after that. A callback
// ref is invoked by React whenever the underlying DOM node itself changes, so it
// re-subscribes correctly every time.
export function useElementSize() {
  const [size, setSize] = useState({ width: 0, height: 0 })
  const observerRef = useRef(null)
  const nodeRef = useRef(null)

  const ref = useCallback((node) => {
    if (!node) {
      // React 18 passes null without saying which node detached. During a task change
      // TaskSlideTransition's leaving panel re-renders the previous task's tree, so a
      // second node shares this ref; its unmount must not stop observing the entering
      // node. Only disconnect once the observed node has really left the document
      // (checked after the commit finishes removing nodes).
      queueMicrotask(() => {
        if (nodeRef.current && !nodeRef.current.isConnected) {
          observerRef.current?.disconnect()
          observerRef.current = null
          nodeRef.current = null
        }
      })
      return
    }
    // The most recently attached node wins: the entering panel renders after the leaving one.
    observerRef.current?.disconnect()
    const obs = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize((prev) => (prev.width === width && prev.height === height ? prev : { width, height }))
    })
    obs.observe(node)
    observerRef.current = obs
    nodeRef.current = node
  }, [])

  return [ref, size]
}
