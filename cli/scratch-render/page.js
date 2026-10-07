// Browser side of `hsc scratch render`: draws one sprite's script with the app's own block
// definitions (src/modules/scratch/scratch.js, zelos renderer) and exports it as a standalone
// SVG. Loaded by cli/scratch-render.mjs through Vite in headless Chromium; never part of the app.

import {
  loadBlocklyModules,
  setWorkspaceBlocklyContext,
} from '../../src/modules/scratch/scratch.js'
import { loadWorkspace } from '../../src/modules/scratch/scratchPersistence.js'
import { resolveSpriteSounds } from '../../src/modules/scratch/scratchSounds.js'
import { DEFAULT_SPRITES } from '../../src/modules/scratch/checks.js'

const PADDING = 8
const FONT_CSS_URL = 'https://fonts.googleapis.com/css2?family=Quicksand:wght@600&display=block'

// Computed styles copied onto every exported element, so the SVG needs no stylesheet.
const STYLE_PROPS = [
  'fill',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linejoin',
  'stroke-linecap',
  'opacity',
  'filter',
  'font-family',
  'font-size',
  'font-weight',
  'dominant-baseline',
  'text-anchor',
  'display',
  'visibility',
]

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

function copyStyles(source, target) {
  const computed = getComputedStyle(source)
  const style = STYLE_PROPS.map((prop) => [prop, computed.getPropertyValue(prop)])
    .filter(([, value]) => value && value !== 'none' && value !== 'normal')
    .map(([prop, value]) => `${prop}:${value}`)
  if (computed.display === 'none') style.push('display:none')
  if (style.length) target.setAttribute('style', style.join(';'))
  for (let i = 0; i < source.children.length; i++)
    copyStyles(source.children[i], target.children[i])
}

async function toDataUrl(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} fetching ${url}`)
  const blob = await res.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

// Inlines <image> files that aren't already data: URIs (Blockly's dropdown arrow).
async function inlineImages(root, warnings) {
  for (const img of root.querySelectorAll('image')) {
    const href = img.getAttribute('href') ?? img.getAttribute('xlink:href')
    if (!href || href.startsWith('data:')) continue
    try {
      img.setAttribute('href', await toDataUrl(new URL(href, location.href).href))
      img.removeAttribute('xlink:href')
    } catch (e) {
      warnings.push(`Could not inline image ${href}: ${e.message}`)
    }
  }
}

// The Quicksand 600 @font-face rules with the font files embedded, so text renders in the
// app's font wherever the SVG is used.
async function embeddedFontCss(warnings) {
  try {
    const css = await (await fetch(FONT_CSS_URL)).text()
    const urls = [...new Set([...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]))]
    let out = css
    for (const url of urls) out = out.split(url).join(await toDataUrl(url))
    return out
  } catch (e) {
    warnings.push(`Could not embed the Quicksand font: ${e.message}`)
    return ''
  }
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
  const ws = Blockly.inject(div, {
    renderer: 'zelos',
    readOnly: true,
    trashcan: false,
    sounds: false,
    zoom: { controls: false, wheel: false, startScale: 1 },
    move: { scrollbars: false, drag: false, wheel: false },
  })
  const context = buildContext(job)
  setWorkspaceBlocklyContext(ws, () => context)
  loadWorkspace(Blockly, ws, job.state)
  ws.render()

  const canvas = ws.getCanvas()
  const box = canvas.getBBox()
  const x0 = box.x - PADDING
  const y0 = box.y - PADDING
  const width = Math.ceil(box.width + PADDING * 2)
  const height = Math.ceil(box.height + PADDING * 2)

  const clone = canvas.cloneNode(true)
  copyStyles(canvas, clone)
  clone.removeAttribute('transform')
  clone.setAttribute('transform', `translate(${-x0} ${-y0})`)

  const blocks = job.blocks.map((entry) => {
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

  const svgNs = 'http://www.w3.org/2000/svg'
  const out = document.createElementNS(svgNs, 'svg')
  out.setAttribute('xmlns', svgNs)
  out.setAttribute('width', String(width))
  out.setAttribute('height', String(height))
  out.setAttribute('viewBox', `0 0 ${width} ${height}`)
  out.setAttribute('class', 'hsc-scratch-script')
  const defs = ws.getParentSvg().querySelector('defs')
  if (defs) out.appendChild(defs.cloneNode(true))
  if (options.embedFont !== false) {
    const css = await embeddedFontCss(warnings)
    if (css) {
      const style = document.createElementNS(svgNs, 'style')
      style.textContent = css
      out.insertBefore(style, out.firstChild)
    }
  }
  out.appendChild(clone)
  await inlineImages(out, warnings)

  const mismatches = findFieldMismatches(ws, job.state)
  for (const m of mismatches) {
    warnings.push(`Block ${m.id} field ${m.field} shows '${m.shown}', not '${m.expected}'`)
  }
  ws.dispose()
  return {
    svg: new XMLSerializer().serializeToString(out),
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
