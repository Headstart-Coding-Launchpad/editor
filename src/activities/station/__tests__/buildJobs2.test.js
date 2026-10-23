// @vitest-environment node
import { describe, expect, it } from 'vitest'
import definition from '../definition.js'
import {
  applyCarried,
  blockedBy,
  gradeStationTask,
  initialStationState,
  isActive,
  mistakesOf,
  stationAction,
  validateStationTask,
} from '../station.js'

// Lesson Gen review #190: more than one goal of a kind in Lesson 1 (a second start-up card, a second
// colour, a light pattern with power buttons that switch off) and the clumsy robot's drops in
// Lesson 3 (preset mistakes only Ctrl+Z removes).

const task = (lesson, items, extra = {}) => ({
  id: 1,
  taskType: 'activity',
  activityType: 'station',
  lesson,
  items,
  ...extra,
})
const run = (t, actions, state = initialStationState(t)) =>
  actions.reduce((s, a) => stationAction(s, { at: 1, method: 'click', ...a }, t), state)
const on = (section) => ({ type: 'power', section })
const off = (section) => ({ type: 'power', section, on: false })

describe('Lesson 1: power buttons switch off again', () => {
  const t = task(1, [{ id: 'all', goal: 'power_on' }])
  it('a second click switches a section off, and that never completes a goal', () => {
    const s = run(t, [on('left'), off('left')])
    expect(s.scene.power.left).toBe(false)
    expect(run(t, [off('core')]).scene.power.core).toBe(false)
    const target = task(1, [{ id: 'l', goal: 'power_on', target: 'left' }])
    expect(run(target, [on('left'), off('left')]).done.l).toBeTruthy()
    expect(run(target, [on('core'), off('core')]).done.l).toBeUndefined()
  })
  it('switching off is Lesson 1 only', () => {
    const t2 = task(2, [{ id: 'c', goal: 'choose_captain' }])
    const s = initialStationState(t2)
    expect(s.scene.power.left).toBe(true)
    expect(stationAction(s, off('left'), t2)).toBe(s)
  })
  it('an ordered goal lets a lit section be switched off but refuses a step out of order', () => {
    const t3 = task(1, [{ id: 'o', goal: 'power_on', order: ['left', 'core', 'right'] }])
    const s = run(t3, [on('left'), off('left'), on('core'), on('right')])
    expect(s.scene.power).toEqual({ left: false, core: false, right: false })
    expect(run(t3, [on('left'), on('core'), on('right')]).done.o).toBeTruthy()
  })
})

describe('Lesson 1: two power order goals', () => {
  const t = task(1, [
    { id: 'a', goal: 'power_on', order: ['left', 'core', 'right'] },
    { id: 'b', goal: 'power_on', order: ['right', 'core', 'left'] },
  ])
  it('the second card counts once the first is done, and the station switches off for it', () => {
    expect(isActive(t, {}, t.items[1])).toBe(false)
    expect(blockedBy(t, initialStationState(t), on('right'))).toBe(t.items[0])
    let s = run(t, [on('left'), on('core'), on('right')])
    expect(s.done.a).toBeTruthy()
    expect(s.done.b).toBeUndefined()
    expect(s.scene.power).toEqual({ left: false, core: false, right: false })
    expect(blockedBy(t, s, on('left'))).toBe(t.items[1])
    s = run(t, [on('right'), on('core'), on('left')], s)
    expect(s.done.b).toBeTruthy()
    expect(s.scene.power).toEqual({ left: true, core: true, right: true })
    expect(gradeStationTask(t, s).done).toBe(true)
  })
})

describe('Lesson 1: two Mission Control colours', () => {
  const t = task(1, [
    { id: 'one', goal: 'pick_colour', target: 'hull', match: 'red' },
    { id: 'two', goal: 'pick_colour', target: 'hull', match: 'green' },
  ])
  const hull = (colour) => ({ type: 'colour', target: 'hull', colour })
  it('the second colour only counts after the first is done', () => {
    let s = run(t, [hull('green')])
    expect(s.done.two).toBeUndefined()
    s = run(t, [hull('red')], s)
    expect(s.done.one).toBeTruthy()
    expect(s.done.two).toBeUndefined()
    s = run(t, [hull('green')], s)
    expect(s.done.two).toBeTruthy()
  })
})

