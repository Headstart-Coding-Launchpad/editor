// Browser side of `hsc scratch render`: draws one sprite's script with the app's own block
// definitions (src/modules/scratch/scratch.js, zelos renderer) and exports it as a standalone
// SVG (src/modules/scratch/scriptSvg.js, shared with the tutor's Export work pictures). Loaded by
// cli/scratch-render.mjs through Vite in headless Chromium; never part of the app.

import {
  loadBlocklyModules,
  setWorkspaceBlocklyContext,
} from '../../src/modules/scratch/scratch.js'
import { loadWorkspace } from '../../src/modules/scratch/scratchPersistence.js'
import { resolveSpriteSounds } from '../../src/modules/scratch/scratchSounds.js'
import { DEFAULT_SPRITES } from '../../src/modules/scratch/checks.js'
import { SCRIPT_RENDER_OPTIONS, workspaceToSvg } from '../../src/modules/scratch/scriptSvg.js'

const PADDING = 8

function withExtras(list, extras, make) {
  const have = new Set(list.map((item) => item.id ?? item.name))
  return [...list, ...extras.filter((v) => !have.has(v)).map(make)]
}

// The dropdown lists ScratchWorkspace gives a workspace (blocklyContextForWorkspace), minus
// sprite thumbnails, plus any value the script uses that the task doesn't list.
function buildContext(job) {
  const taskSprites = job.task.sprites.length ? job.task.sprites : DEFAULT_SPRITES
  const sprite = taskSprites.find((s) => s.id === job.source.spriteId) ?? taskSprites[0]
  const extra = job.extraOptions
  return {
    sprites: withExtras(
      taskSprites.map((s) => ({ id: s.id, name: s.name })),
      extra.sprites,
      (v) => ({ id: v, name: v })
    ),
    costumes: withExtras(
      (sprite?.costumes ?? []).map((c) => ({ name: c.name, emoji: c.emoji })),
      extra.costumes,
      (v) => ({ name: v })
    ),
    backdrops: withExtras(job.task.backdrops, extra.backdrops, (v) => ({ name: v })),
    variables: withExtras(job.task.variables, extra.variables, (v) => ({ name: v })),
    sounds: withExtras(sprite ? resolveSpriteSounds(sprite) : [], extra.sounds, (v) => ({
      name: v,
    })),
  }
}

function fieldText(value) {
  if (value == null) return ''
  if (typeof value === 'object') return String(value.name ?? value.id ?? '')
  return String(value)
}

// Lists fields Blockly refused (a dropdown value not in its options falls back to the first
// option), so the CLI can say the picture differs from the data.
function findFieldMismatches(ws, state) {
  const out = []
  function visit(json) {
    if (!json || typeof json !== 'object') return
    const block = ws.getBlockById(json.id)
    for (const [name, value] of Object.entries(json.fields ?? {})) {
      const shown = block?.getFieldValue(name)
      if (block && shown != null && String(shown) !== fieldText(value)) {
        out.push({ id: json.id, field: name, expected: fieldText(value), shown: String(shown) })
      }
    }
    for (const input of Object.values(json.inputs ?? {})) {
      visit(input?.block)
      visit(input?.shadow)
    }
    visit(json.next?.block)
  }
  for (const json of state?.blocks?.blocks ?? []) visit(json)
  return out
}

window.renderScratch = async function renderScratch(job, options = {}) {
  const warnings = []
  try {
    await document.fonts.load("600 12px 'Quicksand'")
  } catch {
    warnings.push('Quicksand did not load; text is measured in a fallback font')
  }
  if (!document.fonts.check("600 12px 'Quicksand'")) {
    warnings.push('Quicksand is not available; text is drawn in a fallback font')
  }

  const { Blockly } = await loadBlocklyModules()
  const div = document.getElementById('blocks')
  const ws = Blockly.inject(div, SCRIPT_RENDER_OPTIONS)
  const context = buildContext(job)
  setWorkspaceBlocklyContext(ws, () => context)
  loadWorkspace(Blockly, ws, job.state)
  ws.render()

  let blocks = []
  const { svg, width, height } = await workspaceToSvg(ws, {
    padding: PADDING,
    embedFont: options.embedFont !== false,
    warnings,
    decorate: (clone, { x0, y0 }) => {
      blocks = job.blocks.map((entry) => {
        const block = ws.getBlockById(entry.id)
        if (!block) return { ...entry, rendered: false }
        const xy = block.getRelativeToSurfaceXY()
        const own = block.pathObject.svgPath.getBBox()
        const el = clone.querySelector(`[data-id="${CSS.escape(entry.id)}"]`)
        el?.setAttribute('data-opcode', entry.opcode)
        if (block.isShadow()) el?.setAttribute('data-shadow', 'true')
        return {
          ...entry,
          shadow: block.isShadow(),
          x: round(xy.x + own.x - x0),
          y: round(xy.y + own.y - y0),
          width: round(own.width),
          height: round(own.height),
        }
      })
    },
  })

  const mismatches = findFieldMismatches(ws, job.state)
  for (const m of mismatches) {
    warnings.push(`Block ${m.id} field ${m.field} shows '${m.shown}', not '${m.expected}'`)
  }
  ws.dispose()
  return {
    svg,
    width,
    height,
    blocks,
    warnings,
  }
}

function round(n) {
  return Math.round(n * 100) / 100
}

window.renderScratchReady = true
