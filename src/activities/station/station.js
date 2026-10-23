// Pure model for the Space station activity (docs/architecture/station-activity.md): the layout,
// the parts catalogue, the scene a lesson starts from, the actions a student can take, goal
// marking (with the method used), validation and grading. Node-safe: no React, JSX or DOM.
// Placeholder art lives in ./art.js so swapping it never touches this file.

import { coreCountOf, validateCoreItems } from '../round.js'

// --- Layout (in code, not authored) ---

export const PHASE_1_LESSONS = [1, 2, 3, 4]

export const SECTIONS = Object.freeze([
  { id: 'core', label: 'Core' },
  { id: 'left', label: 'Left wing' },
  { id: 'right', label: 'Right wing' },
  { id: 'dock', label: 'Dock' },
])

// The station is drawn in a 2:1 box (see .act-station__scene). Spots and posts are the centres of
// their pads, as 0-1 fractions of that box, placed on the hull and the modules in the drawing:
// hull strips at the far left and right (5 and 6), the wings (1-4, 7-10), crew posts in the core.
export const SCENE_ASPECT = 2
const SPOT_W = 0.062
const SPOT_H = SPOT_W * SCENE_ASPECT
const SPOT_ACCEPTS = Object.freeze(['module', 'crate', 'crew'])
const SPOT_CENTRES = [
  [0.14, 0.36],
  [0.26, 0.36],
  [0.74, 0.36],
  [0.86, 0.36],
  [0.05, 0.5],
  [0.95, 0.5],
  [0.14, 0.64],
  [0.26, 0.64],
  [0.74, 0.64],
  [0.86, 0.64],
]
export const SPOTS = Object.freeze(
  SPOT_CENTRES.map(([cx, cy], i) =>
    Object.freeze({
      id: `spot-${i + 1}`,
      x: cx - SPOT_W / 2,
      y: cy - SPOT_H / 2,
      w: SPOT_W,
      h: SPOT_H,
      accepts: SPOT_ACCEPTS,
    })
  )
)
// How far (as a fraction of the station's width) from a spot's centre a dropped part still snaps
// into it. Spots are small, so this is much bigger than the spot itself.
export const SPOT_SNAP_RADIUS = 0.09

export const POSTS = Object.freeze([
  { id: 'post-1', x: 0.44, y: 0.5 },
  { id: 'post-2', x: 0.56, y: 0.5 },
  { id: 'post-3', x: 0.44, y: 0.66 },
  { id: 'post-4', x: 0.56, y: 0.66 },
])

export const HULL_COLOURS = Object.freeze([
  'blue',
  'red',
  'green',
  'purple',
  'orange',
  'yellow',
  'pink',
  'silver',
])
export const LIGHT_COLOURS = Object.freeze([
  'orange',
  'yellow',
  'white',
  'green',
  'blue',
  'pink',
  'red',
  'purple',
])
export const COLOUR_TARGETS = Object.freeze({ hull: HULL_COLOURS, lights: LIGHT_COLOURS })

// --- Parts catalogue ---

const part = (id, label, kind, lesson) => Object.freeze({ id, label, kind, lesson, cells: [1, 1] })
export const PARTS = Object.freeze([
  part('crate-1', 'Crate 1', 'crate', 2),
  part('crate-2', 'Crate 2', 'crate', 2),
  part('crate-3', 'Crate 3', 'crate', 2),
  part('crew-robot', 'Robot', 'crew', 2),
  part('crew-pilot', 'Pilot', 'crew', 2),
  part('crew-plant', 'Plant', 'crew', 2),
  part('solar', 'Solar panel', 'module', 3),
  part('dome', 'Dome', 'module', 3),
  part('greenhouse', 'Greenhouse', 'module', 3),
  part('docking-arm', 'Docking arm', 'module', 3),
  part('telescope', 'Telescope', 'module', 4),
  part('dish', 'Radio dish', 'module', 4),
  part('flag', 'Flag', 'module', 4),
  part('antenna', 'Antenna', 'module', 4),
  part('lab', 'Lab', 'module', 4),
  part('rocket-pad', 'Rocket pad', 'module', 4),
  part('space-slide', 'Space slide', 'module', 4),
])
const PART_BY_ID = Object.fromEntries(PARTS.map((p) => [p.id, p]))
export const partById = (id) => PART_BY_ID[id] ?? null

