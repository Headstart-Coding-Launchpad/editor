// The lesson-level Scratch sandbox: `sandboxStarter` (the starting blocks, keyed by sprite id)
// and the optional `sandboxSprites`, `sandboxToolbox` and `sandboxBackdrops` the Builder's
// sandbox editor sets. Pure and Node-safe (the definition's lifecycle hooks use it too).

// The Builder stores `sandboxStarter` as a JSON string; a hand-written lesson may give the
// state object itself. Either works; anything unreadable is null.
export function parseScratchSandboxStarter(value) {
  if (value == null || value === '') return null
  if (typeof value === 'object') return Array.isArray(value) ? null : value
  if (typeof value !== 'string') return null
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

// The sprites, toolbox and backdrops a student's personal sandbox starts with, shaped like a
// task for ScratchWorkspace (no checks, no permissions: those stay off in the sandbox). Null
// when the lesson sets none of them, so the sandbox keeps the default sprite and full toolbox.
export function scratchSandboxTask(lesson) {
  const sprites = Array.isArray(lesson?.sandboxSprites) ? lesson.sandboxSprites : []
  const backdrops = Array.isArray(lesson?.sandboxBackdrops) ? lesson.sandboxBackdrops : []
  const toolbox =
    typeof lesson?.sandboxToolbox === 'string' && lesson.sandboxToolbox.trim()
      ? lesson.sandboxToolbox
      : null
  if (sprites.length === 0 && backdrops.length === 0 && !toolbox) return null
  return {
    id: 'scratch-sandbox',
    ...(sprites.length > 0 ? { sprites } : {}),
    ...(backdrops.length > 0 ? { backdrops } : {}),
    ...(toolbox ? { toolbox } : {}),
  }
}
