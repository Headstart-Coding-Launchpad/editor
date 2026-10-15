// Best-effort translator from LaunchPad's Scratch work (Blockly 12 JSON per sprite, keyed by
// sprite id, plus `__stage__` and `__meta__`) to a Scratch 3 `project.json` (the heart of a
// .sb3). Our opcodes mostly match Scratch 3's; the differences handled here:
//
// - Scratch puts dropdown menus in shadow "menu" blocks plugged into an input (motion_goto_menu,
//   looks_costume, sound_sounds_menu, …); ours are fields on the block.
// - Number/text slots are compact primitives ([4, "10"], [10, "Hello"]); a reporter dropped in
//   a slot keeps an obscured shadow ([3, blockId, [4, "10"]]).
// - Sprite menus hold sprite ids here and sprite names in Scratch.
// - Variables, broadcasts and lists live on the Stage with ids; fields carry [name, id].
// - A few opcodes are renamed (sensing_touchingedge → sensing_touchingobject "_edge_",
//   looks_costumenumber → looks_costumenumbername "number"), effect names are upper case and
//   looks_changeeffectby's input is CHANGE.
//
// Anything without a mapping is left out (its following blocks stay connected) and listed in
// `unmapped`, so the tutor sees what didn't make it. Pure and Node-safe: assets (costume and
// sound files) come in already described; see ./sb3Assets.js for making them in the browser.
import { migrateBroadcastState, migrateVariableFields } from '../scratchPersistence.js'
import { VALUE_INPUT_DEFAULTS } from '../blockInputs.js'

// Scratch 3 compact primitive codes.
export const PRIMITIVE = Object.freeze({
  number: 4,
  positive: 5,
  whole: 6,
  integer: 7,
  angle: 8,
  colour: 9,
  text: 10,
  broadcast: 11,
  variable: 12,
  list: 13,
})

const num = (name, kind = 'number', scratchName) => ({ name, kind, scratchName })
const text = (name, scratchName) => ({ name, kind: 'text', scratchName })
const bool = (name) => ({ name, kind: 'bool' })
const stack = (name) => ({ name, kind: 'statement' })
// A field of ours that is a menu shadow block in Scratch. `values`: how to turn our value into
// Scratch's ('target' maps sprite ids to names; the special _random_/_mouse_/… pass through).
const menu = (name, opcode, values = 'plain', field = name) => ({
  name,
  kind: 'menu',
  menuOpcode: opcode,
  menuField: field,
  values,
})
const field = (name, extra = {}) => ({ name, ...extra })

const EFFECT_NAMES = {
  color: 'COLOR',
  fisheye: 'FISHEYE',
  whirl: 'WHIRL',
  pixelate: 'PIXELATE',
  mosaic: 'MOSAIC',
  brightness: 'BRIGHTNESS',
  ghost: 'GHOST',
}
const effectField = field('EFFECT', {
  map: (value) => EFFECT_NAMES[String(value).toLowerCase()] ?? String(value).toUpperCase(),
})

/**
 * Every block we can translate. `inputs` and `fields` describe our block; `opcode` renames it;
 * `fixedFields` / `fixedMenus` / `mutation` add what Scratch needs that we don't store.
 */