// Each crate holds one crew member.
export const CRATE_CREW = Object.freeze({
  'crate-1': 'crew-robot',
  'crate-2': 'crew-pilot',
  'crate-3': 'crew-plant',
})
export const CRATE_IDS = Object.freeze(Object.keys(CRATE_CREW))
export const CREW_IDS = Object.freeze(Object.values(CRATE_CREW))

// What each lesson adds. `catalogue` is the part list on offer (tray or catalogue; the best part
// of Lesson 4 is last, at the very bottom). `defaults` is where those parts sit by default once
// the lesson is behind the child (catch-up for a missed lesson).
export const LESSON = Object.freeze({
  1: Object.freeze({ title: 'Power Up', catalogue: [], defaults: {} }),
  2: Object.freeze({ title: 'Special Delivery', catalogue: [], defaults: {} }),
  3: Object.freeze({
    title: 'Build It',
    catalogue: ['solar', 'dome', 'greenhouse', 'docking-arm'],
    defaults: { solar: 'spot-1', dome: 'spot-3', greenhouse: 'spot-8', 'docking-arm': 'spot-6' },
  }),
  4: Object.freeze({
    title: 'The Catalogue',
    catalogue: ['telescope', 'dish', 'flag', 'antenna', 'lab', 'rocket-pad', 'space-slide'],
    defaults: { telescope: 'spot-2', dish: 'spot-4', flag: 'spot-9' },
  }),
})

// --- Goals ---

export const METHODS = Object.freeze([
  'click',
  'keyboard',
  'double_click',
  'drag',
  'pick_drop',
  'ctrl_z',
  'cmd_z',
])

// target: what `target` may be ('section', 'colour', 'part', 'crate', or 'none'); methods: the
// methods that complete it; lessons: where it can be set.
export const GOALS = Object.freeze({
  power_on: { label: 'Power on', target: 'section', methods: ['click', 'keyboard'], lessons: [1] },
  pick_colour: {
    label: 'Pick a colour',
    target: 'colour',
    methods: ['click', 'keyboard'],
    lessons: [1],
  },
  select: { label: 'Select a part', target: 'part', methods: ['click'], lessons: [2, 3, 4] },
  open_crate: { label: 'Open a crate', target: 'crate', methods: ['double_click'], lessons: [2] },
  choose_captain: { label: 'Choose a captain', target: 'none', methods: ['click'], lessons: [2] },
  place_part: {
    label: 'Place a part',
    target: 'part',
    methods: ['drag', 'pick_drop'],
    lessons: [3, 4],
  },
  undo: { label: 'Undo', target: 'none', methods: ['ctrl_z', 'cmd_z'], lessons: [3, 4] },
  order_part: { label: 'Order a part', target: 'part', methods: ['click'], lessons: [4] },
})
export const GOAL_IDS = Object.freeze(Object.keys(GOALS))

export const UNDO_LIMIT = 15

// --- Scene ---

const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj ?? {}, key)
const clone = (value) => JSON.parse(JSON.stringify(value))

function emptyScene() {
  return {
    hull: 'blue',
    lights: 'orange',
    power: Object.fromEntries(SECTIONS.map((s) => [s.id, false])),
    placed: {},
    crates: {},
    crew: {},
    captain: null,
    ordered: [],
  }
}

function freeSpot(scene, preferred, kind = 'module') {
  const ok = (id) => {
    const spot = SPOTS.find((s) => s.id === id)
    return spot && spot.accepts.includes(kind) && !own(scene.placed, id)
  }
  if (preferred && ok(preferred)) return preferred
  return SPOTS.find((s) => ok(s.id))?.id ?? null
}

function isPlaced(scene, partId) {
  return Object.values(scene?.placed ?? {}).includes(partId)
}

// Everything lesson `k` leaves behind it, added to a scene in a default place when missing.
function finishLesson(scene, k) {
  if (k === 1) {
    for (const s of SECTIONS) scene.power[s.id] = true
  } else if (k === 2) {
    for (const crate of CRATE_IDS) scene.crates[crate] = 'open'
    for (const crew of CREW_IDS) {
      if (!own(scene.crew, crew)) {
        const taken = new Set(Object.values(scene.crew))
        const post = POSTS.find((p) => !taken.has(p.id))
        if (post) scene.crew[crew] = post.id
      }
    }
    if (!scene.captain) scene.captain = CREW_IDS[0]
  } else if (LESSON[k]?.defaults) {
    for (const [partId, spotId] of Object.entries(LESSON[k].defaults)) {
      if (isPlaced(scene, partId)) continue
      const spot = freeSpot(scene, spotId)
      if (spot) scene.placed[spot] = partId
    }
    scene.ordered = scene.ordered.filter((id) => !isPlaced(scene, id))
  }
}

