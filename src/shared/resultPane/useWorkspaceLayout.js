import { useCallback } from 'react'
import { useElementSize } from '../useElementSize.js'
import { useKeyboardInset } from './useKeyboardInset.js'
import { chooseWorkspaceLayout } from './resultPane.js'

/**
 * The Python / Turtle workspace's layout ('side' | 'tabs' | 'below', chooseWorkspaceLayout)
 * from the workspace's own measured size, plus the on-screen keyboard's inset for the compact
 * layouts. Attach `ref` to the workspace's outer box and pad an inner box by `inset`.
 */
export function useWorkspaceLayout({ isMobile = false, split = 50, paneCount = 1 } = {}) {
  const [sizeRef, size] = useElementSize()
  const layout = chooseWorkspaceLayout({
    width: size.width,
    height: size.height,
    isMobile,
    split,
    paneCount,
  })
  const [insetRef, inset] = useKeyboardInset({ enabled: layout !== 'side' })
  const ref = useCallback(
    (node) => {
      sizeRef(node)
      insetRef(node)
    },
    [sizeRef, insetRef]
  )
  return { ref, layout, inset }
}
