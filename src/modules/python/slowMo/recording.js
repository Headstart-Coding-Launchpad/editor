// Python slow-mo recordings (docs/authoring/python.md "Slow-mo"). Pure and Node-safe.
//
// Slow-mo can't pause Python mid-run (that needs SharedArrayBuffer, which GitHub Pages can't
// turn on), so the worker RECORDS the run (pyodide.worker.js, `record`) and the classroom PLAYS
// IT BACK. A recording is:
//
//   {
//     steps: [step],        // one per line the program ran, in order (at most 2,000)
//     output: '',           // everything the run printed, with input() prompts and answers
//     outputCut?: true,     // the output was longer than the recorder keeps
//     loops: [{ line, end, total }],   // every for / while: header line, last body line, and
//                                      // the pass count when the code says it (range(4), [..])
//     turtle?: { epochs: [[command]], states: [turtleState] },   // Turtle drawing (see below)
//     stage?: { commands: [command] },                           // Python Stage drawing
//     status: 'success' | 'error' | 'capped',
//     varsDropped?, drawingDropped?    // set by compactRecording for a Go Live broadcast
//   }
//
// A STEP is "line `l` ran". Its fields are deltas: only what changed since the step before.
//   l    the editor line (the runtime's prefix lines are already taken off)
//   k    call depth (0 = the top level, 1 = inside a function called from it, …)
//   s    { name: valueNode } variables that are new or changed after the line ran
//   d    [name] variables that went away (a function returned)
//   c    the function the program is now inside (null = the top level); only when it changed
//   o    how many characters of `output` existed after the line ran
//   t/te the Turtle drawing: `turtle.epochs[te].slice(0, t)` (reset() starts a new epoch)
//   ts   index into turtle.states: where the 🐢 is and which way it faces
//   g    the Stage drawing: `stage.commands.slice(0, g)`
//
// A POSITION p (0…steps.length) is how many steps have been played: 0 is "nothing has run yet",
// p shows steps[p - 1] as the line that just ran, with all its effects.
import { formatValue } from '../../../shared/variablesPanel/variablesPanel.js'
import { PYTHON_SLOW_MO_MAX_STEPS, clampPythonSlowMoSpeed } from './config.js'

// How many earlier values a name tag keeps (shown struck through).
export const SLOW_MO_HISTORY = 3
// The largest recording a Go Live broadcast carries (as JSON); compactRecording shrinks it.
export const SLOW_MO_LIVE_BUDGET = 300_000
export const SLOW_MO_STATUSES = Object.freeze(['success', 'error', 'capped'])

const MARK_KEYS = ['o', 't', 'te', 'ts', 'g']
const INITIAL_MARKS = Object.freeze({ o: 0, t: 0, te: 0, ts: -1, g: 0 })

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

// Arrays, tolerating the realtime database's numbered-object form.
function listOf(value) {
  if (Array.isArray(value)) return value
  if (isPlainObject(value)) {
    return Object.keys(value)
      .filter((key) => /^\d+$/.test(key))
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => value[key])
  }
  return []
}

const wholeAtLeast = (value, min) => Number.isInteger(value) && value >= min

function readStep(raw) {
  if (!isPlainObject(raw) || !wholeAtLeast(raw.l, 1)) return null
  const step = { l: raw.l, k: wholeAtLeast(raw.k, 0) ? raw.k : 0 }
  if (isPlainObject(raw.s)) step.s = raw.s
  const gone = listOf(raw.d).filter((name) => typeof name === 'string' && name)
  if (gone.length > 0) step.d = gone
  if ('c' in raw) step.c = typeof raw.c === 'string' && raw.c ? raw.c : null
  for (const key of MARK_KEYS) {
    if (wholeAtLeast(raw[key], key === 'ts' ? -1 : 0)) step[key] = raw[key]
  }
  return step
}