export const SB3_BLOCK_SPECS = Object.freeze({
  event_whenflagclicked: {},
  event_whenkeypressed: { fields: [field('KEY_OPTION')] },
  event_whenthisspriteclicked: {},
  event_whenbackdropswitchesto: { fields: [field('BACKDROP')] },
  event_broadcast: { inputs: [{ name: 'BROADCAST_INPUT', kind: 'broadcast' }] },
  event_broadcastandwait: { inputs: [{ name: 'BROADCAST_INPUT', kind: 'broadcast' }] },
  event_whenbroadcastreceived: { fields: [field('BROADCAST_OPTION', { broadcast: true })] },

  motion_movesteps: { inputs: [num('STEPS')] },
  motion_turnright: { inputs: [num('DEGREES')] },
  motion_turnleft: { inputs: [num('DEGREES')] },
  motion_pointindirection: { inputs: [num('DIRECTION', 'angle')] },
  motion_gotoxy: { inputs: [num('X'), num('Y')] },
  motion_goto: { inputs: [menu('TO', 'motion_goto_menu', 'target')] },
  motion_glidesecstoxy: { inputs: [num('SECS'), num('X'), num('Y')] },
  motion_glideto: { inputs: [num('SECS'), menu('TO', 'motion_glideto_menu', 'target')] },
  motion_ifonedge_bounce: {},
  motion_setrotationstyle: { fields: [field('STYLE')] },
  motion_setx: { inputs: [num('X')] },
  motion_sety: { inputs: [num('Y')] },
  motion_changexby: { inputs: [num('DX')] },
  motion_changeyby: { inputs: [num('DY')] },
  motion_xposition: {},
  motion_yposition: {},
  motion_direction: {},

  looks_sayforsecs: { inputs: [text('MESSAGE'), num('SECS')] },
  looks_say: { inputs: [text('MESSAGE')] },
  looks_think: { inputs: [text('MESSAGE')] },
  looks_thinkforsecs: { inputs: [text('MESSAGE'), num('SECS')] },
  looks_show: {},
  looks_hide: {},
  looks_setsizeto: { inputs: [num('SIZE')] },
  looks_changesizeby: { inputs: [num('CHANGE')] },
  looks_switchcostumeto: { inputs: [menu('COSTUME', 'looks_costume')] },
  looks_nextcostume: {},
  looks_costumenumber: {
    opcode: 'looks_costumenumbername',
    fixedFields: { NUMBER_NAME: 'number' },
  },
  looks_costumenumbername: { fields: [field('WHICH', { scratchName: 'NUMBER_NAME' })] },
  looks_switchbackdropto: { inputs: [menu('BACKDROP', 'looks_backdrops')] },
  looks_nextbackdrop: {},
  looks_backdropnumbername: { fields: [field('WHICH', { scratchName: 'NUMBER_NAME' })] },
  looks_seteffectto: { fields: [effectField], inputs: [num('VALUE')] },
  looks_changeeffectby: { fields: [effectField], inputs: [num('VALUE', 'number', 'CHANGE')] },
  looks_cleargraphiceffects: {},

  sound_play: { inputs: [menu('SOUND_MENU', 'sound_sounds_menu')] },
  sound_playuntildone: { inputs: [menu('SOUND_MENU', 'sound_sounds_menu')] },
  sound_stopallsounds: {},

  control_wait: { inputs: [num('DURATION', 'positive')] },
  control_wait_until: { inputs: [bool('CONDITION')] },
  control_repeat: { inputs: [num('TIMES', 'whole'), stack('SUBSTACK')] },
  control_repeat_until: { inputs: [bool('CONDITION'), stack('SUBSTACK')] },
  control_forever: { inputs: [stack('SUBSTACK')] },
  control_if: { inputs: [bool('CONDITION'), stack('SUBSTACK')] },
  control_if_else: { inputs: [bool('CONDITION'), stack('SUBSTACK'), stack('SUBSTACK2')] },
  control_stop: {
    fixedFields: { STOP_OPTION: 'all' },
    mutation: { tagName: 'mutation', children: [], hasnext: 'false' },
  },
  control_create_clone_of: {
    inputs: [menu('CLONE_OPTION', 'control_create_clone_of_menu', 'target')],
  },
  control_start_as_clone: {},
  control_delete_this_clone: {},

  sensing_askandwait: { inputs: [text('QUESTION')] },
  sensing_answer: {},
  sensing_keypressed: { inputs: [menu('KEY_OPTION', 'sensing_keyoptions')] },
  sensing_mousedown: {},
  sensing_touchingedge: {
    opcode: 'sensing_touchingobject',
    fixedMenus: [
      {
        name: 'TOUCHINGOBJECTMENU',
        menuOpcode: 'sensing_touchingobjectmenu',
        menuField: 'TOUCHINGOBJECTMENU',
        value: '_edge_',
      },
    ],
  },
  sensing_touchingobject: {
    inputs: [menu('TOUCHINGOBJECTMENU', 'sensing_touchingobjectmenu', 'target')],
  },
  sensing_distanceto: { inputs: [menu('DISTANCETOMENU', 'sensing_distancetomenu', 'target')] },
  sensing_timer: {},
  sensing_resettimer: {},

  operator_equals: { inputs: [text('OPERAND1'), text('OPERAND2')] },
  operator_gt: { inputs: [text('OPERAND1'), text('OPERAND2')] },
  operator_lt: { inputs: [text('OPERAND1'), text('OPERAND2')] },
  operator_and: { inputs: [bool('OPERAND1'), bool('OPERAND2')] },
  operator_or: { inputs: [bool('OPERAND1'), bool('OPERAND2')] },
  operator_not: { inputs: [bool('OPERAND')] },
  operator_add: { inputs: [num('NUM1'), num('NUM2')] },
  operator_subtract: { inputs: [num('NUM1'), num('NUM2')] },
  operator_multiply: { inputs: [num('NUM1'), num('NUM2')] },
  operator_divide: { inputs: [num('NUM1'), num('NUM2')] },
  operator_mod: { inputs: [num('NUM1'), num('NUM2')] },
  operator_round: { inputs: [num('NUM')] },
  operator_mathop: { fields: [field('OPERATOR')], inputs: [num('NUM')] },
  operator_random: { inputs: [num('FROM'), num('TO')] },
  operator_join: { inputs: [text('STRING1'), text('STRING2')] },
  operator_letter_of: { inputs: [num('LETTER', 'whole'), text('STRING')] },
  operator_length: { inputs: [text('STRING')] },
  operator_contains: { inputs: [text('STRING1'), text('STRING2')] },

  data_variable: { fields: [field('VARIABLE', { variable: true })] },
  data_setvariableto: { fields: [field('VARIABLE', { variable: true })], inputs: [text('VALUE')] },
  data_changevariableby: {
    fields: [field('VARIABLE', { variable: true })],
    inputs: [num('VALUE')],
  },
  data_showvariable: { fields: [field('VARIABLE', { variable: true })] },
  data_hidevariable: { fields: [field('VARIABLE', { variable: true })] },
})

