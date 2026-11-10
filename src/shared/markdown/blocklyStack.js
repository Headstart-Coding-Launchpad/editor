// A Markdown `scratch` fence drawn by the real Scratch editor's Blockly engine (zelos renderer,
// the app's own block definitions), as a static SVG, so explainer blocks look exactly like the
// blocks the student drags.
//
// 1. The fence text is parsed with the Markdown renderer's own parser (parseScratchStack /
//    blockTextParts in ScratchBlocks.jsx), so authors keep exactly the syntax they write today.
// 2. Each line becomes Blockly JSON: the block's own fields and inputs are read off a headless
//    block of that type, in display order, and the `[...]` / `(...)` / `<...>` slots are matched
//    to them in order. Anything that does not map cleanly makes the whole fence fall back to the
//    Markdown renderer (`ok: false` with the reasons): an unknown line, more slots than the
//    block has, a menu value the block does not offer.
// 3. A throwaway, read-only workspace in an inert off-screen host (renders queued one at a time,
//    disposed after each) draws the stack; scriptSvg.js turns it into one standalone SVG
//    string. Results are cached by fence text, except ones that may differ next time.
//
// Blockly is loaded only through a dynamic import, so a page with no Scratch fence never
// downloads it.

import { blockTextParts, parseScratchStack } from './ScratchBlocks.jsx'
import { findScratchBlock } from '../scratchBlockCatalog'

// Enough for every fence in a long lesson; the oldest drop out first.
export const FENCE_CACHE_LIMIT = 200

const pending = new Map()
const done = new Map()
let runtimePromise = null
let queue = Promise.resolve()

/**
 * Whether this page can draw with Blockly: a real browser (jsdom has no SVG layout, so tests,
 * and anything else without one, keep the Markdown renderer).
 */
export function canDrawRealBlocks() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false
  if (/jsdom/i.test(globalThis.navigator?.userAgent ?? '')) return false
  return typeof window.SVGElement !== 'undefined'
}

export async function loadFenceRuntime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const scratch = await import('../../modules/scratch/scratch.js')
      const svg = await import('../../modules/scratch/scriptSvg.js')
      const { Blockly } = await scratch.loadBlocklyModules()
      return { Blockly, scratch, svg, headless: new Blockly.Workspace(), targets: new Map() }
    })()
    runtimePromise.catch(() => {
      runtimePromise = null
    })
  }
  return runtimePromise
}

// The block's editable fields and inputs, in the order they are drawn.
function slotTargets(rt, type) {
  if (rt.targets.has(type)) return rt.targets.get(type)
  const { Blockly, headless } = rt
  const block = headless.newBlock(type)
  const out = []
  for (const input of block.inputList) {
    for (const field of input.fieldRow) {
      if (!field.name) continue
      if (field instanceof Blockly.FieldLabel || field instanceof Blockly.FieldImage) continue
      const dropdown = field instanceof Blockly.FieldDropdown
      const dynamic = dropdown && field.isOptionListDynamic()
      out.push({
        kind: 'field',
        name: field.name,
        dropdown,
        options: dropdown && !dynamic ? field.getOptions(false) : null,
      })
    }
    if (input.type === Blockly.inputs.inputTypes.VALUE) {
      out.push({ kind: 'value', name: input.name, check: input.connection?.getCheck() ?? null })
    } else if (input.type === Blockly.inputs.inputTypes.STATEMENT) {
      out.push({ kind: 'statement', name: input.name })
    }
  }
  rt.targets.set(type, out)
  rt.targets.set(`next:${type}`, Boolean(block.nextConnection))
  block.dispose()
  return out
}

function hasNextConnection(rt, type) {
  slotTargets(rt, type)
  return rt.targets.get(`next:${type}`)
}

function optionText(label) {
  if (typeof label === 'string') return label
  if (label?.alt) return label.alt
  if (typeof HTMLElement !== 'undefined' && label instanceof HTMLElement) return label.title
  return ''
}

const norm = (s) =>
  String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')

const isNumeric = (s) => s.trim() !== '' && !Number.isNaN(Number(s.trim()))

function textWithoutIcon(text, info) {
  const value = String(text ?? '')
  return info?.icon && value.trimStart().startsWith(info.icon)
    ? value.replace(info.icon, '').trimStart()
    : value
}