function readLoop(raw) {
  if (!isPlainObject(raw) || !wholeAtLeast(raw.line, 1)) return null
  const end = wholeAtLeast(raw.end, raw.line) ? raw.end : raw.line
  return { line: raw.line, end, total: wholeAtLeast(raw.total, 0) ? raw.total : null }
}

/**
 * A recording from the worker or a Go Live broadcast, checked and normalised (see the shape
 * above), or null when it isn't one. Steps past the 2,000 cap are dropped.
 */
export function readRecording(raw) {
  if (!isPlainObject(raw)) return null
  const steps = listOf(raw.steps).map(readStep).filter(Boolean)
  const tooMany = steps.length > PYTHON_SLOW_MO_MAX_STEPS
  const turtle = isPlainObject(raw.turtle)
    ? {
        epochs: listOf(raw.turtle.epochs).map((epoch) => listOf(epoch)),
        states: listOf(raw.turtle.states).filter(isPlainObject),
      }
    : null
  const stage = isPlainObject(raw.stage) ? { commands: listOf(raw.stage.commands) } : null
  const status = SLOW_MO_STATUSES.includes(raw.status) ? raw.status : 'success'
  return {
    id: typeof raw.id === 'string' ? raw.id : null,
    steps: tooMany ? steps.slice(0, PYTHON_SLOW_MO_MAX_STEPS) : steps,
    output: typeof raw.output === 'string' ? raw.output : '',
    outputCut: raw.outputCut === true,
    loops: listOf(raw.loops).map(readLoop).filter(Boolean),
    turtle,
    stage,
    status: tooMany ? 'capped' : status,
    varsDropped: raw.varsDropped === true,
    drawingDropped: raw.drawingDropped === true,
  }
}

// ─── Loop pass counter ───────────────────────────────────────────────────────

// The first step after `index` back at depth `depth` or shallower (skipping a call's lines).
function nextAtDepth(steps, index, depth) {
  for (let j = index + 1; j < steps.length; j++) {
    if (steps[j].k <= depth) return steps[j]
  }
  return null
}

/**
 * For every step, the loops the program is inside and which pass each is on:
 * `[[{ line, pass, total, done }]]` (one list per step). `line` is the loop's header line,
 * `total` its pass count when the code says it (null otherwise), and `done` marks the step where
 * the header ran one last time and the loop finished.
 *
 * A pass starts each time the header line runs and the next line (at the same call depth) is
 * inside the loop's body. Leaving the body (a break, or the end) or returning from the function
 * ends the loop; running into its header again from outside starts the count again. Loops in a
 * caller stay listed while a function it called runs.
 */
export function computeLoopPasses(steps, loops) {
  const list = Array.isArray(steps) ? steps : []
  const byLine = new Map((Array.isArray(loops) ? loops : []).map((loop) => [loop.line, loop]))
  let active = []
  const out = []
  list.forEach((step, index) => {
    const depth = step.k ?? 0
    active = active.filter(
      (entry) =>
        entry.depth < depth ||
        (entry.depth === depth && step.l >= entry.loop.line && step.l <= entry.loop.end)
    )
    let finished = null
    const loop = byLine.get(step.l)
    if (loop) {
      let entry = active.find((item) => item.loop === loop && item.depth === depth)
      if (!entry) {
        entry = { loop, depth, count: 0 }
        active.push(entry)
      }
      const next = nextAtDepth(list, index, depth)
      const intoBody = !!next && next.k === depth && next.l > loop.line && next.l <= loop.end
      if (intoBody) {
        entry.count += 1
      } else {
        finished = entry
        active = active.filter((item) => item !== entry)
      }
    }
    const shown = active
      .filter((entry) => entry.count > 0)
      .map((entry) => ({
        line: entry.loop.line,
        pass: entry.count,
        total: entry.loop.total,
        done: false,
      }))
    if (finished) {
      shown.push({
        line: finished.loop.line,
        pass: finished.count,
        total: finished.loop.total,
        done: true,
      })
    }
    out.push(shown)
  })
  return out
}