// Menu values that are Scratch keywords, not sprite names.
const SPECIAL_TARGETS = new Set(['_random_', '_mouse_', '_edge_', '_myself_', '_stage_'])

function fieldText(value) {
  if (value == null) return ''
  if (typeof value === 'object') return String(value.name ?? value.id ?? '')
  return String(value)
}

/** A safe Scratch id from a name: `${prefix}-${name}` with odd characters replaced. */
function idFor(prefix, name, used) {
  const base = `${prefix}-${String(name).replace(/[^A-Za-z0-9_-]+/g, '_') || 'x'}`
  let id = base
  let n = 2
  while (used.has(id)) id = `${base}-${n++}`
  used.add(id)
  return id
}

/**
 * Shared translation state for one project: fresh block ids, the Stage's variables and
 * broadcasts, sprite id → name, and the opcodes that had no mapping.
 */
export function createSb3Context({ spriteNames = {}, variables = [] } = {}) {
  let counter = 0
  const usedIds = new Set()
  const ctx = {
    spriteNames,
    variables: new Map(), // name → { id, value }
    broadcasts: new Map(), // name → id
    unmapped: new Map(), // opcode → count
    nextBlockId: () => `b${(++counter).toString(36)}`,
    variableId(name, value = 0) {
      const key = String(name)
      if (!ctx.variables.has(key)) {
        ctx.variables.set(key, { id: idFor('var', key, usedIds), value })
      }
      return ctx.variables.get(key).id
    },
    broadcastId(name) {
      const key = String(name)
      if (!ctx.broadcasts.has(key)) ctx.broadcasts.set(key, idFor('broadcast', key, usedIds))
      return ctx.broadcasts.get(key)
    },
    noteUnmapped(opcode) {
      const key = String(opcode ?? 'unknown')
      ctx.unmapped.set(key, (ctx.unmapped.get(key) ?? 0) + 1)
    },
  }
  for (const variable of variables) {
    if (variable?.name) ctx.variableId(variable.name, variable.value ?? 0)
  }
  return ctx
}

function menuValue(value, kind, ctx) {
  const text = fieldText(value)
  if (kind !== 'target' || SPECIAL_TARGETS.has(text)) return text
  return ctx.spriteNames[text] ?? text
}

// Our shadow's value for a value input, else the block's default (blockInputs.js), else ''.
function shadowValue(opcode, input, json) {
  const shadow = json?.inputs?.[input.name]?.shadow
  const fromShadow = shadow?.fields ? Object.values(shadow.fields)[0] : undefined
  if (fromShadow !== undefined && fromShadow !== null) return fieldText(fromShadow)
  const fallback = VALUE_INPUT_DEFAULTS[opcode]?.[input.name]?.value
  return fallback == null ? '' : String(fallback)
}

function primitiveFor(input, value) {
  return [PRIMITIVE[input.kind] ?? PRIMITIVE.number, String(value)]
}

// A plain number/text block (not a shadow) sitting in a slot reads as that value.
function literalValue(json) {
  if (json?.type === 'math_number') return fieldText(json.fields?.NUM)
  if (json?.type === 'text') return fieldText(json.fields?.TEXT)
  return null
}