describe('Lesson 1: light_pattern', () => {
  const pattern = { left: 'on', core: 'off', right: 'on' }
  const t = task(1, [
    { id: 'o', goal: 'power_on', order: ['left', 'core', 'right'] },
    { id: 'p', goal: 'light_pattern', pattern },
  ])
  it('is done when the power buttons match the card, starting from a dark station', () => {
    let s = run(t, [on('left'), on('core'), on('right')])
    expect(s.done.o).toBeTruthy()
    expect(s.scene.power).toEqual({ left: false, core: false, right: false })
    s = run(t, [on('left'), on('core')], s)
    expect(s.done.p).toBeUndefined()
    s = run(t, [off('core'), on('right')], s)
    expect(s.done.p.method).toBe('click')
  })
  it('does not count before the goals ahead of it are done', () => {
    expect(run(t, [on('left'), on('right')]).done.p).toBeUndefined()
  })
  it('takes YAML booleans as well as on / off', () => {
    const b = task(1, [
      { id: 'p', goal: 'light_pattern', pattern: { left: true, core: false, right: true } },
    ])
    expect(run(b, [on('left'), on('right')]).done.p).toBeTruthy()
  })
  it('validates the pattern', () => {
    const bad = (items) => validateStationTask(task(1, items), 1)
    expect(bad([{ id: 'p', goal: 'light_pattern', pattern }])).toEqual([])
    expect(bad([{ id: 'p', goal: 'light_pattern' }])).toContain(
      'Task 1 item 1: light_pattern needs a pattern, like { left: on, core: off, right: on }.'
    )
    expect(
      bad([{ id: 'p', goal: 'light_pattern', pattern: { left: 'on', core: 'off' } }])
    ).toContain('Task 1 item 1: pattern right must be on or off.')
    expect(
      bad([{ id: 'p', goal: 'light_pattern', pattern: { left: 'off', core: 'off', right: 'off' } }])
    ).toContain('Task 1 item 1: pattern needs at least one section on.')
    expect(
      bad([
        { id: 'p', goal: 'light_pattern', pattern: { left: 'on', core: 'off', right: 'on', x: 1 } },
      ])
    ).toContain('Task 1 item 1: pattern has "x", which is not a section (left, core, right).')
    expect(bad([{ id: 'p', goal: 'power_on', pattern }])).toContain(
      'Task 1 item 1: pattern only applies to light_pattern goals.'
    )
    expect(
      validateStationTask(task(3, [{ id: 'p', goal: 'light_pattern', pattern }]), 1)
    ).toContain('Task 1 item 1: goal "light_pattern" can\'t be done in lesson 3.')
  })
  it('rejects a repeated match for the same target', () => {
    const errors = validateStationTask(
      task(1, [
        { id: 'a', goal: 'pick_colour', target: 'hull', match: 'red' },
        { id: 'b', goal: 'pick_colour', target: 'hull', match: 'red' },
      ]),
      1
    )
    expect(errors).toContain('Task 1 item 2: match "red" is already used by an earlier hull goal.')
  })
})

