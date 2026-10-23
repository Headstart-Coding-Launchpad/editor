// Pure model for the Space station activity (docs/architecture/station-activity.md): the layout,
// the parts catalogue, the scene a lesson starts from, the actions a student can take, goal
// marking (with the method used), validation and grading. Node-safe: no React, JSX or DOM.
// Placeholder art lives in ./art.js so swapping it never touches this file.

import { coreCountOf, validateCoreItems } from '../round.js'

// --- Layout (in code, not authored) ---

export const PHASE_1_LESSONS = [1, 2, 3, 4]

export const SECTIONS = Object.freeze([
  { id: 'left', label: 'Left wing', spot: 'power-1' },
  { id: 'core', label: 'Core', spot: 'power-2' },
  { id: 'right', label: 'Right wing', spot: 'power-3' },
])

// The station is Lesson Gen's 1600x1000 picture (public/station/phase-1, parts.json), so the scene
// is 1.6:1. Spots are the 18 places on it, as 0-1 fractions of the picture: `cells` is the size in
// 128 px cells, `accepts` the part kind, `flipY` / `onlyCanHang` mark spots that hang under the hull
// (only parts with canHang, drawn upside down), `flipX` mirrors the left docking arm and
// `behindHull` crew show through the portholes. Art paths live in art.js, never here.
export const SCENE_ASPECT = 1.6
export const SPOT_SNAP_RADIUS = 0.06
const spot = (id, x, y, cells, accepts, extra = {}) =>
  Object.freeze({
    id,
    x,
    y,
    w: cells[0] * 0.08,
    h: cells[1] * 0.128,
    cells: Object.freeze(cells),
    accepts: Object.freeze([accepts]),
    ...extra,
  })
export const SPOTS = Object.freeze([
  spot('top-module-1', 0.1975, 0.117, [2, 2], 'module'),
  spot('top-part-1', 0.3575, 0.245, [1, 1], 'part'),
  spot('bottom-module-1', 0.2775, 0.621, [2, 2], 'module', { flipY: true, onlyCanHang: true }),
  spot('bottom-part-1', 0.1975, 0.621, [1, 1], 'part', { flipY: true, onlyCanHang: true }),
  spot('top-module-2', 0.5619, 0.117, [2, 2], 'module'),
  spot('top-part-2', 0.7219, 0.245, [1, 1], 'part'),
  spot('bottom-module-2', 0.6419, 0.621, [2, 2], 'module', { flipY: true, onlyCanHang: true }),
  spot('bottom-part-2', 0.5619, 0.621, [1, 1], 'part', { flipY: true, onlyCanHang: true }),
  spot('ring-top', 0.46, 0.167, [1, 1], 'part'),
  spot('end-left', 0.0088, 0.433, [2, 1], 'module', { flipX: true }),
  spot('end-right', 0.8313, 0.433, [2, 1], 'module'),
  spot('crew-1', 0.2656, 0.427, [1, 1], 'crew', { behindHull: true }),
  spot('crew-2', 0.3744, 0.427, [1, 1], 'crew', { behindHull: true }),
  spot('crew-3', 0.5906, 0.427, [1, 1], 'crew', { behindHull: true }),
  spot('crew-4', 0.6819, 0.427, [1, 1], 'crew', { behindHull: true }),
  spot('power-1', 0.16, 0.433, [1, 1], 'power'),
  spot('power-2', 0.46, 0.433, [1, 1], 'power'),
  spot('power-3', 0.76, 0.433, [1, 1], 'power'),
])
const SPOT_BY_ID = Object.fromEntries(SPOTS.map((s) => [s.id, s]))
export const spotById = (id) => SPOT_BY_ID[id] ?? null

// Where crew stand once their crate is opened (the four portholes).
export const POSTS = Object.freeze(SPOTS.filter((s) => s.accepts.includes('crew')))
// The spots a student places modules and parts on.
export const PLACE_SPOTS = Object.freeze(
  SPOTS.filter((s) => s.accepts.includes('module') || s.accepts.includes('part'))
)

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

// kind: 'crate' | 'crew' | 'module' | 'part'. cells = size in 128 px cells [w, h]; canHang = may
// hang under the hull (drawn upside down). Sizes and canHang follow the art's parts.json.
const part = (id, label, kind, lesson, cells = [1, 1], canHang = false) =>
  Object.freeze({ id, label, kind, lesson, cells: Object.freeze(cells), canHang })
