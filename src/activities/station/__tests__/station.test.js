// @vitest-environment node
import { describe, expect, it } from 'vitest'
import definition from '../definition.js'
import {
  SPOTS,
  UNDO_LIMIT,
  applyCarried,
  catalogueFor,
  gradeStationTask,
  initialStationState,
  nearestSpot,
  partById,
  sceneForLesson,
  spotById,
  spotTakes,
  stationAction,
  stationProgress,
  trayParts,
  validateStationTask,
} from '../station.js'

// Pure logic tests for the Space station (docs/architecture/station-activity.md). The shared
// contract is checked for every activity by src/activities/__tests__/activityInterface.test.js.

const task = (lesson, items, extra = {}) => ({
  id: 1,
  taskType: 'activity',
  activityType: 'station',
  lesson,
  items,
  ...extra,
})
const run = (t, actions, state = initialStationState(t)) =>
  actions.reduce((s, a) => stationAction(s, { at: 1, ...a }, t), state)
const click = { method: 'click' }

describe('validateStationTask', () => {
  const ok = task(1, [{ id: 'a', goal: 'power_on' }])
  it('accepts valid tasks and the default task', () => {
    expect(validateStationTask(ok, 1)).toEqual([])
    expect(definition.validateTask(definition.defaultTask({ id: 1 }), { n: 1 }).errors).toEqual([])
  })

  const cases = [
    [
      { ...ok, lesson: 5 },
      'Task 2: lesson must be 1, 2, 3 or 4 (the station has only these lessons so far).',
    ],
    [{ ...ok, items: [] }, 'Task 2: station task needs at least one item.'],
    [
      { ...ok, coreItems: 4 },
      'Task 2: coreItems must be a whole number from 1 to 1 (the number of items).',
    ],
    [{ ...ok, catalogue: 'solar' }, 'Task 2: catalogue must be a list of part ids.'],
    [{ ...ok, catalogue: ['solar'] }, 'Task 2: catalogue only applies to lessons 3 and 4.'],
    [
      task(3, ok.items, { catalogue: ['nope'] }),
      'Task 2: catalogue part "nope" is not in the parts catalogue.',
    ],
    [
      task(3, ok.items, { catalogue: ['flag'] }),
      'Task 2: catalogue part "flag" is not available in lesson 3.',
    ],
    [{ ...ok, items: [{ goal: 'power_on' }] }, 'Task 2 item 1: needs an id.'],
    [{ ...ok, items: [ok.items[0], ok.items[0]] }, 'Task 2 item 2: id "a" is used more than once.'],
    [
      { ...ok, items: [{ id: 'a', goal: 'power_on', prompt: 4 }] },
      'Task 2 item 1: prompt must be text.',
    ],
    [
      { ...ok, items: [{ id: 'a', goal: 'fly' }] },
      /^Task 2 item 1: goal must be one of power_on, pick_colour/,
    ],
    [
      { ...ok, items: [{ id: 'a', goal: 'undo' }] },
      'Task 2 item 1: goal "undo" can\'t be done in lesson 1.',
    ],
    [
      { ...ok, items: [{ id: 'a', goal: 'pick_colour' }] },
      'Task 2 item 1: goal "pick_colour" needs a target (hull or lights).',
    ],
    [
      task(3, [{ id: 'a', goal: 'undo', target: 'x' }]),
      'Task 2 item 1: goal "undo" doesn\'t use a target.',
    ],
    [
      { ...ok, items: [{ id: 'a', goal: 'power_on', target: 'roof' }] },
      'Task 2 item 1: target "roof" must be a power section (left, core or right).',
    ],
    [
      task(2, [{ id: 'a', goal: 'open_crate', target: 'crate-9' }]),
      'Task 2 item 1: target "crate-9" must be a crate id (crate-1, crate-2 or crate-3).',
    ],
    [
      task(3, [{ id: 'a', goal: 'place_part', target: 'nope' }]),
      'Task 2 item 1: target "nope" must be a part id from the parts catalogue.',
    ],
    [
      task(3, [{ id: 'a', goal: 'place_part', target: 'telescope' }]),
      'Task 2 item 1: target "telescope" is not in this lesson\'s catalogue.',
    ],
  ]
  it.each(cases)('reports %#', (bad, message) => {
    const errors = validateStationTask(bad, 2)
    if (message instanceof RegExp) expect(errors.some((e) => message.test(e))).toBe(true)
    else expect(errors).toContain(message)
  })

  it('needs lesson and items (required fields)', () => {
    expect(validateStationTask({ items: ok.items }, 1).length).toBeGreaterThan(0)
    expect(validateStationTask({ lesson: 1 }, 1).length).toBeGreaterThan(0)
  })
})