/** The words on a loop's header line: "pass 3 of 4", "pass 3", "finished: 4 passes". */
export function passLabel({ pass, total, done }) {
  if (done) {
    if (pass === 0) return 'no passes'
    return `finished: ${pass} ${pass === 1 ? 'pass' : 'passes'}`
  }
  return Number.isInteger(total) ? `pass ${pass} of ${total}` : `pass ${pass}`
}

// ─── The step model ──────────────────────────────────────────────────────────

/**
 * Everything playback reads, worked out once per recording: `{ recording, count, marks, passes }`.
 * `marks[p]` is { o, t, te, ts, g } after p steps (marks[0] is before any), and `passes[p - 1]`
 * the loop passes of step p.
 */
export function buildSlowMoModel(recording) {
  const rec = readRecording(recording)
  if (!rec) return null
  const marks = [INITIAL_MARKS]
  let current = INITIAL_MARKS
  for (const step of rec.steps) {
    let next = current
    for (const key of MARK_KEYS) {
      if (step[key] !== undefined && step[key] !== current[key]) {
        if (next === current) next = { ...current }
        next[key] = step[key]
      }
    }
    marks.push(next)
    current = next
  }
  return {
    recording: rec,
    count: rec.steps.length,
    marks,
    passes: computeLoopPasses(rec.steps, rec.loops),
  }
}

export function clampPosition(model, position) {
  const count = model?.count ?? 0
  const p = Number.isFinite(position) ? Math.trunc(position) : 0
  return Math.min(count, Math.max(0, p))
}

/**
 * The variables after `position` steps: `{ snapshot: { vars, scope }, changed: [name],
 * history: { name: [earlier value nodes, newest first] } }`. `changed` lists the names the last
 * step set (a new name counts as changed). `snapshot` is null when the recording carries no
 * variables (dropped to fit a Go Live broadcast).
 */
export function variablesAt(model, position) {
  if (!model || model.recording.varsDropped) return { snapshot: null, changed: [], history: {} }
  const p = clampPosition(model, position)
  const { steps } = model.recording
  const current = new Map()
  const history = new Map()
  let scope = null
  for (let i = 0; i < p; i++) {
    const step = steps[i]
    for (const name of step.d ?? []) {
      current.delete(name)
      history.delete(name)
    }
    for (const [name, node] of Object.entries(step.s ?? {})) {
      if (current.has(name)) {
        history.set(
          name,
          [current.get(name), ...(history.get(name) ?? [])].slice(0, SLOW_MO_HISTORY)
        )
      }
      current.set(name, node)
    }
    if ('c' in step) scope = step.c
  }
  return {
    snapshot: { vars: [...current].map(([n, v]) => ({ n, v })), scope },
    changed: p > 0 ? Object.keys(steps[p - 1].s ?? {}) : [],
    history: Object.fromEntries(history),
  }
}

/** The output printed by `position` steps (all of it, with any error, once playback ends). */
export function outputAt(model, position) {
  if (!model) return ''
  const p = clampPosition(model, position)
  const { output } = model.recording
  if (p >= model.count) return output
  return output.slice(0, model.marks[p].o)
}

/** The line that just ran at `position` (null before the first step). */
export function lineAt(model, position) {
  if (!model) return null
  const p = clampPosition(model, position)
  return p > 0 ? model.recording.steps[p - 1].l : null
}

/** The loop passes shown at `position` (see computeLoopPasses). */
export function passesAt(model, position) {
  if (!model) return []
  const p = clampPosition(model, position)
  return p > 0 ? (model.passes[p - 1] ?? []) : []
}

/** The Turtle drawing at `position`: `{ commands, state }`, or null for a run that never drew. */
export function turtleAt(model, position) {
  const turtle = model?.recording.turtle
  if (!turtle) return null
  const marks = model.marks[clampPosition(model, position)]
  const epoch = turtle.epochs[marks.te] ?? []
  return { commands: epoch.slice(0, marks.t), state: turtle.states[marks.ts] ?? null }
}