export const PARTS = Object.freeze([
  part('crate-1', 'Crate 1', 'crate', 2),
  part('crate-2', 'Crate 2', 'crate', 2),
  part('crate-3', 'Crate 3', 'crate', 2),
  part('crate-4', 'Crate 4', 'crate', 2),
  part('crate-5', 'Crate 5', 'crate', 2),
  part('crew-robot-1', 'Robot 1', 'crew', 2),
  part('crew-robot-2', 'Robot 2', 'crew', 2),
  part('crew-robot-3', 'Robot 3', 'crew', 2),
  part('crew-plant', 'Plant', 'crew', 2),
  part('solar', 'Solar panel', 'module', 3, [2, 2], true),
  part('dome', 'Dome', 'module', 3, [2, 2]),
  part('greenhouse', 'Greenhouse', 'module', 3, [2, 2]),
  part('docking-arm', 'Docking arm', 'module', 3, [2, 1]),
  part('telescope', 'Telescope', 'part', 4),
  part('dish', 'Radio dish', 'part', 4, [1, 1], true),
  part('flag', 'Flag', 'part', 4),
  part('antenna', 'Antenna', 'part', 4, [1, 1], true),
  part('beacon', 'Beacon', 'part', 4, [1, 1], true),
  part('satellite', 'Satellite', 'part', 4, [1, 1], true),
  part('cargo-pod', 'Cargo pod', 'part', 4, [1, 1], true),
  part('rainbow-ring', 'Rainbow ring', 'module', 4, [2, 2], true),
])
const PART_BY_ID = Object.fromEntries(PARTS.map((p) => [p.id, p]))
export const partById = (id) => PART_BY_ID[id] ?? null
const isPlaceable = (p) => p?.kind === 'module' || p?.kind === 'part'

// Can this part go in this spot? The kind must be accepted, the part must fit inside the spot's
// cells, and a spot under the hull only takes parts that can hang.
export function spotTakes(spot, part) {
  if (!spot || !part || !spot.accepts.includes(part.kind)) return false
  if (part.cells[0] > spot.cells[0] || part.cells[1] > spot.cells[1]) return false
  return !spot.onlyCanHang || part.canHang === true
}

// Each crate holds one crew member (crate-5 is empty: a decoy or a spare). A task's `crates` list
// picks which of the five are in the delivery bay; without it the bay has the first three.
export const CRATE_CREW = Object.freeze({
  'crate-1': 'crew-robot-1',
  'crate-2': 'crew-robot-2',
  'crate-3': 'crew-plant',
  'crate-4': 'crew-robot-3',
})
export const CRATE_IDS = Object.freeze(['crate-1', 'crate-2', 'crate-3', 'crate-4', 'crate-5'])
export const DEFAULT_CRATE_IDS = Object.freeze(CRATE_IDS.slice(0, 3))
export const CREW_IDS = Object.freeze(Object.values(CRATE_CREW))

// Stickers on crates (a colour and a shape, drawn in code: art.js STICKER_SHAPES, ui.jsx Sticker).
export const STICKER_COLOURS = Object.freeze(['red', 'blue', 'green', 'yellow', 'purple', 'orange'])
export const STICKER_SHAPES = Object.freeze(['star', 'circle', 'triangle', 'square', 'heart'])
export const STICKERS = Object.freeze(
  STICKER_COLOURS.flatMap((c) => STICKER_SHAPES.map((sh) => `${c}-${sh}`))
)
export const isSticker = (s) => STICKERS.includes(s)
export const stickerWords = (s) => String(s ?? '').replace('-', ' ')

