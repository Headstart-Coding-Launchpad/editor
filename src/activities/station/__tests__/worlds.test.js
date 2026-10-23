// @vitest-environment node
import { describe, expect, it } from 'vitest'
import definition from '../definition.js'
import {
  WORLDS,
  applyCarried,
  carriedOthers,
  carrySceneOf,
  catalogueFor,
  dropTarget,
  gradeStationTask,
  initialStationState,
  lessonOf,
  mistakesOf,
  promptFor,
  sortProgress,
  spotById,
  stationAction,
  trayParts,
  validateStationTask,
  worldIdOf,
} from '../station.js'

// World packs (the zoo and the toy shop): the pack data, the sort goal, the toy catalogue order,
// validation messages and the per-world carried save.

const zoo = (items, extra = {}) => ({
  id: 1,
  taskType: 'activity',
  activityType: 'station',
  world: 'zoo',
  items,
  ...extra,
})
const toy = (items, extra = {}) => ({ ...zoo(items, extra), world: 'toyshop' })
const station = (lesson, items, extra = {}) => ({ ...zoo(items, extra), world: undefined, lesson })
const run = (t, actions, state = initialStationState(t)) =>
  actions.reduce((s, a) => stationAction(s, { at: 1, ...a }, t), state)
const drag = { method: 'drag' }
const centre = (spotId) => {
  const s = spotById(spotId)
  return { x: s.x + s.w / 2, y: s.y + s.h / 2 }
}

describe('world packs', () => {
  it('reads the zoo: 4 enclosures, 9 animals, 12 spots that each take one enclosure kind', () => {
    expect(WORLDS.zoo.enclosures.map((e) => e.kind)).toEqual(['ice', 'grass', 'jungle', 'water'])
    expect(WORLDS.zoo.parts).toHaveLength(9)
    expect(WORLDS.zoo.spots).toHaveLength(12)
    for (const spot of WORLDS.zoo.spots) {
      expect(spot.id.startsWith(spot.accepts[0])).toBe(true)
    }
    expect(WORLDS.zoo.parts.find((p) => p.id === 'ice-polar-bear').label).toBe('Polar bear')
  })
  it('lists the toy shop by catalogueOrder with the rainbow castle (best) last', () => {
    const list = catalogueFor(toy([{ id: 'a', goal: 'order_part' }]))
    expect(list[0]).toBe('toy-teddy-bear')
    expect(list.at(-1)).toBe('toy-rainbow-castle')
    expect(list).toHaveLength(8)
    expect(WORLDS.toyshop.best).toBe('toy-rainbow-castle')
    expect(WORLDS.toyshop.spots).toHaveLength(10)
  })
  it('a task is a station task unless it says world; the zoo is lesson 3 and the toy shop 4', () => {
    expect(worldIdOf({ lesson: 3 })).toBe('station')
    expect(worldIdOf({ world: 'nope', lesson: 1 })).toBe('station')
    expect(lessonOf(zoo([]))).toBe(3)
    expect(lessonOf(toy([]))).toBe(4)
    expect(lessonOf(station(2, []))).toBe(2)
  })
})