// One line of block text (no children) to Blockly JSON. `ctx.values` collects the values the
// dynamic menus (sprites, costumes, sounds, variables) must offer; `problems` collects why the
// fence cannot be drawn.
function lineToJson(rt, text, info, ctx, problems, depth = 0) {
  const type = info.opcode
  if (!type || type === 'unknown' || !rt.Blockly.Blocks[type]) {
    problems.push(`no Blockly block for "${text}"`)
    return null
  }
  const targets = slotTargets(rt, type).filter((t) => t.kind !== 'statement')
  const parts = blockTextParts(textWithoutIcon(text, info), depth, info)
  const slots = parts.filter((p) => p.type === 'slot')
  // Fewer slots than inputs is fine (`if <> then`, a C block header with no slot): the rest
  // keep their defaults. More slots than inputs means the text is not this block.
  if (slots.length > targets.length) {
    problems.push(`"${text}": ${slots.length} slots in text, ${targets.length} on the block`)
    return null
  }
  const json = { id: `b${ctx.nextId++}`, type, fields: {}, inputs: {} }
  const defaults = rt.scratch.VALUE_INPUT_DEFAULTS[type] ?? {}
  // Words outside the slots, for menus written as plain text (`abs of (10)`).
  const plainWords = norm(
    parts
      .filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join(' ')
  )
  let si = 0
  targets.forEach((target, ti) => {
    if (target.kind === 'field' && target.options && slots.length - si < targets.length - ti) {
      const hit = target.options.find(([label]) => {
        const t = norm(optionText(label))
        return t && ` ${plainWords} `.includes(` ${t} `)
      })
      if (hit) {
        json.fields[target.name] = hit[1]
        return
      }
    }
    const slot = si < slots.length ? slots[si++] : undefined
    if (target.kind === 'field') {
      if (!slot) return
      const raw = slot.content.trim()
      if (!target.dropdown) {
        json.fields[target.name] = raw
        return
      }
      if (target.options) {
        const hit = target.options.find(
          ([label, value]) => norm(optionText(label)) === norm(raw) || norm(value) === norm(raw)
        )
        if (hit) json.fields[target.name] = hit[1]
        else problems.push(`"${text}": "${raw}" is not an option of ${target.name}`)
        return
      }
      ctx.values.add(raw)
      json.fields[target.name] = raw
      return
    }
    // A value input.
    const def = defaults[target.name]
    const content = slot ? slot.content.trim() : ''
    const conditionOnly = target.check?.includes?.('Boolean') && !target.check.includes('Number')
    const nested = content && depth < 4 ? findScratchBlock(content) : null
    const shadowFor = (value) => {
      if (def) return { type: def.type, fields: { [def.field]: String(value ?? def.value) } }
      if (conditionOnly) return null
      return isNumeric(String(value ?? '0'))
        ? { type: 'math_number', fields: { NUM: String(value ?? 0) } }
        : { type: 'text', fields: { TEXT: String(value ?? '') } }
    }
    if (nested && (nested.shape === 'reporter' || nested.shape === 'boolean')) {
      const child = lineToJson(rt, content, nested, ctx, problems, depth + 1)
      if (!child) return
      const shadow = shadowFor()
      json.inputs[target.name] = shadow ? { shadow, block: child } : { block: child }
      return
    }
    if (!content) {
      const shadow = slot ? shadowFor('') : shadowFor()
      if (shadow) json.inputs[target.name] = { shadow }
      return
    }
    // A condition slot takes only a block (`<touching [edge]?>`): anything else would draw as
    // an empty hexagon, a different block from the one written.
    if (conditionOnly) {
      problems.push(`"${text}": condition <${content}> is not a block`)
      return
    }
    // `(score)`: a bare word in a number slot is a variable reporter in real Scratch.
    if (
      (def?.type === 'math_number' || !def) &&
      !isNumeric(content) &&
      slot.kind === 'value' &&
      /^[a-z_][\w ]*$/i.test(content)
    ) {
      ctx.values.add(content)
      json.inputs[target.name] = {
        shadow: shadowFor(),
        block: { type: 'data_variable', fields: { VARIABLE: content } },
      }
      return
    }
    const shadow =
      def?.type === 'math_number' && !isNumeric(content)
        ? { type: 'text', fields: { TEXT: content } }
        : shadowFor(content)
    if (shadow) json.inputs[target.name] = { shadow }
  })
  if (!Object.keys(json.fields).length) delete json.fields
  if (!Object.keys(json.inputs).length) delete json.inputs
  return json
}