// What each lesson adds. `catalogue` is the part list on offer (tray or catalogue; the best part
// of Lesson 4 is last, at the very bottom). `defaults` is where those parts sit by default once
// the lesson is behind the child (catch-up for a missed lesson).
export const LESSON = Object.freeze({
  1: Object.freeze({ title: 'Power Up', catalogue: [], defaults: {} }),
  2: Object.freeze({ title: 'Special Delivery', catalogue: [], defaults: {} }),
  3: Object.freeze({
    title: 'Build It',
    catalogue: ['solar', 'dome', 'greenhouse', 'docking-arm'],
    defaults: {
      dome: 'top-module-1',
      greenhouse: 'top-module-2',
      solar: 'bottom-module-1',
      'docking-arm': 'end-left',
    },
  }),
  4: Object.freeze({
    title: 'The Catalogue',
    catalogue: [
      'telescope',
      'dish',
      'flag',
      'antenna',
      'beacon',
      'satellite',
      'cargo-pod',
      'rainbow-ring',
    ],
    defaults: { telescope: 'top-part-1', dish: 'bottom-part-1', flag: 'ring-top' },
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

function freeSpot(scene, preferred, partId) {
  const p = partById(partId)
  const ok = (id) => spotTakes(spotById(id), p) && !own(scene.placed, id)
  if (preferred && ok(preferred)) return preferred
  return PLACE_SPOTS.find((s) => ok(s.id))?.id ?? null
}

function isPlaced(scene, partId) {
  return Object.values(scene?.placed ?? {}).includes(partId)
}

const placedCount = (scene, partId) =>
  Object.values(scene?.placed ?? {}).filter((id) => id === partId).length

// The crates in a task's delivery bay, in the order authored (the first three by default).
export function crateIdsFor(task) {
  if (Array.isArray(task?.crates) && task.crates.length) {
    const ids = task.crates.map((c) => c?.id).filter((id) => CRATE_IDS.includes(id))
    if (ids.length) return [...new Set(ids)]
  }
  return DEFAULT_CRATE_IDS
}
// The sticker on a crate in this task, or null.
export const stickerOf = (task, crateId) =>
  (Array.isArray(task?.crates) ? task.crates : []).find((c) => c?.id === crateId)?.sticker ?? null
// Is this crate one the delivery note lists?
export const isNoted = (task, crateId) => {
  const sticker = stickerOf(task, crateId)
  return !!sticker && (Array.isArray(task?.note) ? task.note : []).includes(sticker)
}

// Parts a place_part goal asks for more than once (count > 1): the tray never runs out of them.
export function multiParts(task) {
  const items = Array.isArray(task?.items) ? task.items : []
  return new Set(
    items.filter((i) => i?.goal === 'place_part' && i.count > 1 && i.target).map((i) => i.target)
  )
}

// Every crew member whose crate is open stands at a free post (a porthole).
function seatCrew(scene) {
  for (const [crate, crew] of Object.entries(CRATE_CREW)) {
    if (scene.crates[crate] !== 'open' || own(scene.crew, crew)) continue
    const taken = new Set(Object.values(scene.crew))
    const post = POSTS.find((p) => !taken.has(p.id))
    if (post) scene.crew[crew] = post.id
  }
}

// Everything lesson `k` leaves behind it, added to a scene in a default place when missing.
function finishLesson(scene, k) {
  if (k === 1) {
    for (const s of SECTIONS) scene.power[s.id] = true
  } else if (k === 2) {
    const crates = Object.keys(scene.crates)
    for (const crate of crates.length ? crates : DEFAULT_CRATE_IDS) scene.crates[crate] = 'open'
    seatCrew(scene)
    if (!scene.captain) scene.captain = CREW_IDS[0]
  } else if (LESSON[k]?.defaults) {
    for (const [partId, spotId] of Object.entries(LESSON[k].defaults)) {
      if (isPlaced(scene, partId)) continue
      const spot = freeSpot(scene, spotId, partId)
      if (spot) scene.placed[spot] = partId
    }
    scene.ordered = scene.ordered.filter((id) => !isPlaced(scene, id))
  }
}

// What lesson `n` adds when it starts.
function startLesson(scene, n, task) {
  if (n === 2) {
    for (const crate of crateIdsFor(task)) {
      if (!own(scene.crates, crate)) scene.crates[crate] = 'closed'
    }
  }
}

function completeScene(scene, n, task) {
  for (let k = 1; k < n; k += 1) finishLesson(scene, k)
  startLesson(scene, n, task)
  return scene
}

// The default scene for lesson n: lessons 1..n-1 are done in default places, then lesson n's setup.
// `task` (optional) says which crates the delivery bay has.
export function sceneForLesson(n, task = null) {
  return completeScene(emptyScene(), PHASE_1_LESSONS.includes(n) ? n : 1, task)
}

// Keeps only well-formed saved data, so a bad or old saved scene can never break the station.
function sanitiseScene(raw, multi = new Set()) {
  const scene = emptyScene()
  if (!raw || typeof raw !== 'object') return scene
  if (HULL_COLOURS.includes(raw.hull)) scene.hull = raw.hull
  if (LIGHT_COLOURS.includes(raw.lights)) scene.lights = raw.lights
  for (const s of SECTIONS) scene.power[s.id] = raw.power?.[s.id] === true
  // Unknown spot or part ids (an older saved station) and parts that no longer fit are dropped;
  // the catch-up then puts the lesson's parts back in default places.
  const used = new Set()
  for (const [spotId, id] of Object.entries(raw.placed ?? {})) {
    if (spotTakes(spotById(spotId), partById(id)) && (!used.has(id) || multi.has(id))) {
      scene.placed[spotId] = id
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
  seatCrew(scene)
  if (CREW_IDS.includes(raw.captain) && own(scene.crew, raw.captain)) scene.captain = raw.captain
  if (Array.isArray(raw.ordered)) {
    scene.ordered = raw.ordered.filter(
      (id, i) => isPlaceable(partById(id)) && raw.ordered.indexOf(id) === i && !used.has(id)
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
  return completeScene(sanitiseScene(raw, multiParts(task)), n, task)
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
  const multi = multiParts(task)
  return waiting.filter((id) => multi.has(id) || !isPlaced(scene, id))
}

// The empty spot that takes `what` (a part id, or just a part kind) nearest a dropped point
// (fractions 0-1): inside the spot, or within the snap radius of its edge. Null when none, so the
// part goes back to the tray.
export function nearestSpot(scene, point, what = 'module', radius = SPOT_SNAP_RADIUS) {
  const p = partById(what)
  let best = null
  let bestDistance = radius
  for (const spot of SPOTS) {
    if (own(scene?.placed, spot.id)) continue
    if (p ? !spotTakes(spot, p) : !spot.accepts.includes(what)) continue
    // y is a fraction of the height, which is 1/1.6 of the width: scale it so distance is true.
    const dx = Math.max(spot.x - point.x, 0, point.x - (spot.x + spot.w))
    const dy = Math.max(spot.y - point.y, 0, point.y - (spot.y + spot.h)) / SCENE_ASPECT
    const d = Math.hypot(dx, dy)
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
    scene: scene ?? sceneForLesson(task?.lesson, task),
    done: {},
    selected: null,
    undo: [],
    undos: 0,
    device: { touch: false },
  }
}

const goalItems = (task) => (Array.isArray(task?.items) ? task.items : [])
const orderOf = (item) => (Array.isArray(item?.order) && item.order.length ? item.order : null)
// The part a goal is about: its target, or the part on its card ("find the one in the picture").
export const goalPart = (item) => item?.card || item?.target || null

// How far a counting goal (count: n) has got: { have, need }, or null for a goal with no count.
export function countProgress(task, item, state) {
  const need = item?.count
  if (!Number.isInteger(need) || need < 2) return null
  const scene = state?.scene ?? {}
  if (item.goal === 'place_part') return { have: placedCount(scene, item.target), need }
  if (item.goal === 'open_crate') {
    return { have: crateIdsFor(task).filter((id) => scene.crates?.[id] === 'open').length, need }
  }
  if (item.goal === 'undo') return { have: Math.min(state?.undos ?? 0, need), need }
  return null
}

// The next step of an ordered goal that is not done yet: the first id in `order` still to do.
export function nextInOrder(item, scene) {
  const order = orderOf(item)
  if (!order) return null
  if (item.goal === 'power_on') return order.find((id) => !scene.power?.[id]) ?? null
  if (item.goal === 'open_crate') return order.find((id) => scene.crates?.[id] !== 'open') ?? null
  if (item.goal === 'place_part') return order.find((id) => !isPlaced(scene, id)) ?? null
  return null
}

// Does a goal refuse this action? Returns that goal item, or null. A refused action changes
// nothing (no undo step, no mark): the screen just blinks. Two kinds of refusal:
// - an ordered goal (order: [...]) that is not done yet refuses a step that is not next;
// - an open_crate goal with onlyNoted refuses opening a crate the delivery note does not list.
export function blockedBy(task, state, action) {
  const scene = state?.scene
  if (!scene || !action) return null
  const done = state.done ?? {}
  for (const item of goalItems(task)) {
    if (!GOALS[item.goal]) continue
    if (item.onlyNoted === true && action.type === 'open' && !isNoted(task, action.crate)) {
      if (scene.crates?.[action.crate] === 'closed') return item
    }
    if (own(done, item.id)) continue
    const order = orderOf(item)
    if (!order) continue
    const next = nextInOrder(item, scene)
    if (!next) continue
    if (item.goal === 'power_on' && action.type === 'power') {
      if (action.section === 'all') return item
      if (order.includes(action.section) && action.section !== next && !scene.power[action.section])
        return item
    } else if (item.goal === 'open_crate' && action.type === 'open') {
      if (order.includes(action.crate) && action.crate !== next) return item
    } else if (item.goal === 'place_part' && action.type === 'place') {
      if (order.includes(action.part) && action.part !== next && !isPlaced(scene, action.part))
        return item
    }
  }
  return null
}

// Does this action finish this goal item? Returns the record to store, or null. `state` is the
// state after the action.
function completes(item, action, state, task) {
  const goal = GOALS[item.goal]
  if (!goal) return null
  const method = action.method
  if (!goal.methods.includes(method)) return null
  const mark = { method, at: action.at ?? Date.now() }
  const scene = state.scene
  const target = item.target
  const order = orderOf(item)
  switch (item.goal) {
    case 'power_on':
      if (action.type !== 'power') return null
      if (order) return order.every((id) => scene.power[id]) ? mark : null
      if (target) return action.section === target || action.section === 'all' ? mark : null
      return SECTIONS.every((s) => scene.power[s.id]) ? mark : null
    case 'pick_colour':
      if (action.type !== 'colour' || action.target !== target) return null
      return item.match && action.colour !== item.match ? null : mark
    case 'select':
      return action.type === 'select' && action.id && (!target || action.id === target)
        ? mark
        : null
    case 'open_crate': {
      if (action.type !== 'open') return null
      const crates = crateIdsFor(task)
      const isOpen = (id) => scene.crates?.[id] === 'open'
      if (item.onlyNoted === true) {
        const noted = crates.filter((id) => isNoted(task, id))
        const decoys = crates.filter((id) => !isNoted(task, id))
        return noted.length && noted.every(isOpen) && !decoys.some(isOpen) ? mark : null
      }
      if (order) return order.every(isOpen) ? mark : null
      if (item.count) return crates.filter(isOpen).length === item.count ? mark : null
      return !target || action.crate === target ? mark : null
    }
    case 'choose_captain':
      return action.type === 'captain' ? mark : null
    case 'place_part':
      if (action.type !== 'place') return null
      if (order) return order.every((id) => isPlaced(scene, id)) ? mark : null
      if (item.count) return placedCount(scene, target) === item.count ? mark : null
      return !goalPart(item) || action.part === goalPart(item) ? mark : null
    case 'undo':
      if (action.type !== 'undo') return null
      return !item.count || (state.undos ?? 0) >= item.count ? mark : null
    case 'order_part':
      return action.type === 'order' && (!goalPart(item) || action.part === goalPart(item))
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
    const mark = completes(item, action, state, task)
    if (mark) done = { ...done, [item.id]: mark }
  }
  return done === state.done ? state : { ...state, done }
}

function pushUndo(state, scene) {
  return { ...state, undo: [...state.undo, state.scene].slice(-UNDO_LIMIT), scene }
}

// action: { type: 'power', section | 'all', method } | { type: 'colour', target, colour, method }
// | { type: 'select', id | null, method } | { type: 'open', crate, method }
// | { type: 'captain', crew, method } | { type: 'place', part, spot, from?, method }
// | { type: 'order', part, scrolled?, method } | { type: 'undo', method }. Each also takes an
// optional `at` (ms). `from` is the spot a placed part was dragged from (it moves; without it a
// part from the tray is placed). An action that cannot happen, or that a goal refuses
// (blockedBy), returns the state unchanged. Every scene change pushes the earlier scene onto
// `undo` (at most UNDO_LIMIT); a Ctrl/Cmd+Z that really undoes counts in `undos`.
export function stationAction(state, action, task) {
  const base =
    state && state.scene
      ? { ...state, undo: state.undo ?? [], done: state.done ?? {} }
      : initialStationState(task)
  const scene = base.scene
  if (blockedBy(task, base, action)) return state ?? base
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
      const spot = spotById(action.spot)
      if (!isPlaceable(p) || !spotTakes(spot, p)) return state ?? base
      if (own(scene.placed, spot.id)) return state ?? base
      const multi = multiParts(task).has(p.id)
      const available = trayParts(task, scene).includes(p.id) || isPlaced(scene, p.id)
      if (!available) return state ?? base
      if (multi && action.from && scene.placed[action.from] !== p.id) return state ?? base
      const placed = clone(scene)
      if (!multi) {
        for (const [id, partId] of Object.entries(placed.placed)) {
          if (partId === p.id) delete placed.placed[id]
        }
      } else if (action.from) delete placed.placed[action.from]
      placed.placed[spot.id] = p.id
      placed.ordered = placed.ordered.filter((id) => id !== p.id)
      next = pushUndo(base, placed)
      break
    }
    case 'order': {
      const p = partById(action.part)
      if (!isPlaceable(p) || !catalogueFor(task).includes(p.id)) return state ?? base
      if (scene.ordered.includes(p.id) || isPlaced(scene, p.id)) return state ?? base
      next = pushUndo(base, { ...clone(scene), ordered: [...scene.ordered, p.id] })
      break
    }
    case 'undo': {
      if (!base.undo.length) return state ?? base
      const keys = action.method === 'ctrl_z' || action.method === 'cmd_z'
      next = {
        ...base,
        undo: base.undo.slice(0, -1),
        scene: base.undo[base.undo.length - 1],
        undos: (base.undos ?? 0) + (keys ? 1 : 0),
      }
      break
    }
    default:
      return state ?? base
  }
  return markGoals(next, task, action)
}

// --- Validation ---

const GOAL_TARGET_WORDS = {
  section: 'a power section (left, core or right)',
  colour: 'hull or lights',
  part: 'a part id from the parts catalogue',
  crate: 'a crate id (crate-1, crate-2, crate-3, crate-4 or crate-5)',
}

function targetIsValid(kind, target) {
  if (kind === 'section') return SECTIONS.some((s) => s.id === target)
  if (kind === 'colour') return target === 'hull' || target === 'lights'
  if (kind === 'crate') return CRATE_IDS.includes(target)
  if (kind === 'part') return !!partById(target)
  return false
}

const STICKER_WORDS = `a colour and a shape joined with a dash, like red-star (colours: ${STICKER_COLOURS.join(', ')}; shapes: ${STICKER_SHAPES.join(', ')})`
const MAX_UNDO_COUNT = 9
const ORDER_GOALS = ['power_on', 'open_crate', 'place_part']
const COUNT_GOALS = ['place_part', 'open_crate', 'undo']

// How many spots take a part (the most copies a count goal can ask for).
const spotsFor = (partId) => SPOTS.filter((s) => spotTakes(s, partById(partId))).length

// The task-level fields that belong to the delivery bay: crates and note (lesson 2 only).
function validateBay(task, where, lessonOk, errors) {
  const lesson = task?.lesson
  if (task?.crates != null) {
    if (!Array.isArray(task.crates) || task.crates.length < 1 || task.crates.length > 5) {
      errors.push(`${where}: crates must be a list of 1 to 5 crates, each with an id.`)
    } else if (lessonOk && lesson !== 2) {
      errors.push(`${where}: crates only applies to lesson 2.`)
    } else {
      const seen = new Set()
      task.crates.forEach((crate, j) => {
        const label = `${where} crate ${j + 1}`
        if (!CRATE_IDS.includes(crate?.id)) {
          errors.push(`${label}: id must be one of ${CRATE_IDS.join(', ')}.`)
        } else if (seen.has(crate.id)) {
          errors.push(`${label}: id "${crate.id}" is used more than once.`)
        }
        seen.add(crate?.id)
        if (crate?.sticker != null && !isSticker(crate.sticker)) {
          errors.push(`${label}: sticker "${crate.sticker}" must be ${STICKER_WORDS}.`)
        }
      })
    }
  }
  if (task?.note != null) {
    if (!Array.isArray(task.note) || task.note.length < 1) {
      errors.push(`${where}: note must be a list of stickers.`)
    } else if (lessonOk && lesson !== 2) {
      errors.push(`${where}: note only applies to lesson 2.`)
    } else {
      const onCrates = (Array.isArray(task.crates) ? task.crates : []).map((c) => c?.sticker)
      if (!onCrates.some(Boolean)) {
        errors.push(`${where}: note needs crates with stickers to match it.`)
      }
      task.note.forEach((sticker) => {
        if (!isSticker(sticker)) {
          errors.push(`${where}: note sticker "${sticker}" must be ${STICKER_WORDS}.`)
        } else if (onCrates.some(Boolean) && !onCrates.includes(sticker)) {
          errors.push(`${where}: note sticker "${sticker}" is not on any crate.`)
        }
      })
    }
  }
}

// The new goal fields (order, match, card, onlyNoted, count) on one goal item.
function validateGoalFields(item, label, task, lesson, lessonOk, errors) {
  const add = (message) => errors.push(`${label}: ${message}`)
  const crates = crateIdsFor(task)
  const catalogue = lessonOk ? catalogueFor({ ...task, lesson }) : []
  const hasTarget = item.target != null && item.target !== ''

  if (item.order != null) {
    const idWords = {
      power_on: GOAL_TARGET_WORDS.section,
      open_crate: `a crate in this task (${crates.join(', ')})`,
      place_part: "a part in this lesson's catalogue",
    }
    if (!ORDER_GOALS.includes(item.goal)) {
      add(`order only applies to ${ORDER_GOALS.join(', ')} goals.`)
    } else if (!Array.isArray(item.order) || item.order.length < 2) {
      add('order must be a list of at least 2 ids.')
    } else {
      if (new Set(item.order).size !== item.order.length) add('order lists the same id twice.')
      if (hasTarget || item.card) {
        add("order can't be used with a target or a card; list the ids in order instead.")
      }
      for (const id of item.order) {
        const ok =
          item.goal === 'power_on'
            ? SECTIONS.some((s) => s.id === id)
            : item.goal === 'open_crate'
              ? crates.includes(id)
              : catalogue.includes(id)
        if (!ok) add(`order "${id}" must be ${idWords[item.goal]}.`)
        else if (item.onlyNoted === true && item.goal === 'open_crate' && !isNoted(task, id)) {
          add(`order "${id}" is not a crate the note lists.`)
        }
      }
    }
  }

  if (item.match != null) {
    if (item.goal !== 'pick_colour') {
      add('match only applies to pick_colour goals.')
    } else if (item.target === 'hull' || item.target === 'lights') {
      if (!COLOUR_TARGETS[item.target].includes(item.match)) {
        add(
          `match "${item.match}" must be one of the ${item.target} colours: ${COLOUR_TARGETS[item.target].join(', ')}.`
        )
      }
    }
  }

  if (item.card != null) {
    if (item.goal !== 'order_part' && item.goal !== 'place_part') {
      add('card only applies to order_part and place_part goals.')
    } else if (hasTarget) {
      add("card can't be used with a target; the part on the card is the target.")
    } else if (!partById(item.card)) {
      add(`card "${item.card}" must be a part id from the parts catalogue.`)
    } else if (lessonOk && !catalogue.includes(item.card)) {
      add(`card "${item.card}" is not in this lesson's catalogue.`)
    }
  }

  if (item.onlyNoted != null) {
    if (item.goal !== 'open_crate') add('onlyNoted only applies to open_crate goals.')
    else if (typeof item.onlyNoted !== 'boolean') add('onlyNoted must be true or false.')
    else if (item.onlyNoted) {
      if (hasTarget) add("onlyNoted can't be used with a target; the note says which crates.")
      if (!Array.isArray(task?.note) || !Array.isArray(task?.crates)) {
        add("onlyNoted needs the task's note and crates (with stickers).")
      }
    }
  }

  if (item.count != null) {
    const n = item.count
    const whole = Number.isInteger(n)
    if (!COUNT_GOALS.includes(item.goal)) {
      add(`count only applies to ${COUNT_GOALS.join(', ')} goals.`)
    } else if (item.goal === 'undo') {
      if (!whole || n < 2 || n > MAX_UNDO_COUNT) {
        add(`count must be a whole number from 2 to ${MAX_UNDO_COUNT} (Ctrl+Z presses).`)
      }
    } else if (item.goal === 'open_crate') {
      if (!whole || n < 2 || n > crates.length) {
        add(`count must be a whole number from 2 to ${crates.length} (the crates in this task).`)
      }
      if (hasTarget || item.order || item.onlyNoted === true) {
        add("count can't be used with a target, order or onlyNoted.")
      }
    } else {
      if (lessonOk && lesson !== 3) add('count on place_part only works in lesson 3.')
      if (!hasTarget) add('count needs a target part, like "put exactly 3 solar panels".')
      else if (partById(item.target) && (!whole || n < 2 || n > spotsFor(item.target))) {
        add(
          `count must be a whole number from 2 to ${spotsFor(item.target)} (the spots that take the ${nameOf(item.target)}).`
        )
      }
      if (item.order || item.card) add("count can't be used with an order or a card.")
    }
  }
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
  validateBay(task, where, lessonOk, errors)
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
    } else if (
      goal.target === 'crate' &&
      Array.isArray(task?.crates) &&
      !crateIdsFor(task).includes(item.target)
    ) {
      errors.push(`${label}: target "${item.target}" is not one of this task's crates.`)
    }
    validateGoalFields(item, label, task, lesson, lessonOk, errors)
  })
  return errors
}

// --- Grading ---

const nameOf = (id) => partById(id)?.label ?? id
const plural = (name) => (/(s|sh|ch|x)$/i.test(name) ? `${name}es` : `${name}s`)
const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
const numberWord = (n) => NUMBER_WORDS[n] ?? String(n)

export function promptFor(item, lesson) {
  if (typeof item?.prompt === 'string' && item.prompt.trim()) return item.prompt
  const t = item?.target
  switch (item?.goal) {
    case 'power_on':
      if (orderOf(item)) return 'Switch on each part of the station in the order on the card.'
      return t
        ? `Light up the ${SECTIONS.find((s) => s.id === t)?.label ?? t}.`
        : 'Light up the whole station.'
    case 'pick_colour':
      if (item.match) {
        return `Click the colour on the card for the ${t === 'lights' ? 'lights' : 'hull'}.`
      }
      return `Pick a colour for the ${t === 'lights' ? 'lights' : 'hull'}.`
    case 'select':
      return t ? `Select the ${nameOf(t)}.` : lesson === 2 ? 'Select a crate.' : 'Select a part.'
    case 'open_crate':
      if (item.onlyNoted === true) return 'Open only the crates on the delivery note.'
      if (orderOf(item)) return 'Open the crates in the order on the card.'
      if (item.count) return `Open exactly ${numberWord(item.count)} crates.`
      return t ? `Open ${nameOf(t)}.` : 'Open a crate.'
    case 'choose_captain':
      return 'Choose a captain.'
    case 'place_part':
      if (orderOf(item)) return 'Build in the order on the plan card.'
      if (item.card) return 'Find the part in the picture and put it on the station.'
      if (item.count) {
        return `Put exactly ${numberWord(item.count)} ${plural(nameOf(t))} on the station.`
      }
      return t ? `Put the ${nameOf(t)} on the station.` : 'Put a part on the station.'
    case 'undo':
      if (item.count) return `Step back ${numberWord(item.count)} times with Ctrl+Z.`
      return 'Undo your last change.'
    case 'order_part':
      if (item.card) return 'Find the part in the picture and order it.'
      return t ? `Order the ${nameOf(t)}.` : 'Order a part.'
    default:
      return ''
  }
}

const more = (n, one, many) => `${n} more ${n === 1 ? one : many}`

// A short hint for a goal that is not done yet. Never gives the answer away.
function hintFor(item, state, lesson, task) {
  const scene = state?.scene ?? {}
  const progress = countProgress(task, item, state)
  const left = progress ? progress.need - progress.have : 0
  switch (item.goal) {
    case 'power_on':
      if (orderOf(item)) return 'Look at the card and switch them on in that order.'
      return 'Click a power button to light up the station.'
    case 'pick_colour':
      if (item.match) return 'Look at the card, then click the colour that matches it.'
      return `Click one of the colours for the ${item.target === 'lights' ? 'lights' : 'hull'}.`
    case 'select':
      return lesson === 2 ? 'Click once on a crate to pick it.' : 'Click once on a part to pick it.'
    case 'open_crate':
      if (item.onlyNoted === true) {
        return 'Read the stickers on the note. Click a crate to see its sticker, and open only those.'
      }
      if (orderOf(item)) return 'Look at the card and open the crates in that order.'
      if (progress && left > 0 && progress.have > 0) {
        return `Double-click to open ${more(left, 'crate', 'crates')}.`
      }
      return CRATE_IDS.some((id) => scene.crates?.[id] === 'open')
        ? 'Now try a double-click.'
        : 'Double-click a crate to open it.'
    case 'choose_captain':
      return Object.keys(scene.crew ?? {}).length
        ? 'Click a crew member to make them captain.'
        : 'Open a crate first.'
    case 'place_part':
      if (orderOf(item)) return 'Look at the plan card and drag the parts on in that order.'
      if (item.card) return 'Look at the picture on the card, then drag that part onto the station.'
      if (progress && left > 0) return `Drag ${more(left, 'copy', 'copies')} onto the station.`
      return 'Drag a part onto an empty spot.'
    case 'undo':
      if (!(state?.undo ?? []).length) return 'Change something first, then try to put it back.'
      if (progress && progress.have > 0 && left > 0) {
        return `Press Ctrl+Z (Cmd+Z on a Mac) ${more(left, 'time', 'times')}.`
      }
      return 'Press Ctrl+Z (Cmd+Z on a Mac) to put it back.'
    case 'order_part':
      if (item.card)
        return 'Look at the picture on the card, scroll to find that part, then click Order.'
      return 'Scroll the list, then click Order.'
    default:
      return null
  }
}

export function gradeStationItem(task, item, state) {
  const record = state?.done?.[item?.id]
  if (record) return { correct: true, hint: null, method: record.method }
  return {
    correct: false,
    hint: item?.goal ? hintFor(item, state, task?.lesson, task) : null,
    method: null,
  }
}

// { total, correct, core, coreDone, bonusDone, counted, done, hint, flags, itemResults }.
// Station-only rule: the FIRST `core` goals are the round (coreItems), the rest are bonus, so the
// round is done when those first goals are done (not any N of them). `correct` counts every goal
// done; `counted` is the progress to show (the core done so far, then core + bonus done).
export function gradeStationTask(task, state) {
  const items = goalItems(task)
  const results = items.map((item) => ({ item, ...gradeStationItem(task, item, state) }))
  const correct = results.filter((r) => r.correct).length
  const core = coreCountOf(task, items.length)
  const flags = results.map((r) => r.correct)
  const coreDone = flags.slice(0, core).filter(Boolean).length
  const bonusDone = flags.slice(core).filter(Boolean).length
  return {
    total: items.length,
    correct,
    core,
    coreDone,
    bonusDone,
    counted: coreDone < core ? coreDone : core + bonusDone,
    done: items.length > 0 && coreDone >= core,
    hint: results.find((r) => !r.correct)?.hint ?? null,
    flags,
    itemResults: Object.fromEntries(
      results.map((r) => [r.item.id, { correct: r.correct, hint: r.hint, method: r.method }])
    ),
  }
}

// { done, core, total }: goals counted (the core done so far, then core + bonus), goals that make
// the round (the first `core`), all goals.
export function stationProgress(task, state) {
  const { total, counted, core } = gradeStationTask(task, state)
  return { done: counted, core, total }
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