/** Translates one sprite's Blockly workspace state into a Scratch `blocks` map. */
export function translateWorkspaceBlocks(state, ctx) {
  const migrated = migrateVariableFields(migrateBroadcastState(state ?? null))
  const out = {}

  function makeMenu(parentId, menuOpcode, menuField, value) {
    const id = ctx.nextBlockId()
    out[id] = {
      opcode: menuOpcode,
      next: null,
      parent: parentId,
      inputs: {},
      fields: { [menuField]: [value, null] },
      shadow: true,
      topLevel: false,
    }
    return id
  }

  function variableField(json) {
    const name = fieldText(json?.fields?.VARIABLE) || 'my variable'
    return [name, ctx.variableId(name)]
  }

  // One block (not its `next`), or null when it has no mapping.
  function emitSingle(json, parentId) {
    const spec = SB3_BLOCK_SPECS[json?.type]
    if (!spec) {
      ctx.noteUnmapped(json?.type)
      return null
    }
    const id = ctx.nextBlockId()
    const block = {
      opcode: spec.opcode ?? json.type,
      next: null,
      parent: parentId,
      inputs: {},
      fields: {},
      shadow: false,
      topLevel: false,
    }
    out[id] = block

    for (const f of spec.fields ?? []) {
      const raw = json.fields?.[f.name]
      const target = f.scratchName ?? f.name
      if (f.variable) {
        block.fields[target] = variableField(json)
      } else if (f.broadcast) {
        const name = fieldText(raw) || 'message1'
        block.fields[target] = [name, ctx.broadcastId(name)]
      } else {
        const value = fieldText(raw)
        block.fields[target] = [f.map ? f.map(value) : value, null]
      }
    }
    for (const [name, value] of Object.entries(spec.fixedFields ?? {})) {
      block.fields[name] = [value, null]
    }
    for (const fixed of spec.fixedMenus ?? []) {
      block.inputs[fixed.name] = [1, makeMenu(id, fixed.menuOpcode, fixed.menuField, fixed.value)]
    }
    if (spec.mutation) block.mutation = { ...spec.mutation }

    for (const input of spec.inputs ?? []) {
      const target = input.scratchName ?? input.name
      const slot = json.inputs?.[input.name]
      if (input.kind === 'statement') {
        const first = slot?.block ? emitChain(slot.block, id) : null
        if (first) block.inputs[target] = [2, first]
      } else if (input.kind === 'bool') {
        const child = slot?.block ? emitSingle(slot.block, id) : null
        if (child) block.inputs[target] = [2, child]
      } else if (input.kind === 'menu') {
        const value = menuValue(json.fields?.[input.name], input.values, ctx)
        block.inputs[target] = [1, makeMenu(id, input.menuOpcode, input.menuField, value)]
      } else if (input.kind === 'broadcast') {
        const name = fieldText(json.fields?.[input.name]) || 'message1'
        block.inputs[target] = [1, [PRIMITIVE.broadcast, name, ctx.broadcastId(name)]]
      } else {
        const primitive = primitiveFor(input, shadowValue(json.type, input, json))
        const child = slot?.block
        const literal = child ? literalValue(child) : null
        if (!child) {
          block.inputs[target] = [1, primitive]
        } else if (literal != null) {
          block.inputs[target] = [1, primitiveFor(input, literal)]
        } else if (child.type === 'data_variable') {
          const [name, varId] = variableField(child)
          block.inputs[target] = [3, [PRIMITIVE.variable, name, varId], primitive]
        } else {
          const childId = emitSingle(child, id)
          block.inputs[target] = childId ? [3, childId, primitive] : [1, primitive]
        }
      }
    }
    return id
  }

  // A stack of blocks along `next`; returns the first emitted block's id. An unmapped block is
  // skipped and the stack closes up around it.
  function emitChain(json, parentId) {
    let firstId = null
    let prevId = null
    let current = json
    while (current) {
      const id = emitSingle(current, prevId ?? parentId)
      if (id) {
        if (prevId) out[prevId].next = id
        else firstId = id
        prevId = id
      }
      current = current.next?.block ?? null
    }
    return firstId
  }

  for (const top of migrated?.blocks?.blocks ?? []) {
    const firstId = emitChain(top, null)
    if (!firstId) continue
    out[firstId].topLevel = true
    out[firstId].x = Math.round(Number(top.x) || 0)
    out[firstId].y = Math.round(Number(top.y) || 0)
  }
  return out
}