/** The Stage commands drawn by `position`, or null for a run with no Stage drawing. */
export function stageAt(model, position) {
  const stage = model?.recording.stage
  if (!stage) return null
  return stage.commands.slice(0, model.marks[clampPosition(model, position)].g)
}

/**
 * Screen-reader words for a position, e.g. "Step 4 of 12: line 3 ran. total is now 11 (was 4).
 * Loop on line 2: pass 2 of 4."
 */
export function describePosition(model, position) {
  if (!model) return ''
  const p = clampPosition(model, position)
  if (p === 0) return `Ready to play ${model.count} ${model.count === 1 ? 'step' : 'steps'}.`
  const parts = [`Step ${p} of ${model.count}: line ${lineAt(model, p)} ran.`]
  const { snapshot, changed, history } = variablesAt(model, p)
  for (const name of changed) {
    const node = snapshot?.vars.find((entry) => entry.n === name)?.v
    if (!node) continue
    const was = history[name]?.[0]
    parts.push(
      `${name} is now ${formatValue(node, { maxChars: 60 })}${was ? ` (was ${formatValue(was, { maxChars: 60 })})` : ''}.`
    )
  }
  for (const pass of passesAt(model, p))
    parts.push(`Loop on line ${pass.line}: ${passLabel(pass)}.`)
  if (p === model.count) parts.push('That was the last step.')
  return parts.join(' ')
}

// ─── Playback ────────────────────────────────────────────────────────────────

export const SLOW_MO_MODES = Object.freeze(['idle', 'playing', 'paused', 'finished'])

export function initialPlayback(speed = 1) {
  return { position: 0, count: 0, mode: 'idle', speed: clampPythonSlowMoSpeed(speed) }
}

function settle(state, position, mode) {
  const p = Math.min(state.count, Math.max(0, position))
  return { ...state, position: p, mode: p >= state.count && mode !== 'idle' ? 'finished' : mode }
}

/**
 * The playback state machine: `{ position, count, mode, speed }`.
 *   load { count, play, step }  a new recording: position 0, playing (play), or one step in (step)
 *   play     play from here (from the start once finished)
 *   pause    stop on this step
 *   step     one line forward, then pause
 *   back     one line back, then pause
 *   restart  back to before the first line, paused
 *   tick     the timer: one line forward while playing
 *   seek { position, mode }   a Go Live viewer following the presenter
 *   speed { speed }           steps per second, clamped to 0.25–4
 *   clear    no recording (editing the code ends slow-mo)
 */
export function playbackReducer(state, action) {
  switch (action?.type) {
    case 'load': {
      const count = Math.max(0, Math.trunc(action.count) || 0)
      const base = { ...state, count, position: 0 }
      if (action.step) return settle(base, 1, 'paused')
      return settle(base, 0, action.play ? 'playing' : 'paused')
    }
    case 'play':
      if (state.mode === 'idle') return state
      return settle(state, state.position >= state.count ? 0 : state.position, 'playing')
    case 'pause':
      return state.mode === 'playing' ? { ...state, mode: 'paused' } : state
    case 'step':
      if (state.mode === 'idle') return state
      return settle(state, state.position + 1, 'paused')
    case 'back':
      if (state.mode === 'idle') return state
      return { ...state, position: Math.max(0, state.position - 1), mode: 'paused' }
    case 'restart':
      if (state.mode === 'idle') return state
      return { ...state, position: 0, mode: 'paused' }
    case 'tick':
      if (state.mode !== 'playing') return state
      return settle(state, state.position + 1, 'playing')
    case 'seek': {
      const count = Number.isInteger(action.count) ? action.count : state.count
      const mode = SLOW_MO_MODES.includes(action.mode) ? action.mode : 'paused'
      const position = Math.min(count, Math.max(0, Math.trunc(action.position) || 0))
      return { ...state, count, position, mode }
    }
    case 'speed':
      return { ...state, speed: clampPythonSlowMoSpeed(action.speed) }
    case 'clear':
      return { ...state, position: 0, count: 0, mode: 'idle' }
    default:
      return state
  }
}

