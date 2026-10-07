// Picks the Scratch blocks `hsc scratch render` draws, and prepares them for rendering.
// Pure: no Blockly, no DOM, no Firebase. The browser side lives in scratch-render/.
//
// A source is one of:
// - a lesson (YAML or JSON file, or fetched from Firestore) plus a task and a field;
// - a bare block state: one sprite's `{ blocks: { blocks: [...] } }`, a whole workspace state
//   keyed by sprite id (the `starterBlocks` / `completeBlocks` shape), or a single root block.

import { flattenTaskTree } from '../src/shared/taskUtils.js'
import {
  getScratchTaskSprites,
  parseScratchBlocksState,
} from '../src/modules/scratch/jsonWorkspace.js'
import {
  migrateBroadcastState,
  migrateVariableFields,
} from '../src/modules/scratch/scratchPersistence.js'

const STAGE_ID = '__stage__'

export function isLesson(data) {
  return Array.isArray(data?.tasks)
}

// A code stage's role, reading legacy names as the classroom does (core/extension → support,
// solution → complete; no role → support).
function stageRole(stage) {
  const role = stage?.role ?? 'support'
  if (role === 'solution') return 'complete'
  if (role === 'core' || role === 'extension') return 'support'
  return role
}

function stageBlocks(task, role, pick = 'first') {
  const stages = (task.codeStages ?? [])
    .map((stage, index) => ({ stage, index }))
    .filter(({ stage }) => stageRole(stage) === role && stage.blocks != null)
  const found = pick === 'last' ? stages.at(-1) : stages[0]
  return found ? { raw: found.stage.blocks, label: `codeStages[${found.index}]` } : null
}

// The finished script: completeBlocks, else the last Complete code stage.
function completeBlocks(task) {
  if (task.completeBlocks != null) return { raw: task.completeBlocks, label: 'completeBlocks' }
  return stageBlocks(task, 'complete', 'last')
}

// What the student starts with: the first Starter code stage, else starterBlocks.
function starterBlocks(task) {
  return (
    stageBlocks(task, 'starter') ??
    (task.starterBlocks != null ? { raw: task.starterBlocks, label: 'starterBlocks' } : null)
  )
}

function defaultBlocks(task) {
  return completeBlocks(task) ?? starterBlocks(task) ?? stageBlocks(task, 'support')
}

// Finds a task by 0-based flat index (as `hsc tasks get` counts) or by task id.
export function findLessonTask(lesson, taskRef) {
  const tasks = flattenTaskTree(lesson.tasks ?? [])
  if (taskRef == null || taskRef === '') {
    const withBlocks = tasks.find((t) => defaultBlocks(t))
    if (!withBlocks) throw new Error('No task in this lesson has Scratch blocks')
    return withBlocks
  }
  const ref = String(taskRef)
  if (/^\d+$/.test(ref)) {
    const task = tasks[Number(ref)]
    if (!task)
      throw new Error(`Task index ${ref} is out of range (lesson has ${tasks.length} tasks)`)
    return task
  }
  const task = tasks.find((t) => t.id === ref)
  if (!task) throw new Error(`No task with id '${ref}'`)
  return task
}

// The raw blocks value for --field: complete | starter | stage:<n> | stack:<id>.
// complete = completeBlocks, else the last Complete stage; starter = the first Starter stage,
// else starterBlocks. With no field: complete, else starter, else the first Support stage.
export function pickTaskBlocks(task, field) {
  if (!field) {
    const found = defaultBlocks(task)
    if (!found) throw new Error(`Task '${task.id}' has no Scratch blocks`)
    return found
  }
  if (field === 'complete' || field === 'starter') {
    const found = field === 'complete' ? completeBlocks(task) : starterBlocks(task)
    if (!found) throw new Error(`Task '${task.id}' has no ${field} blocks`)
    return found
  }
  const stage = /^stage:(\d+)$/.exec(field)
  if (stage) {
    const entry = task.codeStages?.[Number(stage[1])]
    if (!entry?.blocks) throw new Error(`Task '${task.id}' has no codeStages[${stage[1]}].blocks`)
    return { raw: entry.blocks, label: `codeStages[${stage[1]}]` }
  }
  const stack = /^stack:(.+)$/.exec(field)
  if (stack) {
    const entry = (task.prebuiltStacks ?? []).find((s) => s.id === stack[1])
    if (!entry) throw new Error(`Task '${task.id}' has no prebuiltStack '${stack[1]}'`)
    return {
      raw: { blocks: { blocks: [entry.stack] } },
      label: `prebuiltStacks.${stack[1]}`,
      single: true,
    }
  }
  throw new Error(`Unknown --field '${field}'. Use complete, starter, stage:<n> or stack:<id>`)
}

function isSpriteState(value) {
  return Array.isArray(value?.blocks?.blocks)
}

// Splits a stored state into per-sprite states. A state that is already one sprite's
// (or a single root block) belongs to the first sprite, as the workspace loader treats it.
export function splitSpriteStates(raw, sprites) {
  const parsed = parseScratchBlocksState(raw)
  if (!parsed || typeof parsed !== 'object') return {}
  const firstId = sprites[0]?.id ?? 'sprite1'
  if (typeof parsed.type === 'string') return { [firstId]: { blocks: { blocks: [parsed] } } }
  if (isSpriteState(parsed)) return { [firstId]: parsed }
  const states = {}
  for (const [id, value] of Object.entries(parsed)) {
    if (isSpriteState(value)) states[id] = value
  }
  return states
}

