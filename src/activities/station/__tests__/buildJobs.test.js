// @vitest-environment node
import { describe, expect, it } from 'vitest'
import definition from '../definition.js'
import {
  CRATE_IDS,
  DEFAULT_CRATE_IDS,
  applyCarried,
  blockedBy,
  countProgress,
  crateIdsFor,
  gradeStationTask,
  initialStationState,
  promptFor,
  stationAction,
  stationProgress,
  stickerOf,
  trayParts,
  validateStationTask,
} from '../station.js'

// Build jobs (Hub #101, Lesson Gen LG-P8): the first-N core, ordered goals, match and card,
// decoy crates with stickers, exact counts and the undo count. Pure model tests; the screen is
// covered in buildJobsUi.test.jsx.

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

describe('coreItems: the first N goals are the round', () => {
  const t = task(
    1,
    [
      { id: 'a', goal: 'power_on', target: 'core' },
      { id: 'b', goal: 'pick_colour', target: 'lights' },
      { id: 'c', goal: 'pick_colour', target: 'hull' },
    ],
    { coreItems: 2 }
  )
  const lights = { type: 'colour', target: 'lights', colour: 'pink', ...click }
  const hull = { type: 'colour', target: 'hull', colour: 'red', ...click }
  const core = { type: 'power', section: 'core', ...click }

  it('a bonus goal done early does not finish the round', () => {
    const s = run(t, [hull, lights])
    const r = gradeStationTask(t, s)
    expect(r.correct).toBe(2)
    expect(r.coreDone).toBe(1)
    expect(r.done).toBe(false)
    expect(r.flags).toEqual([false, true, true])
    expect(stationProgress(t, s)).toEqual({ done: 1, core: 2, total: 3 })
    expect(definition.grade(t, s).passed).toBe(false)
    expect(definition.summarize(t, s).text).toBe('1/2 goals')
  })

  it('finishes once the first two are done, and the bonus then counts on top', () => {
    const s = run(t, [lights, core])
    expect(gradeStationTask(t, s).done).toBe(true)
    expect(definition.grade(t, s).passed).toBe(true)
    expect(stationProgress(t, s)).toEqual({ done: 2, core: 2, total: 3 })
    const all = run(t, [hull], s)
    expect(stationProgress(t, all)).toEqual({ done: 3, core: 2, total: 3 })
    expect(definition.summarize(t, all).text).toBe('2/2 goals · +1 bonus')
  })

  it('without coreItems every goal is required', () => {
    const all = { ...t, coreItems: undefined }
    expect(gradeStationTask(all, run(all, [lights, core])).done).toBe(false)
    expect(gradeStationTask(all, run(all, [lights, core, hull])).done).toBe(true)
  })
})

