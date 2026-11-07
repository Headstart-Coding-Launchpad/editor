import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// The calm Scratch explainer column (task card + docked hint) renders into ONE DOM node, the
// host, that moves between slots: the side column, or beside the pinned stage when the panel is
// stacked (ScratchWorkspace's `calm.aside`). Moving the node, not remounting the card, keeps a
// folded card folded when a tablet is turned round. A move keeps scroll, focus and selection; a
// card holding an iframe or video is re-rendered in its new slot instead (a moved iframe reloads
// under React's feet). With no slot on screen the host is orphaned, and the caller renders the
// card inline and the hint as the popup, so nothing is ever drawn into a detached node.

function createHost() {
  if (typeof document === 'undefined') return null
  const el = document.createElement('div')
  Object.assign(el.style, {
    flex: '1 1 auto',
    minWidth: '0',
    minHeight: '0',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    overflow: 'hidden',
  })
  return el
}

// What a host had when it left a slot (a detached node loses scroll, focus and selection).
const savedStates = new WeakMap()

function textSelection(el) {
  try {
    if (typeof el.selectionStart !== 'number') return null
    return [el.selectionStart, el.selectionEnd, el.selectionDirection ?? 'none']
  } catch {
    return null
  }
}

function saveHostState(host) {
  const scrolls = []
  for (const el of [host, ...host.querySelectorAll('*')]) {
    if (el.scrollTop || el.scrollLeft) scrolls.push([el, el.scrollTop, el.scrollLeft])
  }
  const active = document.activeElement
  const focused = active && active !== host && host.contains(active) ? active : null
  let range = null
  const selection = window.getSelection?.()
  if (!focused?.matches?.('input, textarea') && selection?.rangeCount) {
    const r = selection.getRangeAt(0)
    if (host.contains(r.commonAncestorContainer)) {
      range = [r.startContainer, r.startOffset, r.endContainer, r.endOffset]
    }
  }
  savedStates.set(host, {
    scrolls,
    focused,
    inputSelection: focused ? textSelection(focused) : null,
    range,
  })
}

function restoreHostState(host) {
  const saved = savedStates.get(host)
  savedStates.delete(host)
  if (!saved) return
  for (const [el, top, left] of saved.scrolls) {
    if (!host.contains(el)) continue
    el.scrollTop = top
    el.scrollLeft = left
  }
  const { focused, inputSelection, range } = saved
  if (focused && host.contains(focused) && host.isConnected) {
    try {
      focused.focus({ preventScroll: true })
      if (inputSelection) focused.setSelectionRange(...inputSelection)
    } catch {}
  }
  if (range && host.contains(range[0]) && host.contains(range[2])) {
    try {
      const r = document.createRange()
      r.setStart(range[0], range[1])
      r.setEnd(range[2], range[3])
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(r)
    } catch {}
  }
}

const hasMedia = (host) => !!host.querySelector('iframe, video')

/**
 * The host for one student view. `wanted`: the column should be on screen. Returns `aside` (hand
 * it to every CalmAsideSlot), `orphaned` (wanted, but no slot holds the host: render the card
 * inline and keep the hint as the popup) and `portal(children)` (the column's content, rendered
 * into the host; null while orphaned).
 */
// eslint-disable-next-line react-refresh/only-export-components -- a hook paired with its slot
export function useCalmAside(wanted) {
  const [host] = useState(createHost)
  const [orphaned, setOrphaned] = useState(false)
  // Bumped to re-render the content in place (a moved card with an iframe or video).
  const [generation, setGeneration] = useState(0)
  const wantedRef = useRef(wanted)
  wantedRef.current = wanted

  // A slot took or let go of the host (also from a child that changes on its own).
  const onMove = useCallback(() => {
    setOrphaned(!!wantedRef.current && !!host && !host.isConnected)
  }, [host])
  const onRemount = useCallback(() => setGeneration((g) => g + 1), [])

  // Slots are children, so by now any slot on screen holds the host. A slot that comes or goes
  // later reports itself (onMove).
  useLayoutEffect(() => {
    const next = !!wanted && !!host && !host.isConnected
    if (next !== orphaned) setOrphaned(next)
  }, [wanted, host, orphaned])

  const aside = useMemo(() => ({ host, onMove, onRemount }), [host, onMove, onRemount])
  const isOrphaned = !!wanted && orphaned
  const portal = (children) =>
    host && children && !isOrphaned
      ? createPortal(children, host, `calm-aside-${generation}`)
      : null
  return { aside, orphaned: isOrphaned, portal }
}

/** Where the calm explainer column shows: takes the host while mounted. */
export function CalmAsideSlot({ aside, style, testId }) {
  const ref = useRef(null)
  const { host, onMove, onRemount } = aside ?? {}
  useLayoutEffect(() => {
    const slot = ref.current
    if (!slot || !host) return undefined
    const moved = savedStates.has(host)
    slot.appendChild(host)
    if (moved && hasMedia(host)) {
      savedStates.delete(host)
      onRemount?.()
    } else {
      restoreHostState(host)
    }
    onMove?.()
    return () => {
      if (host.parentNode !== slot) return
      saveHostState(host)
      slot.removeChild(host)
      onMove?.()
    }
  }, [host, onMove, onRemount])
  return <div ref={ref} data-testid={testId} style={style} />
}
