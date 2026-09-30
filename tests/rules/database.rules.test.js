import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { contexts, createTestEnvironment, OTHER_STUDENT_ID, STUDENT_ID } from './setup.js'

const LESSON = 'lesson-1'
let testEnv
let as

beforeAll(async () => {
  testEnv = await createTestEnvironment()
  as = contexts(testEnv)
})

afterAll(async () => {
  await testEnv?.cleanup()
})

beforeEach(async () => {
  await testEnv.clearDatabase()
})

const ref = (ctx, path) => ctx.database().ref(path)

describe('sessions', () => {
  it('lets anyone read a single lesson session, including signed-out visitors', async () => {
    await testEnv.withSecurityRulesDisabled((ctx) =>
      ref(ctx, `sessions/${LESSON}`).set({ state: 'active' })
    )
    await assertSucceeds(ref(as.anonymous, `sessions/${LESSON}`).get())
  })

  it('only lets admins list every session', async () => {
    await assertFails(ref(as.teacher, 'sessions').get())
    await assertFails(ref(as.student, 'sessions').get())
    await assertSucceeds(ref(as.admin, 'sessions').get())
  })

  it('lets teachers and admins write session-level fields, but not students', async () => {
    await assertSucceeds(ref(as.teacher, `sessions/${LESSON}/state`).set('active'))
    await assertSucceeds(ref(as.admin, `sessions/${LESSON}/currentTaskId`).set(2))
    await assertFails(ref(as.student, `sessions/${LESSON}/state`).set('ended'))
    await assertFails(ref(as.anonymous, `sessions/${LESSON}/state`).set('ended'))
  })

  it('lets any signed-in user register a joining presence marker', async () => {
    await assertSucceeds(ref(as.student, `sessions/${LESSON}/joiningStudents/temp-1`).set(true))
    await assertFails(ref(as.anonymous, `sessions/${LESSON}/joiningStudents/temp-1`).set(true))
  })
})

describe('student nodes', () => {
  it('lets a student write only their own node', async () => {
    const own = `sessions/${LESSON}/students/${STUDENT_ID}/currentCode`
    const other = `sessions/${LESSON}/students/${OTHER_STUDENT_ID}/currentCode`
    await assertSucceeds(ref(as.student, own).set('print(1)'))
    await assertFails(ref(as.student, other).set('x'))
    await assertFails(ref(as.anonymous, own).set('x'))
  })

  it('lets teachers write any student node (rename, reset, check override)', async () => {
    await assertSucceeds(
      ref(as.teacher, `sessions/${LESSON}/students/${STUDENT_ID}/displayName`).set('Sam')
    )
  })

  it.each([
    `attemptLog/${STUDENT_ID}/entry-1`,
    `carryFallbackLog/${STUDENT_ID}/3`,
    `supportRevealLog/${STUDENT_ID}/3/0`,
  ])('keeps %s writable by its student but not another student', async (path) => {
    await assertSucceeds(ref(as.student, `sessions/${LESSON}/${path}`).set({ at: 1 }))
    await assertFails(ref(as.otherStudent, `sessions/${LESSON}/${path}`).set({ at: 1 }))
  })

  it('never lets a student write their own override record', async () => {
    const path = `sessions/${LESSON}/overrideLog/${STUDENT_ID}/3`
    await assertFails(ref(as.student, path).set({ passed: true }))
    await assertSucceeds(ref(as.teacher, path).set({ passed: true }))
  })
})

describe('shared workspaces', () => {
  it('only lets teachers approve shares, and requires sharerId and sharedAt', async () => {
    const path = `sessions/${LESSON}/sharedWorkspaces/share-1`
    await assertFails(ref(as.student, path).set({ sharerId: STUDENT_ID, sharedAt: 1 }))
    await assertFails(ref(as.teacher, path).set({ sharerId: STUDENT_ID }))
    await assertSucceeds(ref(as.teacher, path).set({ sharerId: STUDENT_ID, sharedAt: 1 }))
  })

  it('keeps a pending snapshot private to its author and the teacher', async () => {
    const path = `sharedWorkspacePayloads/${LESSON}/pending/${STUDENT_ID}`
    await assertSucceeds(ref(as.student, path).set({ code: 'print(1)' }))
    await assertSucceeds(ref(as.student, path).get())
    await assertSucceeds(ref(as.teacher, path).get())
    await assertFails(ref(as.otherStudent, path).get())
    await assertFails(ref(as.otherStudent, path).set({ code: 'hijack' }))
  })

  it('lets the class read approved payloads but only teachers write them', async () => {
    const path = `sharedWorkspacePayloads/${LESSON}/approved/share-1`
    await assertFails(ref(as.student, path).set({ code: 'x' }))
    await assertSucceeds(ref(as.teacher, path).set({ code: 'print(1)' }))
    await assertSucceeds(ref(as.anonymous, path).get())
  })
})