describe('sceneForLesson', () => {
  it('Lesson 1 is dark with default colours', () => {
    const s = sceneForLesson(1)
    expect(Object.values(s.power)).toEqual([false, false, false])
    expect([s.hull, s.lights]).toEqual(['blue', 'orange'])
    expect(s.crates).toEqual({})
  })
  it('Lesson 2 is lit with three closed crates and no crew', () => {
    const s = sceneForLesson(2)
    expect(Object.values(s.power).every(Boolean)).toBe(true)
    expect(s.crates).toEqual({ 'crate-1': 'closed', 'crate-2': 'closed', 'crate-3': 'closed' })
    expect(s.crew).toEqual({})
    expect(s.captain).toBeNull()
  })
  it('Lesson 3 has open crates, crew at posts, a captain and an empty station', () => {
    const s = sceneForLesson(3)
    expect(Object.values(s.crates)).toEqual(['open', 'open', 'open'])
    expect(Object.keys(s.crew)).toHaveLength(3)
    expect(s.captain).toBe('crew-robot-1')
    expect(s.placed).toEqual({})
  })
  it('Lesson 4 has the Lesson 3 modules in default places and nothing ordered', () => {
    const s = sceneForLesson(4)
    expect(Object.values(s.placed).sort()).toEqual(['docking-arm', 'dome', 'greenhouse', 'solar'])
    expect(s.ordered).toEqual([])
  })
})

describe('applyCarried', () => {
  const t3 = task(3, [{ id: 'a', goal: 'undo' }])
  it('the saved scene wins', () => {
    const saved = {
      ...sceneForLesson(3),
      hull: 'red',
      lights: 'pink',
      placed: { 'top-module-1': 'dome' },
    }
    const s = applyCarried(t3, { v: 1, scene: saved })
    expect([s.hull, s.lights, s.placed]).toEqual(['red', 'pink', { 'top-module-1': 'dome' }])
  })
  it('catches up what earlier lessons unlock that the saved scene lacks', () => {
    const s = applyCarried(task(4, t3.items), { v: 1, scene: sceneForLesson(1) })
    expect(Object.values(s.power).every(Boolean)).toBe(true)
    expect(Object.values(s.crates)).toEqual(['open', 'open', 'open'])
    expect(s.captain).toBe('crew-robot-1')
    expect(Object.values(s.placed)).toContain('solar')
  })
  it('keeps a spot a saved part already holds when catching up', () => {
    const saved = { ...sceneForLesson(3), placed: { 'top-module-1': 'dome' } }
    const s = applyCarried(task(4, t3.items), { scene: saved })
    expect(s.placed['top-module-1']).toBe('dome')
    expect(Object.values(s.placed).filter((p) => p === 'solar')).toHaveLength(1)
  })
  it('is idempotent and starts from the lesson scene with nothing or junk saved', () => {
    const once = applyCarried(task(3, t3.items), { v: 1, scene: sceneForLesson(2) })
    expect(applyCarried(task(3, t3.items), { v: 1, scene: once })).toEqual(once)
    expect(applyCarried(t3, null)).toEqual(applyCarried(t3, { scene: 'junk' }))
  })
})

