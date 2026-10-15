// Scratch slow-mo state timeline: one snapshot per step, captured after each block finishes. Pure.
//
// A snapshot keeps the whole stage (every sprite's state, the clones, the backdrop and the
// variables) so a tap on it can redraw the stage at that moment without touching the run. The
// strip shows only the task's `slowMo.timeline` fields, and each snapshot has a text label for
// screen readers.

// Snapshots kept per run; later steps still run, the strip says it stopped recording.
export const SLOW_MO_SNAPSHOT_CAP = 500

function copyJson(value) {
  if (value == null) return value
  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return null
  }
}

function roundCoord(value) {
  const n = Number(value)
  return Number.isFinite(n) ? Math.round(n) : 0
}

function shortValue(value) {
  if (value == null) return '0'
  const text = typeof value === 'number' ? String(Math.round(value * 100) / 100) : String(value)
  return text.length > 24 ? `${text.slice(0, 23)}…` : text
}

/**
 * One snapshot after a block finished.
 * @param {object} input
 * @param {number} input.step the gate's step number for the block
 * @param {string} input.spriteId the sprite (or clone) whose block ran
 * @param {string} [input.baseSpriteId] the workspace's sprite (a clone's parent), for its picture
 * @param {string} [input.spriteName]
 * @param {string} [input.blockId]
 * @param {string} [input.blockText] the block as words, e.g. "switch costume to costume2"
 * @param {object} input.spriteStates every sprite's state, by id
 * @param {object} [input.cloneStates]
 * @param {object} [input.actorState] the running sprite's or clone's own state
 * @param {string|null} [input.backdropName]
 * @param {object} [input.variables]
 */
export function captureSlowMoSnapshot({
  step,
  spriteId,
  baseSpriteId = spriteId,
  spriteName = '',
  blockId = null,
  blockText = '',
  spriteStates = {},
  cloneStates = {},
  actorState = null,
  backdropName = null,
  variables = {},
}) {
  const actor = actorState ?? spriteStates?.[spriteId] ?? null
  return {
    step,
    spriteId,
    baseSpriteId,
    spriteName,
    blockId,
    blockText: String(blockText ?? '').trim(),
    costume: actor?.costume ?? '',
    x: roundCoord(actor?.x),
    y: roundCoord(actor?.y),
    backdropName: backdropName ?? '',
    variables: { ...(variables ?? {}) },
    spriteStates: copyJson(spriteStates) ?? {},
    cloneStates: copyJson(cloneStates) ?? {},
  }
}

/** Adds a snapshot, keeping at most `cap`. Returns `{ snapshots, capped }`. */
export function appendSlowMoSnapshot(snapshots, snapshot, cap = SLOW_MO_SNAPSHOT_CAP) {
  const list = snapshots ?? []
  if (list.length >= cap) return { snapshots: list, capped: true }
  return { snapshots: [...list, snapshot], capped: false }
}

/** The fields of a snapshot the strip shows, in the task's order: `[{ field, label, value }]`. */
export function slowMoSnapshotFields(snapshot, timeline) {
  const rows = []
  for (const field of timeline ?? []) {
    if (field === 'costume') rows.push({ field, label: 'Costume', value: snapshot.costume || '–' })
    else if (field === 'backdrop') {
      rows.push({ field, label: 'Backdrop', value: snapshot.backdropName || '–' })
    } else if (field === 'x') rows.push({ field, label: 'x', value: String(snapshot.x) })
    else if (field === 'y') rows.push({ field, label: 'y', value: String(snapshot.y) })
    else if (field === 'variables') {
      for (const [name, value] of Object.entries(snapshot.variables ?? {})) {
        rows.push({ field, label: name, value: shortValue(value) })
      }
    }
  }
  return rows
}

/** The snapshot as one sentence, for its button's accessible name. */
export function describeSlowMoSnapshot(snapshot, timeline) {
  const who = snapshot.spriteName ? `${snapshot.spriteName}: ` : ''
  const what = snapshot.blockText ? `${who}${snapshot.blockText}` : who.replace(/: $/, '')
  const fields = slowMoSnapshotFields(snapshot, timeline)
    .map(({ label, value }) => `${label} ${value}`)
    .join(', ')
  return [`Step ${snapshot.step}`, what, fields].filter(Boolean).join('. ')
}