// A list of sibling nodes as Blockly chains. Normally one chain. A block written under a block
// with no next connection (`forever`, `stop all`) cannot attach in Scratch, so it starts a new
// stack: at the top level it is drawn as its own stack below, as Scratch would show it; inside a
// mouth it cannot be drawn honestly, so the fence falls back.
function chainsToJson(rt, nodes, ctx, problems, topLevel) {
  const chains = []
  let last = null
  for (const node of nodes) {
    // `if <> then` … `else` is written with the one-mouth block's text; Scratch draws if/else.
    const info =
      node.hasElse && node.info.opcode === 'control_if'
        ? { ...node.info, opcode: 'control_if_else' }
        : node.info
    const json = lineToJson(rt, node.text, info, ctx, problems)
    if (!json) continue
    if (node.info.shape === 'c') {
      const statements = slotTargets(rt, json.type).filter((t) => t.kind === 'statement')
      const branches = [node.children, node.elseChildren]
      branches.forEach((branch, i) => {
        if (branch.length && !statements[i]) problems.push(`"${node.text}" has no mouth ${i + 1}`)
      })
      statements.forEach((st, i) => {
        const [inner, ...extra] = chainsToJson(rt, branches[i] ?? [], ctx, problems, false)
        if (extra.length) problems.push(`a block under "${node.text}" cannot attach`)
        if (inner) json.inputs = { ...(json.inputs ?? {}), [st.name]: { block: inner } }
      })
    }
    if (last && hasNextConnection(rt, last.type)) {
      last.next = { block: json }
    } else {
      if (last && !topLevel) problems.push(`a block under "${last.type}" cannot attach`)
      chains.push(json)
    }
    last = json
  }
  return chains
}

/**
 * The fence text as a Blockly workspace state: one top block per stack (a new stack at each hat
 * block, and after a block nothing can attach under), plus the values the menus must offer.
 * `rt` comes from loadFenceRuntime(). Pure apart from the headless block lookups.
 */
export function scratchFenceToState(rt, code) {
  const roots = parseScratchStack(code)
  const problems = []
  const ctx = { values: new Set(), nextId: 0 }
  if (roots.some((n) => n.info.opcode === 'unknown')) problems.push('unknown block text')
  const groups = []
  for (const node of roots) {
    if (!groups.length || node.info.shape === 'hat') groups.push([])
    groups[groups.length - 1].push(node)
  }
  const blocks = []
  for (const group of groups) {
    for (const top of chainsToJson(rt, group, ctx, problems, true)) blocks.push(top)
  }
  return {
    ok: problems.length === 0 && blocks.length > 0,
    problems,
    state: { blocks: { languageVersion: 0, blocks } },
    values: [...ctx.values],
  }
}

function contextFor(values) {
  const named = values.map((name) => ({ id: name, name }))
  return { sprites: named, costumes: named, backdrops: named, variables: named, sounds: named }
}

// Field values Blockly would not take (a menu value it refused) mean the picture would differ
// from the text. Blocks without an id (variable reporters) are not checked.
function refusedFields(ws, json, out = []) {
  if (!json) return out
  const block = json.id ? ws.getBlockById(json.id) : null
  for (const [name, value] of Object.entries(block ? (json.fields ?? {}) : {})) {
    if (String(block.getFieldValue(name)) !== String(value))
      out.push(`${json.type}.${name}: ${value}`)
  }
  for (const input of Object.values(json.inputs ?? {})) refusedFields(ws, input.block, out)
  return refusedFields(ws, json.next?.block, out)
}

/**
 * The SVG with Blockly's per-block `data-id`s removed, and every `id` dropped unless something
 * in the picture points at it. Ids that stay are renamed to `hsc-sb-<n>`, ready for
 * scopeSvgIds() to make them unique per picture on the page.
 */
// What comes before an id where something points at it: url(#x), url("#x") (written
// url(&quot;#x&quot;) inside an attribute, as computed styles give it), url('#x'), href="#x".
const ID_REF_PREFIX = String.raw`url\(\s*(?:&quot;|["'])?#|href="#`

export function tidySvgIds(svg) {
  let out = svg.replace(/\sdata-id="[^"]*"/g, '')
  const ids = [...out.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1])
  ids.forEach((id, n) => {
    const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const refRe = new RegExp(String.raw`(${ID_REF_PREFIX})${esc}(?![\w-])`, 'g')
    const referenced = refRe.test(out)
    const idRe = new RegExp(`\\sid="${esc}"`, 'g')
    if (!referenced) {
      out = out.replace(idRe, '')
      return
    }
    out = out.replace(idRe, ` id="hsc-sb-${n}"`).replace(refRe, `$1hsc-sb-${n}`)
  })
  return out
}

