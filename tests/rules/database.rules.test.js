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