describe('the zoo: sort', () => {
  const t = zoo([{ id: 's', goal: 'sort' }])

  it('starts with every animal in the tray and an empty zoo', () => {
    const s = initialStationState(t)
    expect(trayParts(t, s.scene)).toHaveLength(9)
    expect(s.scene.placed).toEqual({})
    expect(sortProgress(t, t.items[0], s)).toEqual({ have: 0, need: 9 })
  })
  it('a wrong-enclosure place does not snap', () => {
    const s = initialStationState(t)
    const next = stationAction(s, { type: 'place', part: 'grass-lion', spot: 'ice-2', ...drag }, t)
    expect(next).toBe(s)
  })
  it('a drop inside the wrong enclosure is reported, one inside its own snaps', () => {
    const s = initialStationState(t)
    expect(dropTarget(t, s.scene, centre('ice-2'), 'grass-lion')).toEqual({ wrong: 'ice' })
    expect(dropTarget(t, s.scene, centre('grass-2'), 'grass-lion')).toEqual({ spot: 'grass-2' })
    expect(dropTarget(t, s.scene, { x: 0.5, y: 0.5 }, 'grass-lion')?.spot).toBeUndefined()
  })
  it('a wrong drop counts for the tutor and changes nothing else', () => {
    const s = initialStationState(t)
    const next = stationAction(s, { type: 'wrong', part: 'grass-lion' }, t)
    expect(next.wrongDrops).toBe(1)
    expect(next.scene).toBe(s.scene)
    expect(next.undo).toBe(s.undo)
  })
  it('is done when every animal sits in an enclosure that takes its kind', () => {
    const home = [
      ['ice-polar-bear', 'ice-1'],
      ['ice-penguin', 'ice-2'],
      ['grass-giraffe', 'grass-1'],
      ['grass-lion', 'grass-2'],
      ['grass-zebra', 'grass-3'],
      ['jungle-monkey', 'jungle-1'],
      ['jungle-parrot', 'jungle-2'],
      ['water-hippo', 'water-1'],
      ['water-duck', 'water-2'],
    ]
    let s = initialStationState(t)
    home.forEach(([part, spot], i) => {
      s = stationAction(s, { type: 'place', part, spot, ...drag }, t)
      expect(gradeStationTask(t, s).done).toBe(i === home.length - 1)
    })
    expect(s.done.s.method).toBe('drag')
  })
  it('target limits it to one enclosure kind', () => {
    const only = zoo([{ id: 's', goal: 'sort', target: 'water' }])
    let s = run(only, [{ type: 'place', part: 'water-duck', spot: 'water-2', ...drag }])
    expect(s.done.s).toBeUndefined()
    s = run(only, [{ type: 'place', part: 'water-hippo', spot: 'water-1', ...drag }], s)
    expect(s.done.s).toBeDefined()
  })
  it('a catalogue limits the animals to sort', () => {
    const few = zoo([{ id: 's', goal: 'sort' }], { catalogue: ['ice-penguin', 'water-duck'] })
    const s = run(few, [
      { type: 'place', part: 'ice-penguin', spot: 'ice-2', ...drag },
      { type: 'place', part: 'water-duck', spot: 'water-2', ...drag },
    ])
    expect(gradeStationTask(few, s).done).toBe(true)
  })
  it('place_part with an order and undo work in the zoo', () => {
    const jobs = zoo([
      { id: 'o', goal: 'place_part', order: ['grass-lion', 'ice-penguin'] },
      { id: 'u', goal: 'undo' },
    ])
    let s = run(jobs, [{ type: 'place', part: 'ice-penguin', spot: 'ice-2', ...drag }])
    // The penguin is not next, so it stays in the tray.
    expect(s.scene.placed).toEqual({})
    s = run(jobs, [{ type: 'place', part: 'grass-lion', spot: 'grass-2', ...drag }], s)
    expect(s.done.o).toBeUndefined()
    s = run(jobs, [{ type: 'place', part: 'ice-penguin', spot: 'ice-2', ...drag }], s)
    expect(s.done.o).toBeDefined()
    s = run(jobs, [{ type: 'undo', method: 'ctrl_z' }], s)
    expect(s.done.u).toBeDefined()
  })
  it('the keeper mistakes are preset in the wrong enclosures and undone with Ctrl+Z', () => {
    const t2 = zoo(
      [
        { id: 'u', goal: 'undo_mistakes' },
        { id: 's', goal: 'sort', target: 'grass' },
      ],
      { mistakes: [{ part: 'grass-lion', spot: 'ice-2' }] }
    )
    let s = initialStationState(t2)
    expect(s.scene.placed).toEqual({ 'ice-2': 'grass-lion' })
    expect(mistakesOf(s.scene)).toEqual(['ice-2'])
    expect(s.undo).toHaveLength(1)
    s = stationAction(s, { type: 'undo', method: 'ctrl_z' }, t2)
    expect(s.done.u).toBeDefined()
    expect(s.scene.placed).toEqual({})
  })
})

