import { describe, expect, it } from 'vitest'
import { classActivities, studentActivities, summariseClassActivities } from '../studentActivity'

const students = {
  ali: { anonymousId: 'ali', displayName: 'Ali', online: true, watchingLive: 'look' },
  bea: { anonymousId: 'bea', displayName: 'Bea', online: true, watchingLive: 'try' },
  sam: { anonymousId: 'sam', displayName: 'Sam', online: true },
  hal: { anonymousId: 'hal', displayName: 'Hal', online: true, currentTopicId: 't1' },
  jo: { anonymousId: 'jo', displayName: 'Jo', online: false, inPersonalSandbox: true },
}
const session = {
  currentTaskId: 2,
  students,
  teacherLive: {
    active: true,
    source: 'student',
    mode: 'panel',
    sourceStudentId: 'sam',
    sourceStudentName: 'Sam',
  },
  peerHelpOffers: { r1: { taskId: 2, offeredAt: 1, claimedAt: 2 } },
}
const peerHelp = {
  allRequests: { sam: { requestId: 'r1' } },
  allPeerHelp: { r1: { stuckId: 'sam', helperId: 'hal' } },
}

describe('studentActivities', () => {
  it('puts peer help first, then the broadcast, shared work, topic and sandbox', () => {
    const all = classActivities({ session, peerHelp, topics: [{ id: 't1', title: 'Loops' }] })
    expect(all.hal.map((a) => a.text)).toEqual(['helping Sam', 'reading “Loops”'])
    expect(all.sam.map((a) => a.text)).toEqual(['helped by Hal'])
    expect(all.ali[0].text).toBe('looking at Sam’s work')
    expect(all.bea[0].text).toBe('trying Sam’s work')
    expect(all.jo).toEqual([]) // offline: doing nothing
  })

  it('ignores a stale watchingLive once the broadcast is not a "Show to class" one', () => {
    const takeover = { ...session, teacherLive: { ...session.teacherLive, mode: undefined } }
    expect(studentActivities({ student: students.ali, session: takeover })).toEqual([])
    expect(
      studentActivities({ student: students.ali, session: { ...session, teacherLive: null } })
    ).toEqual([])
  })

  it('says when a student is waiting for a classmate', () => {
    const waiting = studentActivities({
      student: students.sam,
      session,
      peerPairs: { sam: { role: 'offered', partnerId: null } },
    })
    expect(waiting[0].text).toBe('waiting for a helper')
  })
})

describe('summariseClassActivities', () => {
  it('groups the class, pairs helpers with who they help, most important first', () => {
    const activities = classActivities({ session, peerHelp, topics: null })
    const summary = summariseClassActivities({ session, activities })
    expect(summary.map((e) => `${e.icon} ${e.text}`)).toEqual([
      '🤝 Hal → Sam',
      '👀 1 looking at Sam’s work',
      '▶ 1 trying Sam’s work',
      '📖 1 reading a topic',
    ])
    expect(summary[0].studentIds.sort()).toEqual(['hal', 'sam'])
  })
})
