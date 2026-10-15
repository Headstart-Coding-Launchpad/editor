// Slow-mo block glow: a CSS class on each running block's SVG group (slowMo.css draws it). Several
// blocks glow at once (one per running script), which Blockly's own single selection can't do.
// Blockly nests a block's next blocks inside its SVG group, so the CSS styles only the group's own
// path. Never throws: a Blockly API change only loses the glow.

export const SLOW_MO_GLOW_CLASS = 'scratch-slowmo-glow'

function svgRootOf(workspace, blockId) {
  try {
    return workspace?.getBlockById?.(blockId)?.getSvgRoot?.() ?? null
  } catch {
    return null
  }
}

/**
 * Makes exactly the listed blocks glow. `glow` is `[{ spriteId, blockId }]`; `workspaces` maps a
 * sprite id to its Blockly workspace. Returns the elements now glowing (pass them back next time
 * as `previous`, so stale glows are removed even when their block has gone).
 */
export function applySlowMoGlow(workspaces, glow, previous = []) {
  const next = []
  for (const { spriteId, blockId } of glow ?? []) {
    const root = svgRootOf(workspaces?.[spriteId], blockId)
    if (root) next.push(root)
  }
  for (const el of previous ?? []) {
    if (!next.includes(el)) el.classList?.remove(SLOW_MO_GLOW_CLASS)
  }
  for (const el of next) {
    if (!el.classList?.contains(SLOW_MO_GLOW_CLASS)) el.classList?.add(SLOW_MO_GLOW_CLASS)
  }
  return next
}

/** Same glow list? (Saves a DOM pass and a re-publish when nothing moved.) */
export function sameSlowMoGlow(a, b) {
  const left = a ?? []
  const right = b ?? []
  if (left.length !== right.length) return false
  return left.every(
    (item, i) => item.spriteId === right[i].spriteId && item.blockId === right[i].blockId
  )
}