describe('the toy shop', () => {
  const t = toy([
    { id: 'o', goal: 'order_part', card: 'toy-kite' },
    { id: 'p', goal: 'place_part', card: 'toy-kite' },
    { id: 'c', goal: 'order_part', target: 'toy-rainbow-castle' },
  ])
  it('orders from the catalogue, then places the toy in the window', () => {
    let s = run(t, [{ type: 'order', part: 'toy-kite', scrolled: true, method: 'click' }])
    expect(s.done.o.scrolled).toBe(true)
    expect(trayParts(t, s.scene)).toEqual(['toy-kite'])
    s = run(t, [{ type: 'place', part: 'toy-kite', spot: 'shelf-1', ...drag }], s)
    expect(s.done.p).toBeDefined()
    s = run(t, [{ type: 'order', part: 'toy-rainbow-castle', method: 'click' }], s)
    expect(s.done.c).toBeDefined()
  })
  it('a 2x2 toy needs a 2x2 spot', () => {
    const s = run(t, [{ type: 'order', part: 'toy-rainbow-castle', method: 'click' }])
    expect(
      stationAction(s, { type: 'place', part: 'toy-rainbow-castle', spot: 'shelf-1', ...drag }, t)
    ).toBe(s)
    const placed = stationAction(
      s,
      { type: 'place', part: 'toy-rainbow-castle', spot: 'floor-2', ...drag },
      t
    )
    expect(placed.scene.placed['floor-2']).toBe('toy-rainbow-castle')
  })
})

describe('validation', () => {
  const errors = (t) => validateStationTask(t, 1)
  const sortItem = [{ id: 'a', goal: 'sort' }]
  it('accepts zoo and toy shop tasks, with or without a lesson', () => {
    expect(errors(zoo(sortItem))).toEqual([])
    expect(errors(zoo(sortItem, { lesson: 3 }))).toEqual([])
    expect(errors(toy([{ id: 'o', goal: 'order_part', card: 'toy-car' }]))).toEqual([])
    expect(definition.validateTask(zoo(sortItem), { n: 1 }).errors).toEqual([])
  })
  it.each([
    [zoo(sortItem, { world: 'moon' }), 'Task 1: world must be one of station, zoo, toyshop.'],
    [zoo(sortItem, { lesson: 4 }), 'Task 1: the zoo world is for lesson 3.'],
    [
      toy([{ id: 'a', goal: 'order_part' }], { lesson: 3 }),
      'Task 1: the toy shop world is for lesson 4.',
    ],
    [
      zoo([{ id: 'a', goal: 'power_on' }]),
      'Task 1 item 1: goal "power_on" isn\'t in the zoo world.',
    ],
    [
      zoo([{ id: 'a', goal: 'order_part' }]),
      'Task 1 item 1: goal "order_part" isn\'t in the zoo world.',
    ],
    [toy(sortItem), 'Task 1 item 1: goal "sort" isn\'t in the toy shop world.'],
    [station(3, sortItem), 'Task 1 item 1: goal "sort" isn\'t in the station world.'],
    [
      zoo([{ id: 'a', goal: 'place_part', target: 'dome' }]),
      'Task 1 item 1: target "dome" isn\'t in the zoo world.',
    ],
    [
      station(3, [{ id: 'a', goal: 'place_part', target: 'grass-lion' }]),
      'Task 1 item 1: target "grass-lion" isn\'t in the station world.',
    ],
    [
      zoo([{ id: 'a', goal: 'sort', target: 'sky' }]),
      'Task 1 item 1: target "sky" must be an enclosure kind from the zoo (ice, grass, jungle or water), or leave it out for every animal.',
    ],
    [
      zoo([{ id: 'a', goal: 'place_part', card: 'toy-car' }]),
      'Task 1 item 1: card "toy-car" isn\'t in the zoo world.',
    ],
    [
      zoo([{ id: 'a', goal: 'place_part', order: ['grass-lion', 'dome'] }]),
      'Task 1 item 1: order "dome" isn\'t in the zoo world.',
    ],
    [
      zoo(sortItem, { catalogue: ['dome'] }),
      'Task 1: catalogue part "dome" isn\'t in the zoo world.',
    ],
    [
      zoo([{ id: 'a', goal: 'undo_mistakes' }], {
        mistakes: [{ part: 'grass-lion', spot: 'grass-2' }],
      }),
      'Task 1 mistake 1: the Lion belongs on spot "grass-2"; a keeper\'s mistake goes in the wrong enclosure.',
    ],
    [
      zoo([{ id: 'a', goal: 'undo_mistakes' }], {
        mistakes: [{ part: 'ice-polar-bear', spot: 'grass-2' }],
      }),
      'Task 1 mistake 1: the Polar bear is too big for spot "grass-2".',
    ],
    [
      zoo([{ id: 'a', goal: 'undo_mistakes' }], { mistakes: [{ part: 'dome', spot: 'ice-2' }] }),
      'Task 1 mistake 1: part "dome" isn\'t in the zoo world.',
    ],
  ])('says so clearly: %#', (t, message) => {
    expect(errors(t)).toContain(message)
  })
  it('keeps the station-only rules (no crates, mistakes only in lesson 3)', () => {
    expect(errors(zoo(sortItem, { crates: [{ id: 'crate-1' }] }))).toContain(
      'Task 1: crates only applies to lesson 2.'
    )
    expect(
      errors(toy([{ id: 'a', goal: 'undo' }], { mistakes: [{ part: 'toy-car', spot: 'shelf-1' }] }))
    ).toContain('Task 1: mistakes only applies to lesson 3.')
  })
  it('prompts name the world', () => {
    expect(promptFor({ goal: 'sort' }, 3, 'zoo')).toBe(
      'Drag each animal into the enclosure where it lives.'
    )
    expect(promptFor({ goal: 'sort', target: 'water' }, 3, 'zoo')).toBe(
      'Take the pond animals to their home.'
    )
    expect(promptFor({ goal: 'place_part', target: 'grass-lion' }, 3, 'zoo')).toBe(
      'Put the Lion in the zoo.'
    )
  })
})