describe('ordered goals (order: [...])', () => {
  const power = (section) => ({ type: 'power', section, ...click })

  it('a wrong next section changes nothing: same state, no undo entry', () => {
    const t = task(1, [{ id: 'p', goal: 'power_on', order: ['left', 'core', 'right'] }])
    const start = initialStationState(t)
    const wrong = stationAction(start, power('core'), t)
    expect(wrong).toBe(start)
    expect(wrong.undo).toEqual([])
    expect(blockedBy(t, start, power('core')).id).toBe('p')
    expect(blockedBy(t, start, power('left'))).toBeNull()
  })

  it('the right order completes it; "all" is refused while it is ordered', () => {
    const t = task(1, [{ id: 'p', goal: 'power_on', order: ['left', 'core', 'right'] }])
    const start = initialStationState(t)
    expect(stationAction(start, { type: 'power', section: 'all', ...click }, t)).toBe(start)
    let s = run(t, [power('left'), power('right')])
    expect(s.scene.power).toEqual({ left: true, core: false, right: false })
    expect(s.done.p).toBeUndefined()
    s = run(t, [power('core'), power('right')], s)
    expect(s.done.p.method).toBe('click')
    expect(gradeStationTask(t, s).hint).toBeNull()
  })

  it('open_crate order: only the next crate opens', () => {
    const t = task(2, [{ id: 'o', goal: 'open_crate', order: ['crate-2', 'crate-1'] }])
    const open = (crate) => ({ type: 'open', crate, method: 'double_click' })
    const start = initialStationState(t)
    expect(stationAction(start, open('crate-1'), t)).toBe(start)
    // crate-3 is not in the order: not guarded.
    expect(stationAction(start, open('crate-3'), t)).not.toBe(start)
    expect(run(t, [open('crate-2'), open('crate-1')]).done.o).toBeTruthy()
  })

  it('place_part order: parts go on in the plan order; moving a placed part is free', () => {
    const t = task(3, [{ id: 'b', goal: 'place_part', order: ['dome', 'solar', 'greenhouse'] }])
    const put = (part, spot, extra = {}) => ({
      type: 'place',
      part,
      spot,
      method: 'drag',
      ...extra,
    })
    const start = initialStationState(t)
    expect(stationAction(start, put('solar', 'top-module-1'), t)).toBe(start)
    let s = run(t, [put('dome', 'top-module-1')])
    expect(stationAction(s, put('greenhouse', 'top-module-2'), t)).toBe(s)
    s = run(t, [put('dome', 'top-module-2', { from: 'top-module-1' })], s)
    expect(s.scene.placed['top-module-2']).toBe('dome')
    s = run(t, [put('solar', 'bottom-module-1'), put('greenhouse', 'top-module-1')], s)
    expect(s.done.b).toBeTruthy()
  })

  it('a goal that is done no longer refuses', () => {
    const t = task(1, [{ id: 'p', goal: 'power_on', order: ['left', 'core'] }])
    const s = run(t, [power('left'), power('core')])
    expect(blockedBy(t, s, power('right'))).toBeNull()
  })

  it('hints and prompts name the card, not the answer', () => {
    const t = task(1, [{ id: 'p', goal: 'power_on', order: ['left', 'core'] }])
    expect(gradeStationTask(t, initialStationState(t)).hint).toBe(
      'Look at the card and switch them on in that order.'
    )
    expect(promptFor(t.items[0], 1)).toBe(
      'Switch on each part of the station in the order on the card.'
    )
  })
})

describe('pick the right one (match, card)', () => {
  it('match: only the matching swatch counts; others still recolour', () => {
    const t = task(1, [{ id: 'h', goal: 'pick_colour', target: 'hull', match: 'red' }])
    let s = run(t, [{ type: 'colour', target: 'hull', colour: 'green', ...click }])
    expect(s.scene.hull).toBe('green')
    expect(s.done.h).toBeUndefined()
    expect(gradeStationTask(t, s).hint).toBe(
      'Look at the card, then click the colour that matches it.'
    )
    s = run(t, [{ type: 'colour', target: 'hull', colour: 'red', ...click }], s)
    expect(s.done.h).toBeTruthy()
  })

  it('card: the part on the card is the one that counts for order_part and place_part', () => {
    const t = task(4, [
      { id: 'o', goal: 'order_part', card: 'dish' },
      { id: 'p', goal: 'place_part', card: 'flag' },
    ])
    let s = run(t, [{ type: 'order', part: 'telescope', ...click }])
    expect(s.done.o).toBeUndefined()
    expect(gradeStationTask(t, s).hint).toBe(
      'Look at the picture on the card, scroll to find that part, then click Order.'
    )
    s = run(
      t,
      [
        { type: 'order', part: 'dish', ...click },
        { type: 'order', part: 'flag', ...click },
        { type: 'place', part: 'telescope', spot: 'top-part-1', method: 'drag' },
      ],
      s
    )
    expect(s.done.o).toBeTruthy()
    expect(s.done.p).toBeUndefined()
    s = run(t, [{ type: 'place', part: 'flag', spot: 'ring-top', method: 'drag' }], s)
    expect(s.done.p).toBeTruthy()
    expect(promptFor(t.items[0], 4)).toBe('Find the part in the picture and order it.')
    expect(promptFor(t.items[1], 4)).toBe('Find the part in the picture and put it on the station.')
  })
})