describe('stationAction', () => {
  it('power lights a section or all, and marks the goal with the method', () => {
    const t = task(1, [
      { id: 'core', goal: 'power_on', target: 'core' },
      { id: 'all', goal: 'power_on' },
    ])
    let s = run(t, [{ type: 'power', section: 'core', ...click }])
    expect(s.scene.power.core).toBe(true)
    expect(s.done.core.method).toBe('click')
    expect(s.done.all).toBeUndefined()
    s = run(t, [{ type: 'power', section: 'all', method: 'keyboard' }], s)
    expect(s.done.all.method).toBe('keyboard')
    expect(stationAction(s, { type: 'power', section: 'attic', ...click }, t)).toBe(s)
  })

  it('colour sets hull or lights and rejects unknown colours', () => {
    const t = task(1, [{ id: 'h', goal: 'pick_colour', target: 'hull' }])
    let s = run(t, [{ type: 'colour', target: 'lights', colour: 'pink', ...click }])
    expect(s.scene.lights).toBe('pink')
    expect(s.done.h).toBeUndefined()
    const before = s
    s = stationAction(s, { type: 'colour', target: 'hull', colour: 'mauve', ...click }, t)
    expect(s).toBe(before)
    s = run(t, [{ type: 'colour', target: 'hull', colour: 'red', ...click }], s)
    expect(s.scene.hull).toBe('red')
    expect(s.done.h.method).toBe('click')
  })

  it('select sets and clears the selection; only a single click counts', () => {
    const t = task(2, [{ id: 's', goal: 'select', target: 'crate-2' }])
    let s = run(t, [{ type: 'select', id: 'crate-1', ...click }])
    expect(s.selected).toBe('crate-1')
    expect(s.undo).toHaveLength(0)
    expect(s.done.s).toBeUndefined()
    s = run(t, [{ type: 'select', id: 'crate-2', ...click }], s)
    expect(s.done.s.method).toBe('click')
    s = run(t, [{ type: 'select', id: null, ...click }], s)
    expect(s.selected).toBeNull()
  })

  it('open_crate counts only by double-click; Enter opens but leaves the goal open', () => {
    const t = task(2, [{ id: 'o', goal: 'open_crate' }])
    let s = run(t, [{ type: 'open', crate: 'crate-1', method: 'keyboard' }])
    expect(s.scene.crates['crate-1']).toBe('open')
    expect(s.scene.crew['crew-robot-1']).toBe('crew-1')
    expect(s.done.o).toBeUndefined()
    expect(gradeStationTask(t, s).hint).toBe('Now try a double-click.')
    s = run(t, [{ type: 'open', crate: 'crate-2', method: 'double_click' }], s)
    expect(s.done.o.method).toBe('double_click')
    expect(s.scene.crew['crew-robot-2']).toBe('crew-2')
    expect(stationAction(s, { type: 'open', crate: 'crate-2', method: 'double_click' }, t)).toBe(s)
  })

  it('choose_captain needs a crew member at a post', () => {
    const t = task(2, [{ id: 'c', goal: 'choose_captain' }])
    let s = run(t, [{ type: 'captain', crew: 'crew-robot-2', ...click }])
    expect(s.scene.captain).toBeNull()
    expect(gradeStationTask(t, s).hint).toBe('Open a crate first.')
    s = run(t, [
      { type: 'open', crate: 'crate-2', method: 'double_click' },
      { type: 'captain', crew: 'crew-robot-2', ...click },
    ])
    expect(s.scene.captain).toBe('crew-robot-2')
    expect(s.done.c.method).toBe('click')
  })

  it('place_part counts by drag and by pick_drop, but not by a made-up method', () => {
    const t = task(3, [
      { id: 'p', goal: 'place_part', target: 'solar' },
      { id: 'q', goal: 'place_part', target: 'dome' },
    ])
    let s = run(t, [{ type: 'place', part: 'solar', spot: 'top-module-1', method: 'drag' }])
    expect(s.scene.placed).toEqual({ 'top-module-1': 'solar' })
    expect(s.done.p.method).toBe('drag')
    s = run(t, [{ type: 'place', part: 'dome', spot: 'top-module-2', method: 'pick_drop' }], s)
    expect(s.done.q.method).toBe('pick_drop')
    expect(trayParts(t, s.scene)).toEqual(['greenhouse', 'docking-arm'])
    const keyed = run(t, [
      { type: 'place', part: 'dome', spot: 'top-module-2', method: 'keyboard' },
    ])
    expect(keyed.done.q).toBeUndefined()
  })

  it('place_part rejects a full spot, an unknown spot and a part that is not on offer', () => {
    const t = task(3, [{ id: 'p', goal: 'place_part' }])
    const s = run(t, [{ type: 'place', part: 'solar', spot: 'top-module-1', method: 'drag' }])
    for (const bad of [
      { part: 'dome', spot: 'top-module-1' },
      { part: 'dome', spot: 'nowhere' },
      { part: 'telescope', spot: 'top-part-1' },
      { part: 'crate-1', spot: 'top-module-2' },
    ]) {
      expect(stationAction(s, { type: 'place', method: 'drag', ...bad }, t)).toBe(s)
    }
  })

  it('placing a placed part moves it', () => {
    const t = task(3, [{ id: 'p', goal: 'place_part' }])
    const s = run(t, [
      { type: 'place', part: 'solar', spot: 'top-module-1', method: 'drag' },
      { type: 'place', part: 'solar', spot: 'bottom-module-1', method: 'drag' },
    ])
    expect(s.scene.placed).toEqual({ 'bottom-module-1': 'solar' })
  })

  it('order adds to the tray (with scrolled recorded), then place takes it out', () => {
    const t = task(4, [
      { id: 'o', goal: 'order_part', target: 'telescope' },
      { id: 'p', goal: 'place_part', target: 'telescope' },
    ])
    let s = run(t, [{ type: 'order', part: 'rainbow-ring', scrolled: true, ...click }])
    expect(s.scene.ordered).toEqual(['rainbow-ring'])
    expect(s.done.o).toBeUndefined()
    s = run(t, [{ type: 'order', part: 'telescope', ...click }], s)
    expect(s.done.o).toMatchObject({ method: 'click', scrolled: false })
    expect(stationAction(s, { type: 'order', part: 'telescope', ...click }, t)).toBe(s)
    expect(stationAction(s, { type: 'order', part: 'solar', ...click }, t)).toBe(s)
    s = run(t, [{ type: 'place', part: 'telescope', spot: 'top-part-1', method: 'drag' }], s)
    expect(s.scene.ordered).toEqual(['rainbow-ring'])
    expect(s.done.p.method).toBe('drag')
    expect(catalogueFor(t)).toHaveLength(8)
  })

  it('ignores unknown actions', () => {
    const t = task(1, [{ id: 'a', goal: 'power_on' }])
    const s = initialStationState(t)
    expect(stationAction(s, { type: 'dance' }, t)).toBe(s)
  })
})