describe('carry: one scene per world', () => {
  const stationTask = station(3, [{ id: 'a', goal: 'place_part' }])
  const zooTask = zoo([{ id: 's', goal: 'sort' }])
  const slot = definition.carrySlot

  it('keeps the slot id, so no rules change is needed', () => {
    expect(slot.id).toBe('station')
  })
  it('saves { v: 2, worlds } with the state own world', () => {
    const s = run(stationTask, [{ type: 'place', part: 'dome', spot: 'top-module-1', ...drag }])
    const saved = slot.extract(s)
    expect(saved.v).toBe(2)
    expect(Object.keys(saved.worlds)).toEqual(['station'])
    expect(saved.worlds.station.placed['top-module-1']).toBe('dome')
  })
  it('a v1 save is the station world, and the zoo starts empty from it', () => {
    const v1 = {
      v: 1,
      scene: run(stationTask, [{ type: 'place', part: 'dome', spot: 'top-module-1', ...drag }])
        .scene,
    }
    expect(applyCarried(zooTask, v1).placed).toEqual({})
    expect(carriedOthers(zooTask, v1)).toHaveProperty('station')
    expect(applyCarried(stationTask, v1).placed).toHaveProperty('top-module-1', 'dome')
  })
  it('the zoo keeps the station scene it was carried in, and the station keeps the zoo', () => {
    const stationState = run(stationTask, [
      { type: 'place', part: 'solar', spot: 'bottom-module-1', ...drag },
    ])
    const saved1 = slot.extract(stationState)
    const zooState = slot.apply(zooTask, saved1)
    expect(zooState.world).toBe('zoo')
    const zooDone = run(
      zooTask,
      [{ type: 'place', part: 'ice-penguin', spot: 'ice-2', ...drag }],
      zooState
    )
    const saved2 = slot.extract(zooDone)
    expect(Object.keys(saved2.worlds).sort()).toEqual(['station', 'zoo'])
    expect(saved2.worlds.station.placed['bottom-module-1']).toBe('solar')
    expect(saved2.worlds.zoo.placed).toEqual({ 'ice-2': 'ice-penguin' })
    // Back to the station: its own scene is there and the zoo is kept for the next save.
    const back = slot.apply(stationTask, saved2)
    expect(back.scene.placed['bottom-module-1']).toBe('solar')
    expect(back.others.zoo.placed).toEqual({ 'ice-2': 'ice-penguin' })
    expect(slot.extract(back).worlds.zoo.placed).toEqual({ 'ice-2': 'ice-penguin' })
  })
  it('the keeper mistakes are not saved, and bad data never breaks the zoo', () => {
    const t = zoo([{ id: 'u', goal: 'undo_mistakes' }], {
      mistakes: [{ part: 'grass-lion', spot: 'ice-2' }],
    })
    const saved = carrySceneOf(initialStationState(t))
    expect(saved.worlds.zoo.placed).toEqual({})
    const junk = {
      v: 2,
      worlds: { zoo: { placed: { 'ice-2': 'grass-lion', 'top-part-1': 'ice-penguin', x: 'y' } } },
    }
    expect(applyCarried(zooTask, junk).placed).toEqual({})
  })
})
