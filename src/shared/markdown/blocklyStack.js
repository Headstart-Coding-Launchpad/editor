// SPIKE (spike/explainer-real-blockly): draw a Markdown `scratch` fence with the real Scratch
// editor's Blockly engine (zelos renderer, the app's own block definitions), as a static SVG.
//
// 1. The fence text is parsed with the Markdown renderer's own parser (parseScratchStack /
//    blockTextParts in ScratchBlocks.jsx), so authors keep exactly the syntax they write today.
// 2. Each line becomes Blockly JSON: the block's own fields and inputs are read off a headless
//    block of that type, in display order, and the `[...]` / `(...)` / `<...>` slots are matched
//    to them in order. Anything that does not map cleanly makes the whole fence fall back to the
//    current renderer (`ok: false` with the reasons).
// 3. One hidden, read-only workspace (reused, renders queued) draws the stack; scriptSvg.js
//    turns it into one standalone SVG string. Results are cached by fence text.
//
// Blockly is loaded only through a dynamic import, so a lesson with no Scratch fence never
// downloads it.

import { blockTextParts, parseScratchStack } from './ScratchBlocks.jsx'
import { findScratchBlock } from '../scratchBlockCatalog'

const cache = new Map()
let runtimePromise = null
let queue = Promise.resolve()

async function loadRuntime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const t0 = performance.now()
      const scratch = await import('../../modules/scratch/scratch.js')
      const svg = await import('../../modules/scratch/scriptSvg.js')
      const { Blockly } = await scratch.loadBlocklyModules()
      const headless = new Blockly.Workspace()
      return {
        Blockly,
        scratch,
        svg,
        headless,
        targets: new Map(),
        loadMs: performance.now() - t0,
      }
    })()
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
      out.push({
        kind: 'field',
        name: field.name,
        dropdown: field instanceof Blockly.FieldDropdown,
        dynamic: field instanceof Blockly.FieldDropdown && field.isOptionListDynamic(),
        options:
          field instanceof Blockly.FieldDropdown && !field.isOptionListDynamic()
            ? field.getOptions(false)
            : null,
      })
    }
    if (input.type === Blockly.inputs.inputTypes.VALUE) {
      out.push({ kind: 'value', name: input.name, check: input.connection?.getCheck() ?? null })
    } else if (input.type === Blockly.inputs.inputTypes.STATEMENT) {
      out.push({ kind: 'statement', name: input.name })
    }
  }
  block.dispose()
  rt.targets.set(type, out)
  return out
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

function isNumeric(s) {
  return s.trim() !== '' && !Number.isNaN(Number(s.trim()))
}

function textWithoutIcon(text, info) {
  // Same as scratchBlockTextWithoutIcon, kept local so this file reads alone.
  const value = String(text ?? '')
  return info?.icon && value.trimStart().startsWith(info.icon)
    ? value.replace(info.icon, '').trimStart()
    : value
}

