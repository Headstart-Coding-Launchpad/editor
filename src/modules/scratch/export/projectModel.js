// The student's Scratch project as the workspace shows it, from the task and the saved state:
// authored sprites plus student-added ones (`__meta__.addedSprites`, added costumes and sounds),
// backdrops, variables, each sprite's blocks and where each sprite is. Shared by the .sb3, the
// pictures and the share link (see ../exportWork.js). Browser bundle (uses the workspace's own
// helpers), no DOM.
import {
  getScratchTaskSprites,
  keyScratchSpriteStates,
  parseScratchBlocksState,
} from '../jsonWorkspace.js'
import { getStartingBackdrop } from '../startingBackdrop.js'
import { initSpriteStates, mergeAddedSpriteAssets } from '../ScratchWorkspace.jsx'

export const STAGE_STATE_KEY = '__stage__'
export const META_STATE_KEY = '__meta__'

function variableName(entry) {
  return typeof entry === 'string' ? entry : entry?.name
}

/**
 * { sprites, backdrops, variables, blocksBySprite, stageBlocks, spriteStates, backdropName,
 *   cloneStates }. `spriteState` is the live runtime snapshot (currentSpriteState) when the
 * tutor has one; without it every sprite stands where the task puts it.
 */
export function resolveScratchProject(task, rawState, spriteState = null) {
  const parsed = parseSafe(rawState)
  const meta = parsed?.[META_STATE_KEY] ?? null
  let sprites = [...getScratchTaskSprites(task), ...(meta?.addedSprites ?? [])]
  if (meta?.addedCostumes || meta?.addedSounds) {
    sprites = mergeAddedSpriteAssets(sprites, meta.addedCostumes, meta.addedSounds)
  }
  const backdrops = [...(task?.backdrops ?? []), ...(meta?.addedBackdrops ?? [])]
  const states = keyScratchSpriteStates(parsed, getScratchTaskSprites(task))

  const values = meta?.variableValues ?? {}
  const seen = new Set()
  const variables = []
  for (const entry of [...(task?.variables ?? []), ...(meta?.createdVariables ?? [])]) {
    const name = variableName(entry)
    if (!name || seen.has(name)) continue
    seen.add(name)
    variables.push({
      name,
      value: values[name] ?? entry?.value ?? 0,
      showOnStage: entry?.showOnStage === true,
    })
  }

  const defaults = initSpriteStates(sprites)
  const live = spriteState?.spriteStates ?? {}
  const spriteStates = Object.fromEntries(
    sprites.map((sp) => [sp.id, { ...defaults[sp.id], ...(live[sp.id] ?? {}) }])
  )
  const backdropName =
    spriteState?.backdropName ?? getStartingBackdrop(backdrops)?.name ?? backdrops[0]?.name ?? null

  return {
    sprites,
    backdrops,
    variables,
    blocksBySprite: Object.fromEntries(sprites.map((sp) => [sp.id, states[sp.id] ?? null])),
    stageBlocks: states[STAGE_STATE_KEY] ?? null,
    spriteStates,
    cloneStates: spriteState?.cloneStates ?? {},
    backdropName,
  }
}

function parseSafe(raw) {
  try {
    return parseScratchBlocksState(raw)
  } catch {
    return null
  }
}

/** The costumes a sprite exports: its own, or one made from its emoji / built-in shape. */
export function spriteCostumes(sprite) {
  if (sprite?.costumes?.length) return sprite.costumes
  return [{ name: 'costume1', ...(sprite?.emoji ? { emoji: sprite.emoji } : {}) }]
}

/** Whether a Blockly state has any blocks. */
export function hasBlocks(state) {
  return (state?.blocks?.blocks?.length ?? 0) > 0
}