// What lesson `n` adds when it starts.
function startLesson(scene, n) {
  if (n === 2) {
    for (const crate of CRATE_IDS) if (!own(scene.crates, crate)) scene.crates[crate] = 'closed'
  }
}

function completeScene(scene, n) {
  for (let k = 1; k < n; k += 1) finishLesson(scene, k)
  startLesson(scene, n)
  return scene
}

// The default scene for lesson n: lessons 1..n-1 are done in default places, then lesson n's setup.
export function sceneForLesson(n) {
  return completeScene(emptyScene(), PHASE_1_LESSONS.includes(n) ? n : 1)
}

// Keeps only well-formed saved data, so a bad or old saved scene can never break the station.
function sanitiseScene(raw) {
  const scene = emptyScene()
  if (!raw || typeof raw !== 'object') return scene
  if (HULL_COLOURS.includes(raw.hull)) scene.hull = raw.hull
  if (LIGHT_COLOURS.includes(raw.lights)) scene.lights = raw.lights
  for (const s of SECTIONS) scene.power[s.id] = raw.power?.[s.id] === true
  const spotIds = new Set(SPOTS.map((s) => s.id))
  const used = new Set()
  for (const [spot, id] of Object.entries(raw.placed ?? {})) {
    if (spotIds.has(spot) && partById(id)?.kind === 'module' && !used.has(id)) {
      scene.placed[spot] = id
      used.add(id)
    }
  }
  for (const crate of CRATE_IDS) {
    if (raw.crates?.[crate] === 'open' || raw.crates?.[crate] === 'closed') {
      scene.crates[crate] = raw.crates[crate]
    }
  }
  const postIds = new Set(POSTS.map((p) => p.id))
  const posts = new Set()
  for (const crew of CREW_IDS) {
    const post = raw.crew?.[crew]
    if (postIds.has(post) && !posts.has(post)) {
      scene.crew[crew] = post
      posts.add(post)
    }
  }
  if (CREW_IDS.includes(raw.captain) && own(scene.crew, raw.captain)) scene.captain = raw.captain
  if (Array.isArray(raw.ordered)) {
    scene.ordered = raw.ordered.filter(
      (id, i) => partById(id)?.kind === 'module' && raw.ordered.indexOf(id) === i && !used.has(id)
    )
  }
  return scene
}

// The saved scene wins; anything earlier lessons unlock that it lacks is added in a default place
// (catch-up after a missed lesson); this lesson's setup is added if missing. Pure and idempotent.
// `carried` is { v: 1, scene } (or just the scene). Returns a scene.
export function applyCarried(task, carried) {
  const n = PHASE_1_LESSONS.includes(task?.lesson) ? task.lesson : 1
  const raw = carried && typeof carried === 'object' && 'scene' in carried ? carried.scene : carried
  return completeScene(sanitiseScene(raw), n)
}

// --- Catalogue and tray ---

// The part ids on offer for a task (its own `catalogue`, else the lesson's list).
export function catalogueFor(task) {
  if (Array.isArray(task?.catalogue) && task.catalogue.length) return task.catalogue
  return LESSON[task?.lesson]?.catalogue ?? []
}

// Parts waiting to be placed: Lesson 3 shows the whole tray, Lesson 4 what was ordered.
export function trayParts(task, scene) {
  let waiting = []
  if (task?.lesson === 4) waiting = scene?.ordered ?? []
  else if (task?.lesson === 3) waiting = catalogueFor(task)
  return waiting.filter((id) => !isPlaced(scene, id))
}

// The empty spot that accepts `kind` nearest a dropped point (fractions 0-1), within the snap
// radius; null when none, so the part goes back to the tray.
export function nearestSpot(scene, point, kind = 'module', radius = SPOT_SNAP_RADIUS) {
  let best = null
  let bestDistance = radius
  for (const spot of SPOTS) {
    if (own(scene?.placed, spot.id) || !spot.accepts.includes(kind)) continue
    // y is a fraction of the height, which is half the width: scale it so distance is true to the eye.
    const d = Math.hypot(
      point.x - (spot.x + spot.w / 2),
      (point.y - (spot.y + spot.h / 2)) / SCENE_ASPECT
    )
    if (d <= bestDistance) {
      best = spot.id
      bestDistance = d
    }
  }
  return best
}