// ─── Go Live size budget ─────────────────────────────────────────────────────

function byteLength(text) {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text).length
  return text.length * 2
}

const SHRUNK_TEXT = 40
const SHRUNK_ITEMS = 5

// A value node with less detail: short text, a few items, nothing nested.
export function shrinkValueNode(node, depth = 0) {
  if (!isPlainObject(node)) return node
  if (node.t === 'str') {
    const v = String(node.v ?? '')
    if (v.length <= SHRUNK_TEXT) return node
    return { t: 'str', v: v.slice(0, SHRUNK_TEXT), more: (node.more ?? 0) + v.length - SHRUNK_TEXT }
  }
  if (node.t === 'obj') return { ...node, r: String(node.r ?? '').slice(0, SHRUNK_TEXT) }
  if (['list', 'tuple', 'set', 'dict'].includes(node.t)) {
    const items = listOf(node.items)
    const len = Number.isFinite(node.len) ? node.len : items.length
    if (depth >= 1) return { t: node.t, len, items: [], cut: true }
    const kept = items
      .slice(0, SHRUNK_ITEMS)
      .map((item) =>
        node.t === 'dict'
          ? { k: shrinkValueNode(item?.k, depth + 1), v: shrinkValueNode(item?.v, depth + 1) }
          : shrinkValueNode(item, depth + 1)
      )
    return kept.length < len || node.cut
      ? { t: node.t, len, items: kept, cut: true }
      : { t: node.t, len, items: kept }
  }
  return node
}

function shrinkValues(rec) {
  return {
    ...rec,
    steps: rec.steps.map((step) =>
      step.s
        ? {
            ...step,
            s: Object.fromEntries(
              Object.entries(step.s).map(([name, node]) => [name, shrinkValueNode(node)])
            ),
          }
        : step
    ),
  }
}

function dropVars(rec) {
  return {
    ...rec,
    varsDropped: true,
    steps: rec.steps.map(({ s: _s, d: _d, c: _c, ...rest }) => rest),
  }
}

function dropDrawing(rec) {
  return { ...rec, turtle: null, stage: null, drawingDropped: true }
}

const CUT_OUTPUT = 20_000

function cutOutput(rec) {
  if (rec.output.length <= CUT_OUTPUT) return rec
  return { ...rec, output: rec.output.slice(0, CUT_OUTPUT), outputCut: true }
}

/**
 * A recording small enough for a Go Live broadcast: `{ recording, json, level }`, where `json`
 * (what is sent) is at most `budget` bytes. It gives up detail in this order until it fits:
 * 0 nothing; 1 shorter values (40 characters, 5 items, nothing nested); 2 no variables at all;
 * 3 no drawing; 4 the output cut to 20,000 characters; 5 fewer steps (it stops early, as if
 * capped). Never throws.
 */
export function compactRecording(recording, budget = SLOW_MO_LIVE_BUDGET) {
  const base = readRecording(recording)
  if (!base) return null
  const levels = [(rec) => rec, shrinkValues, dropVars, dropDrawing, cutOutput]
  let current = base
  for (let level = 0; level < levels.length; level++) {
    current = levels[level](current)
    const json = JSON.stringify(current)
    if (byteLength(json) <= budget) return { recording: current, json, level }
  }
  // Fewer steps, with only the output those steps printed.
  const marks = buildSlowMoModel(current).marks
  let keep = current.steps.length
  while (keep > 0) {
    keep = Math.floor(keep / 2)
    const cut = {
      ...current,
      steps: current.steps.slice(0, keep),
      output: current.output.slice(0, marks[keep].o),
      status: 'capped',
    }
    const json = JSON.stringify(cut)
    if (byteLength(json) <= budget) return { recording: cut, json, level: 5 }
  }
  const empty = { ...current, steps: [], output: '', status: 'capped' }
  return { recording: empty, json: JSON.stringify(empty), level: 5 }
}