/** Sprite names Scratch accepts: unique, non-empty, never "Stage" or a menu keyword. */
export function uniqueSpriteNames(sprites) {
  const used = new Set(['Stage', '_mouse_', '_edge_', '_random_', '_myself_', '_stage_'])
  const names = {}
  for (const sprite of sprites ?? []) {
    const base = String(sprite?.name ?? '').trim() || 'Sprite'
    let name = base
    let n = 2
    while (used.has(name)) name = `${base}${n++}`
    used.add(name)
    names[sprite.id] = name
  }
  return names
}

const ROTATION_STYLES = new Set(['all around', 'left-right', "don't rotate"])

function finiteOr(value, fallback) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/**
 * The whole project.json. `sprites` are [{ id, name, blocksState, costumes, sounds,
 * currentCostume, x, y, size, direction, visible, rotationStyle }] with costumes/sounds already
 * described ({ name, assetId, md5ext, dataFormat, … }); `stage` is { blocksState, costumes,
 * sounds, currentCostume }; `variables` are [{ name, value, showOnStage }].
 * Returns { project, unmapped: [{ opcode, count }] }.
 */
export function buildSb3Project({ sprites = [], stage = {}, variables = [], agent = 'LaunchPad' }) {
  const spriteNames = uniqueSpriteNames(sprites)
  const ctx = createSb3Context({ spriteNames, variables })
  const spriteTargets = sprites.map((sprite, index) => ({
    isStage: false,
    name: spriteNames[sprite.id],
    variables: {},
    lists: {},
    broadcasts: {},
    blocks: translateWorkspaceBlocks(sprite.blocksState, ctx),
    comments: {},
    currentCostume: Math.max(0, Math.min(sprite.currentCostume ?? 0, sprite.costumes.length - 1)),
    costumes: sprite.costumes,
    sounds: sprite.sounds ?? [],
    volume: 100,
    layerOrder: index + 1,
    visible: sprite.visible !== false,
    x: Math.round(finiteOr(sprite.x, 0)),
    y: Math.round(finiteOr(sprite.y, 0)),
    size: finiteOr(sprite.size, 100),
    direction: finiteOr(sprite.direction, 90),
    draggable: false,
    rotationStyle: ROTATION_STYLES.has(sprite.rotationStyle) ? sprite.rotationStyle : 'all around',
  }))
  const stageBlocks = translateWorkspaceBlocks(stage.blocksState, ctx)
  const stageCostumes = stage.costumes ?? []
  const stageTarget = {
    isStage: true,
    name: 'Stage',
    variables: Object.fromEntries(
      [...ctx.variables.entries()].map(([name, { id, value }]) => [id, [name, value]])
    ),
    lists: {},
    broadcasts: Object.fromEntries([...ctx.broadcasts.entries()].map(([name, id]) => [id, name])),
    blocks: stageBlocks,
    comments: {},
    currentCostume: Math.max(0, Math.min(stage.currentCostume ?? 0, stageCostumes.length - 1)),
    costumes: stageCostumes,
    sounds: stage.sounds ?? [],
    volume: 100,
    layerOrder: 0,
    tempo: 60,
    videoTransparency: 50,
    videoState: 'on',
    textToSpeechLanguage: null,
  }
  const shown = new Set(variables.filter((v) => v?.showOnStage).map((v) => String(v.name)))
  const monitors = [...ctx.variables.entries()]
    .filter(([name]) => shown.has(name))
    .map(([name, { id, value }], index) => ({
      id,
      mode: 'default',
      opcode: 'data_variable',
      params: { VARIABLE: name },
      spriteName: null,
      value,
      width: 0,
      height: 0,
      x: 5,
      y: 5 + index * 27,
      visible: true,
      sliderMin: 0,
      sliderMax: 100,
      isDiscrete: true,
    }))
  return {
    project: {
      targets: [stageTarget, ...spriteTargets],
      monitors,
      extensions: [],
      meta: { semver: '3.0.0', vm: '0.2.0', agent },
    },
    unmapped: [...ctx.unmapped.entries()].map(([opcode, count]) => ({ opcode, count })),
  }
}

/** A costume/sound asset description from its bytes' MD5 (see src/shared/md5.js). */
export function describeAsset(hash, dataFormat, extra = {}) {
  return { assetId: hash, md5ext: `${hash}.${dataFormat}`, dataFormat, ...extra }
}