describe('decoys: crates, stickers and the delivery note', () => {
  const crates = [
    { id: 'crate-1', sticker: 'red-star' },
    { id: 'crate-2', sticker: 'blue-circle' },
    { id: 'crate-3', sticker: 'green-triangle' },
    { id: 'crate-4', sticker: 'red-star' },
    { id: 'crate-5' },
  ]
  const t = task(2, [{ id: 'n', goal: 'open_crate', onlyNoted: true }], {
    crates,
    note: ['red-star', 'green-triangle'],
  })
  const open = (crate) => ({ type: 'open', crate, method: 'double_click' })

  it('starts with the five crates closed, and crate-4 holds robot 3', () => {
    const s = initialStationState(t)
    expect(Object.keys(s.scene.crates)).toEqual(CRATE_IDS)
    expect(Object.values(s.scene.crates).every((c) => c === 'closed')).toBe(true)
    const opened = run(t, [open('crate-4')], s)
    expect(opened.scene.crew['crew-robot-3']).toBeTruthy()
  })

  it('a decoy stays shut and costs nothing; the noted crates complete it', () => {
    const start = initialStationState(t)
    expect(stationAction(start, open('crate-2'), t)).toBe(start)
    expect(stationAction(start, open('crate-5'), t)).toBe(start)
    let s = run(t, [open('crate-1'), open('crate-3')])
    expect(s.done.n).toBeUndefined()
    s = run(t, [open('crate-4')], s)
    expect(s.done.n.method).toBe('double_click')
    expect(s.undo).toHaveLength(3)
  })

  it('the decoys stay shut even after the goal is done', () => {
    const s = run(t, [open('crate-1'), open('crate-3'), open('crate-4')])
    expect(stationAction(s, open('crate-2'), t)).toBe(s)
  })

  it('without a crates list the bay is the first three, with no stickers', () => {
    const plain = task(2, [{ id: 'o', goal: 'open_crate' }])
    expect(Object.keys(initialStationState(plain).scene.crates)).toEqual(DEFAULT_CRATE_IDS)
    expect(stickerOf(plain, 'crate-1')).toBeNull()
    expect(crateIdsFor(t)).toEqual(CRATE_IDS)
  })

  it('catch-up opens only the crates the saved station has', () => {
    const lesson2 = run(t, [open('crate-1')])
    const carried = applyCarried(task(3, [{ id: 'p', goal: 'place_part' }]), {
      v: 1,
      scene: lesson2.scene,
    })
    expect(Object.values(carried.crates).every((c) => c === 'open')).toBe(true)
    expect(Object.keys(carried.crates)).toEqual(CRATE_IDS)
  })

  it('the hint tells the child to read the stickers', () => {
    expect(gradeStationTask(t, initialStationState(t)).hint).toMatch(/Read the stickers/)
    expect(promptFor(t.items[0], 2)).toBe('Open only the crates on the delivery note.')
  })
})