describe('undo', () => {
  const t = task(3, [
    { id: 'u', goal: 'undo' },
    { id: 'p', goal: 'place_part' },
  ])
  const placed = () =>
    run(t, [{ type: 'place', part: 'solar', spot: 'top-module-1', method: 'drag' }])

  it('puts the last change back and counts only by ctrl_z or cmd_z', () => {
    for (const method of ['ctrl_z', 'cmd_z']) {
      const s = run(t, [{ type: 'undo', method }], placed())
      expect(s.scene.placed).toEqual({})
      expect(s.undo).toHaveLength(0)
      expect(s.done.u.method).toBe(method)
      expect(s.done.p.method).toBe('drag')
    }
  })

  it('the tutor undo (or any other method) works but never completes the goal', () => {
    for (const method of ['tutor', 'click', undefined]) {
      const s = run(t, [{ type: 'undo', method }], placed())
      expect(s.scene.placed).toEqual({})
      expect(s.done.u).toBeUndefined()
    }
  })

  it('does nothing with nothing to undo, and keeps at most 15 changes', () => {
    const s = initialStationState(t)
    expect(stationAction(s, { type: 'undo', method: 'ctrl_z' }, t)).toBe(s)
    const colours = ['red', 'green', 'purple', 'orange']
    let many = s
    for (let i = 0; i < 20; i += 1) {
      many = run(t, [{ type: 'colour', target: 'hull', colour: colours[i % 4], ...click }], many)
    }
    expect(many.undo).toHaveLength(UNDO_LIMIT)
  })
})

describe('nearestSpot', () => {
  const topModule = SPOTS.find((x) => x.id === 'top-module-1')
  const inside = { x: topModule.x + topModule.w / 2, y: topModule.y + topModule.h / 2 }
  it('snaps inside or near an empty spot that takes the part, and null otherwise', () => {
    expect(nearestSpot({ placed: {} }, inside)).toBe('top-module-1')
    expect(nearestSpot({ placed: {} }, { x: inside.x, y: topModule.y - 0.03 })).toBe('top-module-1')
    expect(nearestSpot({ placed: { 'top-module-1': 'solar' } }, inside)).not.toBe('top-module-1')
    expect(nearestSpot({ placed: {} }, { x: 0.5, y: 0.97 })).toBeNull()
  })
  it('only offers spots the part fits: kind, size and hanging', () => {
    const bottom = SPOTS.find((x) => x.id === 'bottom-module-1')
    const under = { x: bottom.x + bottom.w / 2, y: bottom.y + bottom.h / 2 }
    expect(nearestSpot({ placed: {} }, under, 'solar')).toBe('bottom-module-1')
    expect(nearestSpot({ placed: {} }, under, 'dome')).not.toBe('bottom-module-1')
    const end = SPOTS.find((x) => x.id === 'end-left')
    const atEnd = { x: end.x + end.w / 2, y: end.y + end.h / 2 }
    expect(nearestSpot({ placed: {} }, atEnd, 'docking-arm')).toBe('end-left')
    expect(nearestSpot({ placed: {} }, atEnd, 'solar')).not.toBe('end-left')
    expect(nearestSpot({ placed: {} }, atEnd, 'telescope')).not.toBe('end-left')
  })
})

