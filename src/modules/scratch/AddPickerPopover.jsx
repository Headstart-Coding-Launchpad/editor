import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { computePickerPosition } from './pickerPosition.js'

// The student "Add sprite"/"Add backdrop" library list. Portalled to document.body because the
// Add tile sits inside panes that clip overflow, and positioned from the tile (`anchorRef`) so
// it stays inside the viewport and scrolls to its last item (see pickerPosition.js). Closes on
// a pointerdown outside both the panel and the anchor, and on Escape; follows the tile on
// scroll and resize.
export default function AddPickerPopover({
  anchorRef,
  onClose,
  ariaLabel,
  style,
  width = 220,
  preferredHeight = 320,
  children,
}) {
  const panelRef = useRef(null)
  const [position, setPosition] = useState(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const reposition = useCallback(() => {
    const anchor = anchorRef.current
    if (!anchor || typeof window === 'undefined') return
    const rect = anchor.getBoundingClientRect()
    setPosition(
      computePickerPosition(
        rect,
        { width: window.innerWidth, height: window.innerHeight },
        { width, preferredHeight }
      )
    )
  }, [anchorRef, width, preferredHeight])

  useLayoutEffect(() => {
    reposition()
  }, [reposition])

  useEffect(() => {
    let frame = null
    const schedule = (event) => {
      // Scrolling inside the list itself doesn't move the tile.
      if (event?.target && panelRef.current?.contains(event.target)) return
      if (frame != null) return
      frame = requestAnimationFrame(() => {
        frame = null
        reposition()
      })
    }
    function onPointerDown(e) {
      if (panelRef.current?.contains(e.target)) return
      if (anchorRef.current?.contains(e.target)) return
      onCloseRef.current?.()
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') onCloseRef.current?.()
    }
    window.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('resize', schedule)
    document.addEventListener('scroll', schedule, true)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      if (frame != null) cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      window.visualViewport?.removeEventListener('resize', schedule)
      document.removeEventListener('scroll', schedule, true)
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [anchorRef, reposition])

  if (typeof document === 'undefined') return null
  const placed = position
    ? {
        top: position.top,
        bottom: position.bottom,
        left: position.left,
        width: position.width,
        maxHeight: position.maxHeight,
      }
    : { top: 0, left: 0 }
  return createPortal(
    <div
      ref={panelRef}
      role="listbox"
      aria-label={ariaLabel}
      data-placement={position?.placement}
      style={{
        ...style,
        position: 'fixed',
        ...placed,
        visibility: position ? 'visible' : 'hidden',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
        boxSizing: 'border-box',
        zIndex: 1300,
      }}
    >
      {children}
    </div>,
    document.body
  )
}