// --- State and actions ---

export function initialStationState(task, scene = null) {
  return {
    v: 1,
    scene: scene ?? sceneForLesson(task?.lesson),
    done: {},
    selected: null,
    undo: [],
    device: { touch: false },
  }
}

const goalItems = (task) => (Array.isArray(task?.items) ? task.items : [])

// Does this action finish this goal item? Returns the record to store, or null. `scene` is the
// scene after the action.
function completes(item, action, scene) {
  const goal = GOALS[item.goal]
  if (!goal) return null
  const method = action.method
  if (!goal.methods.includes(method)) return null
  const mark = { method, at: action.at ?? Date.now() }
  const target = item.target
  switch (item.goal) {
    case 'power_on':
      if (action.type !== 'power') return null
      if (target) return action.section === target || action.section === 'all' ? mark : null
      return SECTIONS.every((s) => scene.power[s.id]) ? mark : null
    case 'pick_colour':
      return action.type === 'colour' && action.target === target ? mark : null
    case 'select':
      return action.type === 'select' && action.id && (!target || action.id === target)
        ? mark
        : null
    case 'open_crate':
      return action.type === 'open' && (!target || action.crate === target) ? mark : null
    case 'choose_captain':
      return action.type === 'captain' ? mark : null
    case 'place_part':
      return action.type === 'place' && (!target || action.part === target) ? mark : null
    case 'undo':
      return action.type === 'undo' ? mark : null
    case 'order_part':
      return action.type === 'order' && (!target || action.part === target)
        ? { ...mark, scrolled: action.scrolled === true }
        : null
    default:
      return null
  }
}

function markGoals(state, task, action) {
  let done = state.done
  for (const item of goalItems(task)) {
    if (!item?.id || own(done, item.id)) continue
    const mark = completes(item, action, state.scene)
    if (mark) done = { ...done, [item.id]: mark }
  }
  return done === state.done ? state : { ...state, done }
}

function pushUndo(state, scene) {
  return { ...state, undo: [...state.undo, state.scene].slice(-UNDO_LIMIT), scene }
}

// action: { type: 'power', section | 'all', method } | { type: 'colour', target, colour, method }
// | { type: 'select', id | null, method } | { type: 'open', crate, method }
// | { type: 'captain', crew, method } | { type: 'place', part, spot, method }
// | { type: 'order', part, scrolled?, method } | { type: 'undo', method }. Each also takes an
// optional `at` (ms). An action that cannot happen returns the state unchanged. Every scene
// change pushes the earlier scene onto `undo` (at most UNDO_LIMIT).
export function stationAction(state, action, task) {
  const base =
    state && state.scene
      ? { ...state, undo: state.undo ?? [], done: state.done ?? {} }
      : initialStationState(task)
  const scene = base.scene
  let next
  switch (action?.type) {
    case 'power': {
      const ids = action.section === 'all' ? SECTIONS.map((s) => s.id) : [action.section]
      if (!ids.every((id) => SECTIONS.some((s) => s.id === id))) return state ?? base
      const power = { ...scene.power }
      for (const id of ids) power[id] = true
      next = pushUndo(base, { ...clone(scene), power })
      break
    }
    case 'colour': {
      if (!COLOUR_TARGETS[action.target]?.includes(action.colour)) return state ?? base
      next = pushUndo(base, { ...clone(scene), [action.target]: action.colour })
      break
    }
    case 'select': {
      if (action.id != null && !partById(action.id)) return state ?? base
      next = { ...base, selected: action.id ?? null }
      break
    }
    case 'open': {
      if (scene.crates[action.crate] !== 'closed') return state ?? base
      const opened = clone(scene)
      opened.crates[action.crate] = 'open'
      const crew = CRATE_CREW[action.crate]
      const taken = new Set(Object.values(opened.crew))
      const post = POSTS.find((p) => !taken.has(p.id))
      if (crew && post) opened.crew[crew] = post.id
      next = pushUndo(base, opened)
      break
    }
    case 'captain': {
      if (!CREW_IDS.includes(action.crew) || !own(scene.crew, action.crew)) return state ?? base
      next = pushUndo(base, { ...clone(scene), captain: action.crew })
      break
    }
    case 'place': {
      const p = partById(action.part)
      const spot = SPOTS.find((s) => s.id === action.spot)
      if (!p || p.kind !== 'module' || !spot || !spot.accepts.includes(p.kind)) {
        return state ?? base
      }
      if (own(scene.placed, spot.id)) return state ?? base
      const available = trayParts(task, scene).includes(p.id) || isPlaced(scene, p.id)
      if (!available) return state ?? base
      const placed = clone(scene)
      for (const [id, partId] of Object.entries(placed.placed)) {
        if (partId === p.id) delete placed.placed[id]
      }
      placed.placed[spot.id] = p.id
      placed.ordered = placed.ordered.filter((id) => id !== p.id)
      next = pushUndo(base, placed)
      break
    }
    case 'order': {
      const p = partById(action.part)
      if (!p || p.kind !== 'module' || !catalogueFor(task).includes(p.id)) return state ?? base
      if (scene.ordered.includes(p.id) || isPlaced(scene, p.id)) return state ?? base
      next = pushUndo(base, { ...clone(scene), ordered: [...scene.ordered, p.id] })
      break
    }
    case 'undo': {
      if (!base.undo.length) return state ?? base
      next = { ...base, undo: base.undo.slice(0, -1), scene: base.undo[base.undo.length - 1] }
      break
    }
    default:
      return state ?? base
  }
  return markGoals(next, task, action)
}