describe('live badges', () => {
  const decision = { status: 'awarded', source: 'manual', decidedAt: 1, announce: true }

  it('only lets teachers and admins write badge decisions', async () => {
    const path = `sessions/${LESSON}/badges/${STUDENT_ID}/bug_hunter`
    await assertFails(ref(as.student, path).set(decision))
    await assertFails(ref(as.otherStudent, path).set(decision))
    await assertSucceeds(ref(as.teacher, path).set(decision))
    await assertSucceeds(ref(as.admin, path).set({ ...decision, status: 'revoked' }))
  })

  it('requires a known status and source on a decision', async () => {
    const path = `sessions/${LESSON}/badges/${STUDENT_ID}/bug_hunter`
    await assertFails(ref(as.teacher, path).set({ ...decision, status: 'maybe' }))
    await assertFails(ref(as.teacher, path).set({ ...decision, source: 'student' }))
    await assertFails(ref(as.teacher, path).set({ status: 'awarded', source: 'manual' }))
  })

  it('accepts a catalogue badge snapshot only with an emoji and a short title', async () => {
    const path = `sessions/${LESSON}/badges/${STUDENT_ID}/star_helper`
    const badge = { emoji: '🌟', title: 'Star Helper', blurb: 'Helped out.' }
    await assertSucceeds(ref(as.teacher, path).set({ ...decision, badge }))
    await assertFails(ref(as.teacher, path).set({ ...decision, badge: { title: 'No emoji' } }))
    await assertFails(
      ref(as.teacher, path).set({ ...decision, badge: { ...badge, title: 'x'.repeat(41) } })
    )
    await assertFails(ref(as.student, path).set({ ...decision, badge }))
  })

  it('only lets teachers write badge settings', async () => {
    const path = `sessions/${LESSON}/badgeSettings`
    await assertFails(ref(as.student, path).set({ autoAward: true }))
    await assertSucceeds(ref(as.teacher, path).set({ autoAward: true, soundsOff: false }))
  })
})

describe('student signals', () => {
  const signals = (id) => `sessions/${LESSON}/studentSignals/${id}`

  it.each([
    ['shortcuts/run', { firstUsedAt: 1, context: 'task', taskId: 3 }],
    ['firstEdits/3', { elapsedMs: 4200 }],
    ['completeShown/3', { at: 1, via: 'show' }],
    ['topics/task/3/loops', { openedAt: 1, source: 'student' }],
  ])('lets a student write their own %s once, but not another student', async (sub, value) => {
    await assertFails(ref(as.otherStudent, `${signals(STUDENT_ID)}/${sub}`).set(value))
    await assertSucceeds(ref(as.student, `${signals(STUDENT_ID)}/${sub}`).set(value))
    await assertFails(ref(as.student, `${signals(STUDENT_ID)}/${sub}`).set(value))
  })

  it('lets a student record their own open of a topic the teacher sent', async () => {
    const path = `${signals(STUDENT_ID)}/topics/task/3/loops`
    await assertSucceeds(ref(as.student, path).set({ openedAt: 1, source: 'teacher' }))
    await assertSucceeds(ref(as.student, path).set({ openedAt: 2, source: 'student' }))
    await assertFails(ref(as.student, path).set({ openedAt: 3, source: 'teacher' }))
  })

  it('rejects unknown contexts, sources and complete-shown routes', async () => {
    await assertFails(
      ref(as.student, `${signals(STUDENT_ID)}/topics/elsewhere/3/loops`).set({
        openedAt: 1,
        source: 'student',
      })
    )
    await assertFails(
      ref(as.student, `${signals(STUDENT_ID)}/topics/task/3/loops`).set({
        openedAt: 1,
        source: 'robot',
      })
    )
    await assertFails(
      ref(as.student, `${signals(STUDENT_ID)}/completeShown/3`).set({ at: 1, via: 'magic' })
    )
    await assertFails(ref(as.student, `${signals(STUDENT_ID)}/firstEdits/3`).set({ elapsedMs: -1 }))
  })

  it('lets a student update their own sandbox counters on every run', async () => {
    const path = `${signals(STUDENT_ID)}/sandbox/personal`
    const counters = { timeMs: 0, runs: 1, errorRuns: 0, fixes: 0 }
    await assertSucceeds(ref(as.student, path).set(counters))
    await assertSucceeds(ref(as.student, path).set({ ...counters, runs: 2 }))
    await assertFails(ref(as.otherStudent, path).set(counters))
    await assertFails(ref(as.student, `${signals(STUDENT_ID)}/sandbox/other`).set(counters))
  })

  it('does not let a student write anywhere else under their signals', async () => {
    await assertFails(ref(as.student, `${signals(STUDENT_ID)}/code`).set('print(1)'))
    await assertFails(ref(as.student, signals(STUDENT_ID)).set({ shortcuts: {} }))
  })

  it('lets teachers write (and clear) signals', async () => {
    await assertSucceeds(
      ref(as.teacher, `${signals(STUDENT_ID)}/firstEdits/3`).set({ elapsedMs: 1 })
    )
    await assertSucceeds(ref(as.teacher, `sessions/${LESSON}/studentSignals`).set(null))
  })
})

describe('session archive', () => {
  const path = `sessionArchive/${LESSON}/visits/100`

  it('lets only teachers and admins read and write the sandbox archive', async () => {
    await assertFails(ref(as.student, path).set({ enteredAt: 100 }))
    await assertSucceeds(ref(as.teacher, path).set({ enteredAt: 100 }))
    await assertSucceeds(ref(as.teacher, path).get())
    await assertSucceeds(ref(as.admin, `sessionArchive/${LESSON}`).get())
    await assertFails(ref(as.student, path).get())
    await assertFails(ref(as.anonymous, path).get())
    await assertFails(
      ref(as.student, `${path}/studentSnapshots/${STUDENT_ID}`).set({ at: 1, code: 'x' })
    )
  })
})