describe('exact counts (count: n)', () => {
  const put = (spot, extra = {}) => ({
    type: 'place',
    part: 'solar',
    spot,
    method: 'drag',
    ...extra,
  })

  it('place_part: the same part can come from the tray again and again; done at exactly n', () => {
    const t = task(3, [{ id: 's', goal: 'place_part', target: 'solar', count: 3 }])
    expect(trayParts(t, initialStationState(t).scene)).toContain('solar')
    let s = run(t, [put('top-module-1'), put('top-module-2')])
    expect(trayParts(t, s.scene)).toContain('solar')
    expect(s.done.s).toBeUndefined()
    expect(countProgress(t, t.items[0], s)).toEqual({ have: 2, need: 3 })
    expect(gradeStationTask(t, s).hint).toBe('Drag 1 more copy onto the station.')
    s = run(t, [put('bottom-module-1')], s)
    expect(Object.values(s.scene.placed)).toEqual(['solar', 'solar', 'solar'])
    expect(s.done.s).toBeTruthy()
    expect(promptFor(t.items[0], 3)).toBe('Put exactly three Solar panels on the station.')
  })

  it('moving a placed copy (from) does not add one', () => {
    const t = task(3, [{ id: 's', goal: 'place_part', target: 'solar', count: 2 }])
    let s = run(t, [put('top-module-1')])
    s = run(t, [put('top-module-2', { from: 'top-module-1' })], s)
    expect(Object.keys(s.scene.placed)).toEqual(['top-module-2'])
    expect(s.done.s).toBeUndefined()
  })

  it('a part that is not counted is still placed once only', () => {
    const t = task(3, [{ id: 'd', goal: 'place_part', target: 'dome' }])
    const s = run(t, [
      { type: 'place', part: 'dome', spot: 'top-module-1', method: 'drag' },
      { type: 'place', part: 'dome', spot: 'top-module-2', method: 'drag', from: 'top-module-1' },
    ])
    expect(Object.keys(s.scene.placed)).toEqual(['top-module-2'])
  })

  it('open_crate count: done when exactly n are open', () => {
    const t = task(2, [{ id: 'c', goal: 'open_crate', count: 2 }])
    const open = (crate) => ({ type: 'open', crate, method: 'double_click' })
    let s = run(t, [open('crate-1')])
    expect(s.done.c).toBeUndefined()
    expect(gradeStationTask(t, s).hint).toBe('Double-click to open 1 more crate.')
    s = run(t, [open('crate-3')], s)
    expect(s.done.c).toBeTruthy()
    expect(promptFor(t.items[0], 2)).toBe('Open exactly two crates.')
  })

  it('a saved station keeps its copies of a counted part', () => {
    const t = task(3, [{ id: 's', goal: 'place_part', target: 'solar', count: 2 }])
    const s = run(t, [put('top-module-1'), put('top-module-2')])
    const back = applyCarried(t, { v: 1, scene: s.scene })
    expect(Object.values(back.placed).filter((p) => p === 'solar')).toHaveLength(2)
  })
})

describe('undo count', () => {
  const t = task(3, [{ id: 'u', goal: 'undo', count: 3 }])
  const put = (part, spot) => ({ type: 'place', part, spot, method: 'drag' })
  const setup = () =>
    run(t, [
      put('dome', 'top-module-1'),
      put('greenhouse', 'top-module-2'),
      put('solar', 'bottom-module-1'),
      put('docking-arm', 'end-left'),
    ])

  it('counts only presses that really undo', () => {
    let s = setup()
    s = run(t, [{ type: 'undo', method: 'tutor' }], s)
    expect(s.undos).toBe(0)
    s = run(
      t,
      [
        { type: 'undo', method: 'ctrl_z' },
        { type: 'undo', method: 'cmd_z' },
      ],
      s
    )
    expect(s.undos).toBe(2)
    expect(s.done.u).toBeUndefined()
    expect(gradeStationTask(t, s).hint).toBe('Press Ctrl+Z (Cmd+Z on a Mac) 1 more time.')
    s = run(t, [{ type: 'undo', method: 'ctrl_z' }], s)
    expect(s.done.u).toBeTruthy()
  })

  it('a press with nothing to undo does not count', () => {
    const s = run(t, [{ type: 'undo', method: 'ctrl_z' }])
    expect(s.undos).toBe(0)
    expect(promptFor(t.items[0], 3)).toBe('Step back three times with Ctrl+Z.')
  })
})