describe('the art layout', () => {
  it('has the 18 spots of parts.json with the hanging and mirror rules', () => {
    expect(SPOTS).toHaveLength(18)
    const by = Object.fromEntries(SPOTS.map((x) => [x.id, x]))
    expect(by['bottom-module-2']).toMatchObject({ flipY: true, onlyCanHang: true })
    expect(by['end-left'].flipX).toBe(true)
    expect(by['crew-3'].behindHull).toBe(true)
    expect(SPOTS.filter((x) => x.accepts.includes('power'))).toHaveLength(3)
  })
  it('spotTakes: dome never hangs, the rainbow ring does, a fuel-sized part fits by cells', () => {
    const by = Object.fromEntries(SPOTS.map((x) => [x.id, x]))
    expect(spotTakes(by['bottom-module-1'], partById('dome'))).toBe(false)
    expect(spotTakes(by['bottom-module-1'], partById('rainbow-ring'))).toBe(true)
    expect(spotTakes(by['end-right'], partById('docking-arm'))).toBe(true)
    expect(spotTakes(by['end-right'], partById('greenhouse'))).toBe(false)
    expect(spotTakes(by['top-part-1'], partById('telescope'))).toBe(true)
    expect(spotTakes(by['bottom-part-1'], partById('telescope'))).toBe(false)
    expect(spotTakes(by['bottom-part-1'], partById('dish'))).toBe(true)
  })
  it('the Lesson 4 catalogue has 8 to 12 items with the prize last', () => {
    const list = catalogueFor({ lesson: 4 })
    expect(list.length).toBeGreaterThanOrEqual(8)
    expect(list.length).toBeLessThanOrEqual(12)
    expect(list[list.length - 1]).toBe('rainbow-ring')
  })
  it('applyCarried drops unknown spot, part and post ids from an older saved station', () => {
    const old = {
      ...sceneForLesson(3),
      placed: { 'spot-3': 'dome', 'top-module-1': 'space-slide', 'top-module-2': 'greenhouse' },
      crew: { 'crew-robot': 'post-1', 'crew-plant': 'crew-4' },
      captain: 'crew-robot',
    }
    const s = applyCarried(task(4, [{ id: 'a', goal: 'undo' }]), { v: 1, scene: old })
    expect(s.placed['top-module-2']).toBe('greenhouse')
    expect(Object.keys(s.placed).every((id) => spotById(id))).toBe(true)
    expect(Object.values(s.placed).every((id) => partById(id))).toBe(true)
    expect(s.crew['crew-plant']).toBe('crew-4')
    expect(Object.values(s.crew).every((id) => spotById(id))).toBe(true)
    expect(partById(s.captain)).toBeTruthy()
  })
})

