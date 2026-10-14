// Each sprite's scripts as a picture: the blocks loaded into an off-screen, read-only Blockly
// workspace with the app's own block definitions (zelos renderer), exported as a standalone SVG
// (../scriptSvg.js, shared with `hsc scratch render`) and drawn to a PNG.
import { svgToPngBytes } from '../../../shared/exportWork/pictures.js'
import { loadBlocklyModules, setWorkspaceBlocklyContext } from '../scratch.js'
import { loadWorkspace } from '../scratchPersistence.js'
import { resolveSpriteSounds } from '../scratchSounds.js'
import { SCRIPT_RENDER_OPTIONS, workspaceToSvg } from '../scriptSvg.js'
import { hasBlocks } from './projectModel.js'

// Dropdown lists for one sprite's workspace, as ScratchWorkspace gives it (names only: no
// thumbnails, so the picture needs no extra images).
function contextFor(model, sprite) {
  return {
    sprites: model.sprites.map((sp) => ({ id: sp.id, name: sp.name })),
    costumes: (sprite?.costumes ?? []).map((c) => ({ name: c.name, emoji: c.emoji })),
    backdrops: model.backdrops.map((b) => ({ name: b.name })),
    variables: model.variables.map((v) => ({ name: v.name })),
    sounds: sprite ? resolveSpriteSounds(sprite) : [],
  }
}

/**
 * [{ name, svg, png }] for every sprite (and the Stage) with blocks. `label(sprite)` names the
 * file part. Failures are noted and skipped.
 */
export async function renderScriptPictures(model, { notes = [] } = {}) {
  const { Blockly } = await loadBlocklyModules()
  try {
    await document.fonts?.load("600 12px 'Quicksand'")
  } catch {
    // Falls back to the default font.
  }
  const host = document.createElement('div')
  host.className = 'scratch-workspace'
  host.setAttribute('aria-hidden', 'true')
  Object.assign(host.style, {
    position: 'fixed',
    left: '-10000px',
    top: '0',
    width: '2400px',
    height: '2400px',
    pointerEvents: 'none',
  })
  document.body.appendChild(host)

  const jobs = model.sprites.map((sprite) => ({
    label: sprite.name,
    sprite,
    state: model.blocksBySprite[sprite.id],
  }))
  if (hasBlocks(model.stageBlocks))
    jobs.push({ label: 'Stage', sprite: null, state: model.stageBlocks })

  const pictures = []
  try {
    for (const job of jobs) {
      if (!hasBlocks(job.state)) continue
      const div = document.createElement('div')
      Object.assign(div.style, { width: '2400px', height: '2400px' })
      host.appendChild(div)
      const ws = Blockly.inject(div, SCRIPT_RENDER_OPTIONS)
      try {
        const context = contextFor(model, job.sprite)
        setWorkspaceBlocklyContext(ws, () => context)
        loadWorkspace(Blockly, ws, job.state)
        ws.render()
        const warnings = []
        const { svg, width, height } = await workspaceToSvg(ws, { warnings })
        if (width > 0 && height > 0) {
          const png = await svgToPngBytes(svg, width, height, { scale: 2, background: '#ffffff' })
          pictures.push({ label: job.label, svg, png })
        }
      } catch (error) {
        notes.push(`Couldn't draw ${job.label}'s scripts (${error.message}).`)
      } finally {
        ws.dispose()
        div.remove()
      }
    }
  } finally {
    host.remove()
  }
  return pictures
}
