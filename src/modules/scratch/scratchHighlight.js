// Scratch's part of control highlights (src/shared/controlHighlight.js): when a tutor or a task
// highlights a block category the palette has scrolled away from, scroll the selected sprite's
// palette so the category heading is in view. The ring itself is drawn by the shared hook.
import { useEffect, useRef } from 'react'
import { CONTROL_HIGHLIGHT_REVEAL_EVENT } from '../../shared/controlHighlight.js'

const CATEGORY_PREFIX = 'category:'
// Space left above the heading after scrolling, in pixels.
const SCROLL_MARGIN = 8

/**
 * Scrolls a Blockly workspace's flyout (the always-open palette) so the label `name` is in view.
 * Returns true when the label is (now) in view, false when there is no such label or no
 * visible flyout. Never throws: a Blockly API change only loses the scroll.
 */
export function scrollFlyoutToCategory(workspace, name) {
  try {
    const flyout = workspace?.getFlyout?.()
    if (!flyout || (flyout.isVisible && !flyout.isVisible())) return false
    const flyoutWorkspace = flyout.getWorkspace()
    const wanted = String(name).trim().toLowerCase()
    const label = (flyout.getContents?.() ?? [])
      .map((item) => item?.getElement?.() ?? item)
      .find(
        (element) =>
          element?.isLabel?.() && element.getButtonText?.().trim().toLowerCase() === wanted
      )
    if (!label) return false
    const metrics = flyoutWorkspace.getMetricsManager()
    const scroll = metrics.getScrollMetrics()
    const view = metrics.getViewMetrics()
    const y = label.getPosition().y * flyoutWorkspace.scale
    const inView = y >= view.top && y + 24 <= view.top + view.height
    if (inView) return true
    flyoutWorkspace.scrollbar?.setY(Math.max(0, y - scroll.top - SCROLL_MARGIN))
    return true
  } catch {
    return false
  }
}

// Listens for the shared hook's reveal event and scrolls the selected sprite's palette.
export function useScratchCategoryReveal(workspaceRefs, selectedSpriteId) {
  const spriteRef = useRef(selectedSpriteId)
  spriteRef.current = selectedSpriteId
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    function handleReveal(event) {
      const target = event?.detail?.target
      if (typeof target !== 'string' || !target.startsWith(CATEGORY_PREFIX)) return
      const workspace = workspaceRefs.current?.[spriteRef.current]
      scrollFlyoutToCategory(workspace, target.slice(CATEGORY_PREFIX.length))
    }
    window.addEventListener(CONTROL_HIGHLIGHT_REVEAL_EVENT, handleReveal)
    return () => window.removeEventListener(CONTROL_HIGHLIGHT_REVEAL_EVENT, handleReveal)
  }, [workspaceRefs])
}