function countBlocks(state) {
  return state?.blocks?.blocks?.length ?? 0
}

// Chooses the sprite to draw: --sprite (id or name, or "stage"), else the first with blocks.
export function chooseSprite(states, sprites, spriteRef) {
  if (spriteRef) {
    const ref = String(spriteRef)
    if (ref === STAGE_ID || ref.toLowerCase() === 'stage') {
      if (!states[STAGE_ID]) throw new Error('There are no Stage blocks here')
      return STAGE_ID
    }
    const sprite = sprites.find((s) => s.id === ref || s.name === ref)
    const id = sprite?.id ?? ref
    if (!states[id]) {
      throw new Error(
        `No blocks for sprite '${ref}'. Sprites with blocks: ${Object.keys(states).join(', ') || 'none'}`
      )
    }
    return id
  }
  const ordered = [...sprites.map((s) => s.id), ...Object.keys(states)]
  const id = ordered.find((key) => countBlocks(states[key]) > 0)
  if (!id) throw new Error('There are no blocks to draw')
  return id
}

// Gives every block a readable id that stays the same for the same script, so a video can
// find a block again after the lesson is re-saved:
//   s1, s2 …              top-level stacks, in order
//   s1.2, s1.3 …          the 2nd, 3rd … block of stack 1
//   s1.2/SUBSTACK.1       the 1st block inside the C-block s1.2
//   s1.1/MESSAGE          the reporter or shadow plugged into an input
//   s1.1/MESSAGE~shadow   the hidden shadow when a reporter covers it
// Returns a deep copy; the block's original id (if any) is kept as `sourceId` in the map.
export function assignStableIds(state) {
  const copy = JSON.parse(JSON.stringify(state))
  const map = []
  function visitChain(first, prefix, startIndex) {
    let block = first
    let index = startIndex
    while (block) {
      visitBlock(block, `${prefix}.${index}`)
      block = block.next?.block ?? null
      index += 1
    }
  }
  function visitBlock(block, id) {
    map.push({ id, opcode: block.type, sourceId: block.id ?? null })
    block.id = id
    for (const [name, input] of Object.entries(block.inputs ?? {})) {
      if (/^SUBSTACK\d*$/.test(name)) {
        if (input?.block) visitChain(input.block, `${id}/${name}`, 1)
        continue
      }
      if (input?.block) visitBlock(input.block, `${id}/${name}`)
      if (input?.shadow)
        visitBlock(input.shadow, input.block ? `${id}/${name}~shadow` : `${id}/${name}`)
    }
  }
  const blocks = copy?.blocks?.blocks ?? []
  blocks.forEach((top, i) => {
    let block = top
    let index = 1
    const stack = `s${i + 1}`
    while (block) {
      visitBlock(block, index === 1 ? stack : `${stack}.${index}`)
      block = block.next?.block ?? null
      index += 1
    }
  })
  return { state: copy, blocks: map }
}

// Field values a dropdown must accept for the script to show as written. The app's
// dropdowns list the task's sprites, costumes, backdrops, variables and sounds; a bare
// block file has none of those, so its values are added as extra options.
const CONTEXT_FIELDS = {
  TO: 'sprites',
  TOUCHINGOBJECTMENU: 'sprites',
  DISTANCETOMENU: 'sprites',
  CLONE_OPTION: 'sprites',
  COSTUME: 'costumes',
  BACKDROP: 'backdrops',
  VARIABLE: 'variables',
  SOUND_MENU: 'sounds',
}

export function collectContextValues(state) {
  const found = {
    sprites: new Set(),
    costumes: new Set(),
    backdrops: new Set(),
    variables: new Set(),
    sounds: new Set(),
  }
  function visit(block) {
    if (!block || typeof block !== 'object') return
    for (const [name, raw] of Object.entries(block.fields ?? {})) {
      const kind = CONTEXT_FIELDS[name]
      const value = raw && typeof raw === 'object' ? (raw.name ?? raw.id) : raw
      if (kind && typeof value === 'string' && !/^_.*_$/.test(value)) found[kind].add(value)
    }
    for (const input of Object.values(block.inputs ?? {})) {
      visit(input?.block)
      visit(input?.shadow)
    }
    visit(block.next?.block)
  }
  for (const block of state?.blocks?.blocks ?? []) visit(block)
  return Object.fromEntries(Object.entries(found).map(([k, v]) => [k, [...v]]))
}

// Everything the browser page needs to draw one sprite's script.
export function buildRenderJob({ data, task: taskRef, field, sprite: spriteRef }) {
  let task = null
  let raw = data
  let label = 'blocks'
  if (isLesson(data)) {
    task = findLessonTask(data, taskRef)
    ;({ raw, label } = pickTaskBlocks(task, field))
  } else if (field || taskRef != null) {
    throw new Error('--task and --field need a lesson file or --lesson')
  }
  const sprites = getScratchTaskSprites(task)
  const states = splitSpriteStates(raw, sprites)
  const spriteId = chooseSprite(states, sprites, spriteRef)
  const migrated = migrateVariableFields(migrateBroadcastState(states[spriteId]))
  const { state, blocks } = assignStableIds(migrated)
  return {
    source: { taskId: task?.id ?? null, field: label, spriteId },
    state,
    blocks,
    task: task
      ? {
          sprites: task.sprites ?? [],
          backdrops: task.backdrops ?? [],
          variables: task.variables ?? [],
        }
      : { sprites: [], backdrops: [], variables: [] },
    extraOptions: collectContextValues(state),
  }
}