describe("Lesson 3: the clumsy robot's drops (mistakes)", () => {
  const mistakes = [
    { part: 'greenhouse', spot: 'top-module-2' },
    { part: 'docking-arm', spot: 'end-right' },
  ]
  const t = task(
    3,
    [
      { id: 'undo', goal: 'undo_mistakes' },
      { id: 'dome', goal: 'place_part', target: 'dome' },
    ],
    { mistakes }
  )
  const ctrlZ = { type: 'undo', method: 'ctrl_z' }

  it('starts with the drops placed and one undo step for each', () => {
    const s = initialStationState(t)
    expect(s.scene.placed['top-module-2']).toBe('greenhouse')
    expect(s.scene.placed['end-right']).toBe('docking-arm')
    expect(mistakesOf(s.scene)).toEqual(['top-module-2', 'end-right'])
    expect(s.undo).toHaveLength(2)
  })
  it('Ctrl+Z removes them one at a time and the goal is done when all are gone', () => {
    let s = run(t, [ctrlZ])
    expect(mistakesOf(s.scene)).toEqual(['top-module-2'])
    expect(s.done.undo).toBeUndefined()
    s = run(t, [{ type: 'undo', method: 'cmd_z' }], s)
    expect(mistakesOf(s.scene)).toEqual([])
    expect(s.scene.placed['top-module-2']).toBeUndefined()
    expect(s.done.undo.method).toBe('cmd_z')
  })
  it('the tutor undo does not count', () => {
    const tutor = { type: 'undo', method: 'tutor' }
    const s = run(t, [tutor, tutor])
    expect(mistakesOf(s.scene)).toEqual([])
    expect(s.done.undo).toBeUndefined()
    expect(run(t, [ctrlZ], s).done.undo).toBeUndefined()
  })
  it("the child's own drops are undone first", () => {
    let s = run(t, [{ type: 'place', part: 'dome', spot: 'top-module-1', method: 'drag' }])
    s = run(t, [ctrlZ], s)
    expect(s.scene.placed['top-module-1']).toBeUndefined()
    expect(mistakesOf(s.scene)).toHaveLength(2)
  })
  it('a drop cannot be dragged away, only undone', () => {
    const move = { type: 'place', part: 'greenhouse', spot: 'top-module-1', from: 'top-module-2' }
    const s = initialStationState(t)
    expect(blockedBy(t, s, move)).toBe(t.items[0])
    expect(stationAction(s, { ...move, method: 'drag' }, t)).toBe(s)
  })

  describe('carry', () => {
    it("does not save the drops as the child's station", () => {
      const s = run(t, [{ type: 'place', part: 'dome', spot: 'top-module-1', method: 'drag' }])
      const carried = definition.carrySlot.extract(s)
      expect(carried.scene.placed).toEqual({ 'top-module-1': 'dome' })
      expect(carried.scene.mistakes).toBeUndefined()
      const next = applyCarried(task(3, [{ id: 'x', goal: 'undo' }]), carried)
      expect(Object.values(next.placed)).not.toContain('greenhouse')
      expect(Object.values(next.placed)).not.toContain('docking-arm')
    })
    it('a carried station in Lesson 3 gets the drops and their undo steps', () => {
      const applied = definition.carrySlot.apply(t, {
        v: 1,
        scene: { placed: { 'top-module-1': 'dome' } },
      })
      expect(applied.scene.placed['top-module-1']).toBe('dome')
      expect(mistakesOf(applied.scene)).toHaveLength(2)
      expect(applied.undo).toHaveLength(2)
    })
    it('skips a drop whose spot or part is already built', () => {
      const applied = definition.carrySlot.apply(t, {
        v: 1,
        scene: { placed: { 'top-module-2': 'solar', 'end-left': 'docking-arm' } },
      })
      expect(mistakesOf(applied.scene)).toEqual([])
      expect(applied.undo).toHaveLength(0)
    })
    it('a powered station is carried on from Lesson 1', () => {
      const dark = { v: 1, scene: { power: { left: true, core: false, right: false } } }
      const next = applyCarried(task(2, [{ id: 'c', goal: 'choose_captain' }]), dark)
      expect(next.power).toEqual({ left: true, core: true, right: true })
    })
  })

  describe('validation', () => {
    const bad = (extra, items = t.items) => validateStationTask(task(3, items, extra), 3)
    it('accepts the example', () => {
      expect(bad({ mistakes })).toEqual([])
    })
    const cases = [
      [
        { mistakes: 'x' },
        'Task 3: mistakes must be a list of 1 to 4 drops, each with a part and a spot.',
      ],
      [
        { mistakes: [] },
        'Task 3: mistakes must be a list of 1 to 4 drops, each with a part and a spot.',
      ],
      [
        { mistakes: [{ part: 'banana', spot: 'top-module-1' }] },
        'Task 3 mistake 1: part must be a module or part id from the parts catalogue.',
      ],
      [
        { mistakes: [{ part: 'telescope', spot: 'top-part-1' }] },
        'Task 3 mistake 1: part "telescope" is not in this lesson\'s catalogue.',
      ],
      [
        { mistakes: [{ part: 'dome', spot: 'top-module-1' }] },
        'Task 3 mistake 1: part "dome" is also asked for by a place_part goal; pick another part.',
      ],
      [
        { mistakes: [{ part: 'greenhouse', spot: 'nowhere' }] },
        /^Task 3 mistake 1: spot must be one of top-module-1/,
      ],
      [
        { mistakes: [{ part: 'greenhouse', spot: 'top-part-1' }] },
        'Task 3 mistake 1: the Greenhouse doesn\'t fit on spot "top-part-1".',
      ],
      [
        {
          mistakes: [
            { part: 'greenhouse', spot: 'top-module-2' },
            { part: 'solar', spot: 'top-module-2' },
          ],
        },
        'Task 3 mistake 2: spot "top-module-2" is used more than once.',
      ],
    ]
    it.each(cases)('reports %#', (extra, message) => {
      const errors = bad(extra)
      if (message instanceof RegExp) expect(errors.some((e) => message.test(e))).toBe(true)
      else expect(errors).toContain(message)
    })
    it('needs the goal, and the goal needs the mistakes', () => {
      expect(bad({ mistakes }, [{ id: 'd', goal: 'place_part', target: 'dome' }])).toContain(
        'Task 3: mistakes needs an undo_mistakes goal to put them back.'
      )
      expect(bad({}, [{ id: 'u', goal: 'undo_mistakes' }])).toContain(
        "Task 3 item 1: undo_mistakes needs the task's mistakes list."
      )
    })
    it('is Lesson 3 only', () => {
      expect(
        validateStationTask(task(4, [{ id: 'u', goal: 'undo_mistakes' }], { mistakes }), 4)
      ).toContain('Task 4: mistakes only applies to lesson 3.')
    })
  })
})