/** Gives the `hsc-sb-` ids (and the references to them) a prefix unique to one picture. */
export function scopeSvgIds(svg, scope) {
  const safe = String(scope).replace(/[^\w-]/g, '')
  return svg.replace(new RegExp(`(id="|${ID_REF_PREFIX})hsc-sb-`, 'g'), `$1hsc-sb-${safe}-`)
}

const RENDER_HOST_ID = 'hsc-explainer-blockly-host'
const RENDER_SIZE = 1600
const STACK_GAP = 12
const BLOCK_FONT = "600 12px 'Quicksand'"

// Blockly measures text as it renders, so the block font must be there first. True when it is
// (or when the page cannot say): a picture measured with a stand-in font is not cached.
async function blockFontLoaded(rt) {
  const fonts = document.fonts
  if (!fonts?.load) return true
  if (!rt.fontReady) rt.fontReady = Promise.resolve(fonts.load(BLOCK_FONT)).catch(() => {})
  await rt.fontReady
  if (!fonts.check || fonts.check(BLOCK_FONT)) return true
  rt.fontReady = null
  return false
}

// One throwaway workspace per render (in an inert, off-screen host), disposed straight after,
// so nothing of it stays on the page beside the student's own workspace.
async function renderOnce(code) {
  const rt = await loadFenceRuntime()
  const parsed = scratchFenceToState(rt, code)
  if (!parsed.ok) return { ok: false, problems: parsed.problems }
  const fontLoaded = await blockFontLoaded(rt)
  const { Blockly, scratch, svg } = rt
  const host = svg.createRenderHost(RENDER_SIZE, RENDER_HOST_ID)
  let ws = null
  try {
    ws = svg.injectRenderWorkspace(Blockly, host)
    const context = contextFor(parsed.values)
    scratch.setWorkspaceBlocklyContext(ws, () => context)
    Blockly.serialization.workspaces.load(parsed.state, ws, { recordUndo: false })
    // Stacks one under another, as the Markdown renderer lays them out.
    let y = 0
    for (const top of ws.getTopBlocks(true)) {
      top.moveBy(-top.getRelativeToSurfaceXY().x, y - top.getRelativeToSurfaceXY().y)
      y += top.getHeightWidth().height + STACK_GAP
    }
    const refused = parsed.state.blocks.blocks.flatMap((b) => refusedFields(ws, b))
    if (refused.length) return { ok: false, problems: refused.map((r) => `refused ${r}`) }
    const out = await svg.workspaceToSvg(ws, { padding: 2, embedFont: false })
    if (!out.width || !out.height) return { ok: false, problems: ['nothing drawn'] }
    const result = { ok: true, svg: tidySvgIds(out.svg), width: out.width, height: out.height }
    return fontLoaded ? result : { ...result, retry: true }
  } finally {
    ws?.dispose()
    host.remove()
  }
}

/** The finished render for this fence text, if it is cached; otherwise undefined. */
export function peekScratchFenceSvg(code) {
  return done.get(String(code ?? ''))
}

function remember(key, result) {
  done.delete(key)
  done.set(key, result)
  while (done.size > FENCE_CACHE_LIMIT) done.delete(done.keys().next().value)
}

/**
 * Renders the fence to `{ ok: true, svg, width, height }` or `{ ok: false, problems }`. Renders
 * run one at a time. Results that will not change are cached by text; a result marked
 * `retry: true` (the render threw, the block font was missing, or nobody wanted it any more) is
 * not, so the next request draws it again.
 *
 * `signal` (an AbortSignal) says the caller no longer needs the picture: a render still queued
 * that every caller has given up on is skipped, so a fence edited key by key draws only the
 * text it ends on.
 */
export function renderScratchFenceSvg(code, { signal } = {}) {
  const key = String(code ?? '')
  if (done.has(key)) return Promise.resolve(done.get(key))
  let entry = pending.get(key)
  if (!entry) {
    const job = { wanted: 0 }
    job.promise = queue
      .then(() =>
        job.wanted > 0
          ? renderOnce(key)
          : { ok: false, problems: ['no longer needed'], retry: true }
      )
      .catch((e) => ({ ok: false, problems: [e?.message ?? String(e)], retry: true }))
      .then((result) => {
        if (pending.get(key) === job) pending.delete(key)
        if (!result.retry) remember(key, result)
        return result
      })
    queue = job.promise.then(() => undefined)
    pending.set(key, job)
    entry = job
  }
  if (!signal) {
    entry.wanted = Infinity
  } else if (!signal.aborted) {
    entry.wanted += 1
    signal.addEventListener('abort', () => (entry.wanted -= 1), { once: true })
  }
  return entry.promise
}

export function clearScratchFenceCache() {
  pending.clear()
  done.clear()
}
