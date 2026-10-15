import { useCallback, useEffect, useRef, useState } from 'react'

// The on-screen keyboard counts as open when the visual viewport is this much shorter than the
// window (a pinch-zoom or a browser toolbar changes it far less).
const KEYBOARD_MIN_HEIGHT = 120
// Never pad away more than this share of the element: the editor and tabs need some room.
const MAX_INSET_SHARE = 0.7

/**
 * How many pixels of an element's bottom the on-screen keyboard covers (0 when it is closed or
 * the browser already shrinks the page for it). iPadOS Safari and Chrome on Android (since 108)
 * keep the layout viewport full height and lay the keyboard over the page, so a workspace that
 * fills the screen would hide its lower half — in portrait, the result pane under the editor,
 * where a predicting student's name tags are. The workspace pads its bottom by this inset so
 * the editor and the tags both fit in what is still visible (window.visualViewport).
 *
 * Returns [ref, inset]: attach `ref` to the element (an outer box that is not itself padded,
 * so its size doesn't change with the inset).
 */
export function useKeyboardInset({ enabled = true } = {}) {
  const [inset, setInset] = useState(0)
  const nodeRef = useRef(null)

  const update = useCallback(() => {
    const viewport = typeof window !== 'undefined' ? window.visualViewport : null
    const node = nodeRef.current
    if (!enabled || !viewport || !node) {
      setInset(0)
      return
    }
    const keyboardOpen = window.innerHeight - viewport.height > KEYBOARD_MIN_HEIGHT
    if (!keyboardOpen) {
      setInset(0)
      return
    }
    const rect = node.getBoundingClientRect()
    const visibleBottom = viewport.offsetTop + viewport.height
    const covered = Math.round(rect.bottom - visibleBottom)
    const next = Math.max(0, Math.min(covered, Math.round(rect.height * MAX_INSET_SHARE)))
    setInset((prev) => (prev === next ? prev : next))
  }, [enabled])

  const ref = useCallback(
    (node) => {
      nodeRef.current = node
      if (node) update()
    },
    [update]
  )

  useEffect(() => {
    const viewport = typeof window !== 'undefined' ? window.visualViewport : null
    if (!enabled || !viewport) {
      setInset(0)
      return undefined
    }
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    update()
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [enabled, update])

  return [ref, inset]
}