describe('grading and progress', () => {
  const t = task(
    1,
    [
      { id: 'a', goal: 'power_on', target: 'core' },
      { id: 'b', goal: 'pick_colour', target: 'lights' },
      { id: 'c', goal: 'pick_colour', target: 'hull' },
    ],
    { coreItems: 2 }
  )
  it.each([
    ['power_on', { id: 'a', goal: 'power_on' }, 'Click a power button to light up the station.'],
    [
      'pick_colour',
      { id: 'a', goal: 'pick_colour', target: 'hull' },
      'Click one of the colours for the hull.',
    ],
    ['select', { id: 'a', goal: 'select' }, 'Click once on a crate to pick it.'],
    ['open_crate', { id: 'a', goal: 'open_crate' }, 'Double-click a crate to open it.'],
    ['choose_captain', { id: 'a', goal: 'choose_captain' }, 'Open a crate first.'],
    ['place_part', { id: 'a', goal: 'place_part' }, 'Drag a part onto an empty spot.'],
    ['undo', { id: 'a', goal: 'undo' }, 'Change something first, then try to put it back.'],
    ['order_part', { id: 'a', goal: 'order_part' }, 'Scroll the list, then click Order.'],
  ])('hint for %s', (_name, item, hint) => {
    const tt = task(2, [item])
    expect(gradeStationTask(tt, initialStationState(tt)).hint).toBe(hint)
  })

  it('hints undo with the shortcut once there is a change to put back', () => {
    const tu = task(3, [{ id: 'u', goal: 'undo' }])
    const s = run(tu, [{ type: 'place', part: 'solar', spot: 'top-module-1', method: 'drag' }])
    expect(gradeStationTask(tu, s).hint).toBe('Press Ctrl+Z (Cmd+Z on a Mac) to put it back.')
  })

  it('passes at the core, counts bonus, and reports progress', () => {
    let s = run(t, [{ type: 'power', section: 'core', ...click }])
    expect(stationProgress(t, s)).toEqual({ done: 1, core: 2, total: 3 })
    expect(gradeStationTask(t, s).done).toBe(false)
    s = run(t, [{ type: 'colour', target: 'lights', colour: 'pink', ...click }], s)
    expect(gradeStationTask(t, s).done).toBe(true)
    expect(definition.grade(t, s)).toMatchObject({
      passed: true,
      itemResults: { a: true, c: false },
    })
    expect(definition.getProgress(t, s)).toMatchObject({ filled: 2, total: 2, bonus: 0 })
    s = run(t, [{ type: 'colour', target: 'hull', colour: 'red', ...click }], s)
    expect(definition.getProgress(t, s)).toMatchObject({ filled: 2, total: 2, bonus: 1 })
    expect(definition.summarize(t, s).tone).toBe('success')
  })
})

describe('definition', () => {
  const t = task(3, [
    { id: 'p', goal: 'place_part', target: 'solar' },
    { id: 'u', goal: 'undo' },
  ])

  it('solutionState passes', () => {
    expect(definition.grade(t, definition.solutionState(t)).passed).toBe(true)
  })

  it('is automatic, discrete, mouse-only and keeps only the last undo step in the shared state', () => {
    expect(definition.completion).toBe('auto')
    expect(definition.touchFallback).toBe('block')
    expect(definition.requires).toEqual({ finePointer: true })
    const s = run(t, [{ type: 'place', part: 'solar', spot: 'top-module-1', method: 'drag' }])
    expect(definition.classifyChange(initialStationState(t), s, t)).toBe('discrete')
    const shared = JSON.parse(definition.serializeShared(s))
    expect(shared.undo).toEqual([s.undo[s.undo.length - 1]])
    expect(shared.scene).toEqual(s.scene)
    expect(definition.serialize(s)).toContain('"undo"')
  })

  it('keeps state small (under 2 KB shared)', () => {
    let s = run(t, [
      { type: 'place', part: 'solar', spot: 'top-module-1', method: 'drag' },
      { type: 'place', part: 'dome', spot: 'top-module-2', method: 'drag' },
      { type: 'undo', method: 'ctrl_z' },
    ])
    s = { ...s, scene: sceneForLesson(4) }
    expect(definition.serializeShared(s).length).toBeLessThan(2048)
    expect(definition.serializeShared(definition.solutionState(t)).length).toBeLessThan(2048)
  })

  it('carrySlot extracts the scene and applies it over the lesson start', () => {
    const slot = definition.carrySlot
    expect(slot.id).toBe('station')
    const s = run(t, [{ type: 'place', part: 'solar', spot: 'top-module-1', method: 'drag' }])
    const carried = slot.extract(s)
    expect(carried).toEqual({ v: 1, scene: s.scene })
    const applied = slot.apply(task(4, [{ id: 'o', goal: 'order_part' }]), carried)
    expect(applied.scene.placed['top-module-1']).toBe('solar')
    expect(applied.done).toEqual({})
  })

  it('reports each goal with its methods', () => {
    const s = run(t, [{ type: 'place', part: 'solar', spot: 'top-module-1', method: 'pick_drop' }])
    const fields = definition.report.summaryFields(t, [
      { distinctAttempts: [{ submission: JSON.stringify(s) }] },
    ])
    expect(fields.goals.p).toEqual({ done: 1, methods: { pick_drop: 1 } })
    expect(fields.goals.u).toEqual({ done: 0, methods: {} })
  })
})