describe('validation of the build-job fields', () => {
  const bad = (t) => validateStationTask(t, 2)
  const crates = [
    { id: 'crate-1', sticker: 'red-star' },
    { id: 'crate-2', sticker: 'blue-circle' },
  ]
  const cases = [
    [
      task(1, [{ id: 'a', goal: 'pick_colour', target: 'hull', order: ['left', 'core'] }]),
      'Task 2 item 1: order only applies to power_on, open_crate, place_part goals.',
    ],
    [
      task(1, [{ id: 'a', goal: 'power_on', order: ['left'] }]),
      'Task 2 item 1: order must be a list of at least 2 ids.',
    ],
    [
      task(1, [{ id: 'a', goal: 'power_on', order: ['left', 'left'] }]),
      'Task 2 item 1: order lists the same id twice.',
    ],
    [
      task(1, [{ id: 'a', goal: 'power_on', order: ['left', 'roof'] }]),
      'Task 2 item 1: order "roof" must be a power section (left, core or right).',
    ],
    [
      task(1, [{ id: 'a', goal: 'power_on', target: 'core', order: ['left', 'core'] }]),
      "Task 2 item 1: order can't be used with a target or a card; list the ids in order instead.",
    ],
    [
      task(2, [{ id: 'a', goal: 'open_crate', order: ['crate-1', 'crate-4'] }], { crates }),
      'Task 2 item 1: order "crate-4" must be a crate in this task (crate-1, crate-2).',
    ],
    [
      task(3, [{ id: 'a', goal: 'place_part', order: ['solar', 'flag'] }]),
      'Task 2 item 1: order "flag" must be a part in this lesson\'s catalogue.',
    ],
    [
      task(1, [{ id: 'a', goal: 'power_on', match: 'red' }]),
      'Task 2 item 1: match only applies to pick_colour goals.',
    ],
    [
      task(1, [{ id: 'a', goal: 'pick_colour', target: 'hull', match: 'white' }]),
      /^Task 2 item 1: match "white" must be one of the hull colours: blue, red/,
    ],
    [
      task(4, [{ id: 'a', goal: 'select', card: 'dish' }]),
      'Task 2 item 1: card only applies to order_part and place_part goals.',
    ],
    [
      task(4, [{ id: 'a', goal: 'order_part', target: 'dish', card: 'dish' }]),
      "Task 2 item 1: card can't be used with a target; the part on the card is the target.",
    ],
    [
      task(4, [{ id: 'a', goal: 'order_part', card: 'nope' }]),
      'Task 2 item 1: card "nope" must be a part id from the parts catalogue.',
    ],
    [
      task(4, [{ id: 'a', goal: 'order_part', card: 'solar' }]),
      'Task 2 item 1: card "solar" is not in this lesson\'s catalogue.',
    ],
    [
      task(2, [{ id: 'a', goal: 'select', onlyNoted: true }]),
      'Task 2 item 1: onlyNoted only applies to open_crate goals.',
    ],
    [
      task(2, [{ id: 'a', goal: 'open_crate', onlyNoted: 'yes' }], { crates, note: ['red-star'] }),
      'Task 2 item 1: onlyNoted must be true or false.',
    ],
    [
      task(2, [{ id: 'a', goal: 'open_crate', onlyNoted: true }]),
      "Task 2 item 1: onlyNoted needs the task's note and crates (with stickers).",
    ],
    [
      task(2, [{ id: 'a', goal: 'open_crate', target: 'crate-1', onlyNoted: true }], {
        crates,
        note: ['red-star'],
      }),
      "Task 2 item 1: onlyNoted can't be used with a target; the note says which crates.",
    ],
    [
      task(2, [{ id: 'a', goal: 'open_crate', onlyNoted: true, order: ['crate-1', 'crate-2'] }], {
        crates,
        note: ['red-star'],
      }),
      'Task 2 item 1: order "crate-2" is not a crate the note lists.',
    ],
    [
      task(2, [{ id: 'a', goal: 'choose_captain', count: 2 }]),
      'Task 2 item 1: count only applies to place_part, open_crate, undo goals.',
    ],
    [
      task(3, [{ id: 'a', goal: 'undo', count: 1 }]),
      'Task 2 item 1: count must be a whole number from 2 to 9 (Ctrl+Z presses).',
    ],
    [
      task(2, [{ id: 'a', goal: 'open_crate', count: 4 }]),
      'Task 2 item 1: count must be a whole number from 2 to 3 (the crates in this task).',
    ],
    [
      task(2, [{ id: 'a', goal: 'open_crate', count: 2, target: 'crate-1' }]),
      "Task 2 item 1: count can't be used with a target, order or onlyNoted.",
    ],
    [
      task(3, [{ id: 'a', goal: 'place_part', count: 2 }]),
      'Task 2 item 1: count needs a target part, like "put exactly 3 solar panels".',
    ],
    [
      task(3, [{ id: 'a', goal: 'place_part', target: 'solar', count: 5 }]),
      'Task 2 item 1: count must be a whole number from 2 to 4 (the spots that take the Solar panel).',
    ],
    [
      task(4, [{ id: 'a', goal: 'place_part', target: 'flag', count: 2 }]),
      'Task 2 item 1: count on place_part only works in lesson 3.',
    ],
    [
      task(3, [
        { id: 'a', goal: 'place_part', target: 'solar', count: 2, order: ['dome', 'solar'] },
      ]),
      "Task 2 item 1: count can't be used with an order or a card.",
    ],
    [
      task(2, [{ id: 'a', goal: 'open_crate', target: 'crate-4' }], { crates }),
      'Task 2 item 1: target "crate-4" is not one of this task\'s crates.',
    ],
    [
      task(2, [{ id: 'a', goal: 'open_crate' }], { crates: [] }),
      'Task 2: crates must be a list of 1 to 5 crates, each with an id.',
    ],
    [
      task(2, [{ id: 'a', goal: 'open_crate' }], { crates: [{ id: 'crate-9' }] }),
      'Task 2 crate 1: id must be one of crate-1, crate-2, crate-3, crate-4, crate-5.',
    ],
    [
      task(2, [{ id: 'a', goal: 'open_crate' }], {
        crates: [{ id: 'crate-1' }, { id: 'crate-1' }],
      }),
      'Task 2 crate 2: id "crate-1" is used more than once.',
    ],
    [
      task(2, [{ id: 'a', goal: 'open_crate' }], { crates: [{ id: 'crate-1', sticker: 'red' }] }),
      /^Task 2 crate 1: sticker "red" must be a colour and a shape joined with a dash, like red-star/,
    ],
    [
      task(3, [{ id: 'a', goal: 'place_part' }], { crates }),
      'Task 2: crates only applies to lesson 2.',
    ],
    [
      task(2, [{ id: 'a', goal: 'open_crate' }], { crates, note: [] }),
      'Task 2: note must be a list of stickers.',
    ],
    [
      task(2, [{ id: 'a', goal: 'open_crate' }], { note: ['red-star'] }),
      'Task 2: note needs crates with stickers to match it.',
    ],
    [
      task(2, [{ id: 'a', goal: 'open_crate' }], { crates, note: ['green-star'] }),
      'Task 2: note sticker "green-star" is not on any crate.',
    ],
    [
      task(2, [{ id: 'a', goal: 'open_crate' }], { crates, note: ['smiley'] }),
      /^Task 2: note sticker "smiley" must be a colour and a shape/,
    ],
    [
      task(1, [{ id: 'a', goal: 'power_on' }], { note: ['red-star'] }),
      'Task 2: note only applies to lesson 2.',
    ],
  ]
  it.each(cases)('reports %#', (t, message) => {
    const errors = bad(t)
    if (message instanceof RegExp) expect(errors.some((e) => message.test(e))).toBe(true)
    else expect(errors).toContain(message)
  })

  it('accepts a valid task using every new field', () => {
    const t = task(
      2,
      [
        { id: 'n', goal: 'open_crate', onlyNoted: true },
        { id: 'o', goal: 'open_crate', order: ['crate-1', 'crate-2'] },
        { id: 'c', goal: 'open_crate', count: 2 },
      ],
      { crates, note: ['red-star'] }
    )
    expect(bad(t)).toEqual([])
    expect(
      bad(
        task(4, [
          { id: 'a', goal: 'order_part', card: 'dish' },
          { id: 'b', goal: 'place_part', card: 'flag' },
        ])
      )
    ).toEqual([])
  })
})
