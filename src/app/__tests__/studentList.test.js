import { describe, expect, it } from 'vitest'
import {
  ageWords,
  classifyStudentRow,
  orderStudentRows,
  outputStub,
  rowGroup,
  rowOutputText,
  sameOutputSummary,
  summariseRowStates,
} from '../studentList.js'
import { ERROR_LOOP_RUNS, STUCK_FAILS } from '../needsYou.js'

const check = (over = {}) => ({
  hasCheck: true,
  passed: false,
  failed: false,
  errored: false,
  ...over,
})

describe('classifyStudentRow', () => {
  const online = { anonymousId: 'a', online: true }

  it('says Needs help above everything else, Stuck included', () => {
    const state = classifyStudentRow(
      { ...online, needsHelp: true },
      { checkStatus: check({ failed: true }), needs: { kind: 'help' } }
    )
    expect(state.status).toBe('help')
  })

  it(`calls ${STUCK_FAILS} failed checks in a row Stuck, with the count`, () => {
    const state = classifyStudentRow(
      { ...online, studentHint: { failStreak: 4 } },
      { checkStatus: check({ failed: true }), needs: { kind: 'stuck' } }
    )
    expect(state).toMatchObject({ status: 'stuck', stuck: { kind: 'fails', count: 4 } })
  })

  it(`calls the same error ${ERROR_LOOP_RUNS} runs in a row Stuck, with the count`, () => {
    const state = classifyStudentRow(online, {
      checkStatus: check({ errored: true }),
      needs: { kind: 'error' },
      errorRuns: { count: 3, error: 'NameError' },
    })
    expect(state).toMatchObject({ status: 'stuck', stuck: { kind: 'error', count: 3 } })
  })

  it('keeps a wrong answer (Failed) apart from a crash (Error)', () => {
    expect(classifyStudentRow(online, { checkStatus: check({ failed: true }) }).status).toBe(
      'failed'
    )
    expect(classifyStudentRow(online, { checkStatus: check({ errored: true }) }).status).toBe(
      'error'
    )
  })

  it('says Finished for a pass, then Away, then Offline', () => {
    expect(classifyStudentRow(online, { checkStatus: check({ passed: true }) }).status).toBe(
      'finished'
    )
    expect(
      classifyStudentRow({ ...online, windowFocused: false }, { checkStatus: check() }).status
    ).toBe('away')
    expect(classifyStudentRow({ anonymousId: 'a', online: false }, {}).status).toBe('offline')
    expect(classifyStudentRow(online, {}).status).toBe('online')
  })

  it('carries presence separately, so an offline finisher still reads offline', () => {
    const state = classifyStudentRow(
      { anonymousId: 'a', online: false },
      { checkStatus: check({ passed: true }) }
    )
    expect(state).toMatchObject({ status: 'finished', presence: 'offline' })
  })
})

describe('rowGroup and orderStudentRows', () => {
  const st = (id, name, extra = {}) => ({ anonymousId: id, displayName: name, ...extra })

  it('puts help first and offline last, by name within a group', () => {
    expect(rowGroup({ status: 'help', presence: 'online' })).toBe(0)
    expect(rowGroup({ status: 'help', presence: 'online' }, { acked: true })).toBe(1)
    expect(rowGroup({ status: 'failed', presence: 'online' })).toBe(1)
    expect(rowGroup({ status: 'finished', presence: 'offline' })).toBe(2)

    const students = [st('1', 'Zed'), st('2', 'amy'), st('3', 'Bea'), st('4', 'Cal')]
    const groups = { 1: 0, 2: 2, 3: 1, 4: 1 }
    const order = orderStudentRows(students, { groupOf: (s) => groups[s.anonymousId] })
    expect(order.ids).toEqual(['1', '3', '4', '2'])
  })

  it('re-sorts only when a state changes, and keeps the open row where it is', () => {
    const students = [st('1', 'Ann'), st('2', 'Ben'), st('3', 'Cat')]
    let groups = { 1: 1, 2: 1, 3: 1 }
    const groupOf = (s) => groups[s.anonymousId]
    const first = orderStudentRows(students, { groupOf })
    expect(first.ids).toEqual(['1', '2', '3'])
    // Same states, shuffled input: the same order object back.
    expect(orderStudentRows([...students].reverse(), { groupOf, prev: first })).toBe(first)
    // Cat asks for help: up she goes.
    groups = { ...groups, 3: 0 }
    const second = orderStudentRows(students, { groupOf, prev: first })
    expect(second.ids).toEqual(['3', '1', '2'])
    // Ben is open (pinned) and goes offline: he stays put until closed.
    groups = { ...groups, 2: 2 }
    const pinned = orderStudentRows(students, { groupOf, prev: second, pinnedId: '2' })
    expect(pinned.ids).toEqual(['3', '1', '2'])
    groups = { ...groups, 1: 2 }
    expect(orderStudentRows(students, { groupOf, prev: pinned, pinnedId: '2' }).ids).toEqual([
      '3',
      '2',
      '1',
    ])
    expect(orderStudentRows(students, { groupOf, prev: pinned }).ids).toEqual(['3', '1', '2'])
  })
})