// --- Validation ---

const GOAL_TARGET_WORDS = {
  section: 'a power section (core, left, right or dock)',
  colour: 'hull or lights',
  part: 'a part id from the parts catalogue',
  crate: 'a crate id (crate-1, crate-2 or crate-3)',
}

function targetIsValid(kind, target) {
  if (kind === 'section') return SECTIONS.some((s) => s.id === target)
  if (kind === 'colour') return target === 'hull' || target === 'lights'
  if (kind === 'crate') return CRATE_IDS.includes(target)
  if (kind === 'part') return !!partById(target)
  return false
}

export function validateStationTask(task, n) {
  const errors = []
  const where = `Task ${n}`
  const lesson = task?.lesson
  const lessonOk = PHASE_1_LESSONS.includes(lesson)
  if (!lessonOk) {
    errors.push(
      `${where}: lesson must be 1, 2, 3 or 4 (the station has only these lessons so far).`
    )
  }
  if (task?.catalogue != null) {
    if (!Array.isArray(task.catalogue)) {
      errors.push(`${where}: catalogue must be a list of part ids.`)
    } else if (lessonOk && lesson < 3) {
      errors.push(`${where}: catalogue only applies to lessons 3 and 4.`)
    } else {
      task.catalogue.forEach((id) => {
        if (!partById(id)) {
          errors.push(`${where}: catalogue part "${id}" is not in the parts catalogue.`)
        } else if (lessonOk && !LESSON[lesson].catalogue.includes(id)) {
          errors.push(`${where}: catalogue part "${id}" is not available in lesson ${lesson}.`)
        }
      })
    }
  }
  const items = Array.isArray(task?.items) ? task.items : []
  if (items.length === 0) errors.push(`${where}: station task needs at least one item.`)
  else {
    const coreError = validateCoreItems(task, where, items.length)
    if (coreError) errors.push(coreError)
  }
  const seen = new Set()
  items.forEach((item, i) => {
    const label = `${where} item ${i + 1}`
    if (item?.id == null || item.id === '') errors.push(`${label}: needs an id.`)
    else if (seen.has(String(item.id))) {
      errors.push(`${label}: id "${item.id}" is used more than once.`)
    }
    seen.add(String(item?.id))
    if (item?.prompt != null && typeof item.prompt !== 'string') {
      errors.push(`${label}: prompt must be text.`)
    }
    const goal = GOALS[item?.goal]
    if (!goal) {
      errors.push(`${label}: goal must be one of ${GOAL_IDS.join(', ')}.`)
      return
    }
    if (lessonOk && !goal.lessons.includes(lesson)) {
      errors.push(`${label}: goal "${item.goal}" can't be done in lesson ${lesson}.`)
    }
    const hasTarget = item.target != null && item.target !== ''
    if (goal.target === 'none') {
      if (hasTarget) errors.push(`${label}: goal "${item.goal}" doesn't use a target.`)
    } else if (!hasTarget) {
      if (goal.target === 'colour') {
        errors.push(`${label}: goal "${item.goal}" needs a target (hull or lights).`)
      }
    } else if (!targetIsValid(goal.target, item.target)) {
      errors.push(`${label}: target "${item.target}" must be ${GOAL_TARGET_WORDS[goal.target]}.`)
    } else if (
      (item.goal === 'place_part' || item.goal === 'order_part') &&
      lessonOk &&
      !catalogueFor({ ...task, lesson }).includes(item.target)
    ) {
      errors.push(`${label}: target "${item.target}" is not in this lesson's catalogue.`)
    }
  })
  return errors
}