// One line of block text (no children) to Blockly JSON. `ctx` collects dropdown values the
// dynamic menus must offer; `problems` collects why the fence cannot be drawn.
function lineToJson(rt, text, info, ctx, problems, depth = 0) {
  const type = info.opcode
  if (!type || type === 'unknown' || !rt.Blockly.Blocks[type]) {
    problems.push(`no Blockly block for "${text}"`)
    return null
  }
  const targets = slotTargets(rt, type).filter((t) => t.kind !== 'statement')
  const slots = blockTextParts(textWithoutIcon(text, info), depth, info).filter(
    (p) => p.type === 'slot'
  )
  if (slots.length !== targets.length) {
    // A `<>` with nothing in it, or a C block header written without its slot, is fine when
    // the text simply has fewer slots: those inputs stay empty / default.
    if (slots.length > targets.length) {
      problems.push(`"${text}": ${slots.length} slots in text, ${targets.length} on the block`)
      return null
    }
  }
  const json = { id: `md${ctx.nextId++}`, type, fields: {}, inputs: {} }
  const defaults = rt.scratch.VALUE_INPUT_DEFAULTS[type] ?? {}
  // Words outside the slots, for menus written as plain text (`abs of (10)`).
  const plainWords = norm(
    blockTextParts(textWithoutIcon(text, info), depth, info)
      .filter((p) => p.type === 'text')
      .map((p) => p.text)
      .join(' ')
  )
  let si = 0
  targets.forEach((target, ti) => {
    const slotsLeft = slots.length - si
    const targetsLeft = targets.length - ti
    if (target.kind === 'field' && target.options && slotsLeft < targetsLeft) {
      const hit = target.options.find(([label]) => {
        const t = norm(optionText(label))
        return t && ` ${plainWords} `.includes(` ${t} `)
      })
      if (hit) {
        json.fields[target.name] = hit[1]
        return
      }
    }
    const slot = slotsLeft > 0 ? slots[si++] : undefined
    if (target.kind === 'field') {
      const raw = slot ? slot.content.trim() : null
      if (raw == null) return
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
      ctx.add(raw)
      json.fields[target.name] = raw
      return
    }
    // Value input.
    const def = defaults[target.name]
    const content = slot ? slot.content.trim() : ''
    const nested = content && depth < 4 ? findScratchBlock(content) : null
    const shadowFor = (value) => {
      if (def) return { type: def.type, fields: { [def.field]: String(value ?? def.value) } }
      const isBool = target.check?.includes?.('Boolean') && !target.check.includes('Number')
      if (isBool) return null
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
    // `(score)`: a bare word in a number slot is a variable reporter in real Scratch.
    if ((def?.type === 'math_number' || !def) && !isNumeric(content) && slot.kind === 'value') {
      if (/^[a-z_][\w ]*$/i.test(content)) {
        ctx.add(content)
        json.inputs[target.name] = {
          shadow: shadowFor(),
          block: { type: 'data_variable', fields: { VARIABLE: content } },
        }
        return
      }
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

function hasNextConnection(rt, type) {
  const key = `next:${type}`
  if (!rt.targets.has(key)) {
    const block = rt.headless.newBlock(type)
    rt.targets.set(key, Boolean(block.nextConnection))
    block.dispose()
  }
  return rt.targets.get(key)
}

// A list of sibling nodes as Blockly chains. Normally one chain; a block written under a block
// with no next connection (`forever`, `stop all`) cannot attach in Scratch, so it starts a new
// chain (top level), or is reported (inside a mouth).
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
 * The fence text as a Blockly workspace state (top-level stacks split at each hat block, as
 * the Markdown renderer lays them out) plus the dropdown values the menus must offer.
 */
export function scratchFenceToState(rt, code) {
  const roots = parseScratchStack(code)
  const problems = []
  const ctx = new Set()
  ctx.nextId = 0
  if (roots.some((n) => n.info.opcode === 'unknown')) problems.push('unknown block text')
  const groups = []
  for (const node of roots) {
    if (!groups.length || node.info.shape === 'hat') groups.push([])
    groups[groups.length - 1].push(node)
  }
  const blocks = []
  for (const group of groups) {
    for (const top of chainsToJson(rt, group, ctx, problems, true)) {
      blocks.push({ ...top, x: 0, y: 0 })
    }
  }
  return {
    ok: problems.length === 0 && blocks.length > 0,
    problems,
    state: { blocks: { languageVersion: 0, blocks } },
    values: [...ctx],
  }
}

function contextFor(values) {
  const named = values.map((name) => ({ id: name, name }))
  return {
    sprites: named,
    costumes: named,
    backdrops: named,
    variables: named,
    sounds: named,
  }
}

const RENDER_HOST_ID = 'hsc-explainer-blockly-host'

function renderHost() {
  let host = document.getElementById(RENDER_HOST_ID)
  if (!host) {
    host = document.createElement('div')
    host.id = RENDER_HOST_ID
    host.className = 'scratch-workspace'
    host.setAttribute('aria-hidden', 'true')
    Object.assign(host.style, {
      position: 'fixed',
      left: '-10000px',
      top: '0',
      width: '1600px',
      height: '1600px',
      pointerEvents: 'none',
    })
    document.body.appendChild(host)
  }
  return host
}

const STACK_GAP = 12

async function renderOnce(code) {
  const rt = await loadRuntime()
  const t0 = performance.now()
  const parsed = scratchFenceToState(rt, code)
  if (!parsed.ok) return { ok: false, problems: parsed.problems }
  const { Blockly, scratch, svg } = rt
  if (!rt.ws) {
    rt.ws = Blockly.inject(renderHost(), { ...svg.SCRIPT_RENDER_OPTIONS })
  }
  const ws = rt.ws
  const context = contextFor(parsed.values)
  scratch.setWorkspaceBlocklyContext(ws, () => context)
  ws.clear()
  Blockly.serialization.workspaces.load(parsed.state, ws, { recordUndo: false })
  // Stacks one under another, as in the Markdown renderer.
  let y = 0
  for (const top of ws.getTopBlocks(true)) {
    top.moveBy(0, y - top.getRelativeToSurfaceXY().y)
    y += top.getHeightWidth().height + STACK_GAP
  }
  // Fields Blockly refused (a menu value it would not take) mean the picture differs.
  const mismatches = []
  const visit = (json) => {
    if (!json) return
    const block = ws.getBlockById(json.id)
    for (const [name, value] of Object.entries(json.fields ?? {})) {
      const shown = block?.getFieldValue(name)
      if (block && String(shown) !== String(value)) mismatches.push(`${json.type}.${name}: ${value} -> ${shown}`)
    }
    for (const input of Object.values(json.inputs ?? {})) visit(input.block)
    visit(json.next?.block)
  }
  parsed.state.blocks.blocks.forEach(visit)
  const out = await svg.workspaceToSvg(ws, { padding: 2, embedFont: false })
  ws.clear()
  return { ok: true, ...out, renderMs: performance.now() - t0, mismatches }
}

/** Renders the fence to `{ ok, svg, width, height, renderMs }` (cached, one at a time). */
export function renderScratchFenceSvg(code) {
  const key = String(code ?? '')
  if (cache.has(key)) return cache.get(key)
  const job = queue.then(() => renderOnce(key)).catch((e) => ({ ok: false, problems: [e.message] }))
  queue = job.then(() => undefined)
  cache.set(key, job)
  return job
}

export async function blocklyRuntimeLoadMs() {
  return (await loadRuntime()).loadMs
}

export function clearScratchFenceCache() {
  cache.clear()
}