describe('output text', () => {
  it('uses the last line of output, or the error when the run crashed', () => {
    expect(rowOutputText({ currentOutput: 'a\nhello\n\n', lastRunStatus: 'success' })).toBe('hello')
    expect(
      rowOutputText({
        lastRunStatus: 'error',
        lastRunError: 'Traceback\n  line 3\nNameError: name x is not defined',
      })
    ).toBe('NameError: name x is not defined')
    expect(rowOutputText({})).toBe('')
  })

  it('shows nothing on an information task', () => {
    expect(rowOutputText({ currentOutput: 'hello' }, { isInformation: true })).toBe('')
  })

  it('cuts the stub to about 12 characters', () => {
    expect(outputStub('hello')).toBe('hello')
    expect(outputStub('NameError: name x is not defined')).toBe('NameError: n…')
  })

  it('says how long ago in short words', () => {
    expect(ageWords(1000, 30_000)).toBe('now')
    expect(ageWords(0 + 1, 4 * 60_000 + 1)).toBe('4m')
    expect(ageWords(1, 2 * 3_600_000 + 1)).toBe('2h')
    expect(ageWords(null, 1)).toBe('')
  })
})

describe('sameOutputSummary', () => {
  const out = (id, text, extra = {}) => ({
    anonymousId: id,
    online: true,
    currentOutput: text,
    lastRunStatus: 'success',
    ...extra,
  })

  it('names an output that several students share', () => {
    const students = [out('1', 'hello'), out('2', 'hello'), out('3', 'hello'), out('4', 'hi')]
    expect(sameOutputSummary(students)).toEqual({
      text: 'hello',
      count: 3,
      studentIds: ['1', '2', '3'],
    })
  })

  it('is null when fewer than three share one', () => {
    expect(sameOutputSummary([out('1', 'hello'), out('2', 'hello')])).toBeNull()
  })

  // Review fix: an offline student's output is not what the class sees now, and an information
  // task has no run to compare.
  it('leaves out offline students and information tasks', () => {
    const students = [
      out('1', 'hello'),
      out('2', 'hello'),
      out('3', 'hello', { online: false }),
      out('4', 'hello'),
    ]
    expect(sameOutputSummary(students)?.studentIds).toEqual(['1', '2', '4'])
    expect(sameOutputSummary(students.slice(0, 3))).toBeNull()
    expect(sameOutputSummary(students, { isInformation: true })).toBeNull()
  })
})

describe('rowGroup', () => {
  // Review fix: an offline student who asked for help still gets the amber help row on top.
  it('lets help beat offline, and an acked help row sits among the rest', () => {
    expect(rowGroup({ status: 'help', presence: 'offline' })).toBe(0)
    expect(rowGroup({ status: 'help', presence: 'offline' }, { acked: true })).toBe(2)
    expect(rowGroup({ status: 'help', presence: 'online' }, { acked: true })).toBe(1)
    expect(rowGroup({ status: 'finished', presence: 'offline' })).toBe(2)
  })
})

describe('summariseRowStates', () => {
  it('counts each state for the header line', () => {
    const states = [
      { status: 'finished', presence: 'online' },
      { status: 'finished', presence: 'offline' },
      { status: 'stuck', presence: 'online' },
      { status: 'failed', presence: 'away' },
      { status: 'error', presence: 'online' },
      { status: 'help', presence: 'online' },
    ]
    expect(summariseRowStates(states)).toEqual({
      help: 1,
      finished: 2,
      stuck: 1,
      failed: 1,
      error: 1,
      away: 1,
      offline: 1,
    })
  })
})