// --- Grading ---

const nameOf = (id) => partById(id)?.label ?? id

export function promptFor(item) {
  if (typeof item?.prompt === 'string' && item.prompt.trim()) return item.prompt
  const t = item?.target
  switch (item?.goal) {
    case 'power_on':
      return t
        ? `Light up the ${SECTIONS.find((s) => s.id === t)?.label ?? t}.`
        : 'Light up the whole station.'
    case 'pick_colour':
      return `Pick a colour for the ${t === 'lights' ? 'lights' : 'hull'}.`
    case 'select':
      return t ? `Select the ${nameOf(t)}.` : 'Select a part.'
    case 'open_crate':
      return t ? `Open ${nameOf(t)}.` : 'Open a crate.'
    case 'choose_captain':
      return 'Choose a captain.'
    case 'place_part':
      return t ? `Put the ${nameOf(t)} on the station.` : 'Put a part on the station.'
    case 'undo':
      return 'Undo your last change.'
    case 'order_part':
      return t ? `Order the ${nameOf(t)}.` : 'Order a part.'
    default:
      return ''
  }
}

// A short hint for a goal that is not done yet. Never gives the answer away.
function hintFor(item, state) {
  const scene = state?.scene ?? {}
  switch (item.goal) {
    case 'power_on':
      return 'Click a power button to light up the station.'
    case 'pick_colour':
      return `Click one of the colours for the ${item.target === 'lights' ? 'lights' : 'hull'}.`
    case 'select':
      return 'Click once on a part to pick it.'
    case 'open_crate':
      return CRATE_IDS.some((id) => scene.crates?.[id] === 'open')
        ? 'Now try a double-click.'
        : 'Double-click a crate to open it.'
    case 'choose_captain':
      return Object.keys(scene.crew ?? {}).length
        ? 'Click a crew member to make them captain.'
        : 'Open a crate first.'
    case 'place_part':
      return 'Drag a part onto an empty spot.'
    case 'undo':
      return (state?.undo ?? []).length
        ? 'Press Ctrl+Z (Cmd+Z on a Mac) to put it back.'
        : 'Change something first, then try to put it back.'
    case 'order_part':
      return 'Scroll the list, then click Order.'
    default:
      return null
  }
}

export function gradeStationItem(task, item, state) {
  const record = state?.done?.[item?.id]
  if (record) return { correct: true, hint: null, method: record.method }
  return { correct: false, hint: item?.goal ? hintFor(item, state) : null, method: null }
}

// { total, correct, core, done, hint, itemResults: { [id]: { correct, hint, method } } }
export function gradeStationTask(task, state) {
  const items = goalItems(task)
  const results = items.map((item) => ({ item, ...gradeStationItem(task, item, state) }))
  const correct = results.filter((r) => r.correct).length
  const core = coreCountOf(task, items.length)
  return {
    total: items.length,
    correct,
    core,
    done: items.length > 0 && correct >= core,
    hint: results.find((r) => !r.correct)?.hint ?? null,
    itemResults: Object.fromEntries(
      results.map((r) => [r.item.id, { correct: r.correct, hint: r.hint, method: r.method }])
    ),
  }
}

// { done, core, total }: goals done, goals that make the round (the core), all goals.
export function stationProgress(task, state) {
  const { total, correct, core } = gradeStationTask(task, state)
  return { done: correct, core, total }
}

// The `done` map with every goal marked, using the first method each goal accepts (a teacher's
// Complete / show answers). The scene is left as it is.
export function solvedDone(task, at = 0) {
  return Object.fromEntries(
    goalItems(task).map((item) => [
      item.id,
      {
        method: GOALS[item.goal]?.methods[0] ?? 'click',
        at,
        ...(item.goal === 'order_part' ? { scrolled: true } : {}),
      },
    ])
  )
}

const METHOD_WORDS = {
  click: 'click',
  keyboard: 'keyboard',
  double_click: 'double-click',
  drag: 'drag',
  pick_drop: 'click to pick up and drop',
  ctrl_z: 'Ctrl+Z',
  cmd_z: 'Cmd+Z',
}
export const methodWords = (method) => METHOD_WORDS[method] ?? method ?? ''
