import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { contexts, createTestEnvironment, STUDENT_ID } from './setup.js'

// Per-tutor live sessions (#337): a class's records are keyed by the session key. Links with no
// tutor use the plain lesson id (tutors without a handle claim, or the handle named in
// config/legacyHandle); a tutor's own class is `lessonId~handle` and only that tutor (or an
// admin) can write it.
const LESSON = 'lesson-1'
const KEY_SAM = `${LESSON}~sam`
const KEY_RYAN = `${LESSON}~ryan`

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
const tutor = (handle) =>
  testEnv.authenticatedContext(`teacher-${handle ?? 'none'}`, {
    role: 'teacher',
    ...(handle ? { handle } : {}),
  })

// Every node a tutor owns for a class, as [path, value] writes.
const OWNED_NODES = (key) => [
  [`sessions/${key}/state`, 'active'],
  [`sessions/${key}/currentTaskId`, 2],
  [`liveInk/${key}/pointer`, { surface: 'info:1', anchor: 'b0', rx: 0.5, ry: 0.5, t: 1 }],
  [`liveInk/${key}/tutorPointer`, { pane: 'page', rx: 0.5, ry: 0.5, t: 1 }],
  [`carryInbox/${key}/student-1`, { kind: 'code', payload: 'x = 1' }],
  [`sessionArchive/${key}/visits`, true],
  [`sharedWorkspacePayloads/${key}/approved`, true],
  [`peerHelp/${key}/anything`, true],
]

describe('a tutor with a handle owns only their own session key', () => {
  it('lets sam write every node of lesson-1~sam', async () => {
    for (const [path, value] of OWNED_NODES(KEY_SAM)) {
      await assertSucceeds(ref(tutor('sam'), path).set(value))
    }
  })

  it('stops sam writing, wiping or restarting ryan’s session, or the plain lesson key', async () => {
    for (const key of [KEY_RYAN, LESSON]) {
      for (const [path, value] of OWNED_NODES(key)) {
        await assertFails(ref(tutor('sam'), path).set(value))
      }
      await assertFails(ref(tutor('sam'), `sessions/${key}`).remove())
      await assertFails(ref(tutor('sam'), `sessions/${key}`).set({ state: 'waiting' }))
    }
  })

  it('lets an admin write any tutor’s session', async () => {
    for (const key of [KEY_SAM, KEY_RYAN, LESSON]) {
      await assertSucceeds(ref(as.admin, `sessions/${key}/state`).set('active'))
    }
  })

  it('does not let a student write a tutor’s session-level fields', async () => {
    await assertFails(ref(as.student, `sessions/${KEY_SAM}/state`).set('ended'))
  })

  it('still lets a student write their own nodes under a tutor’s key', async () => {
    await assertSucceeds(
      ref(as.student, `sessions/${KEY_SAM}/students/${STUDENT_ID}`).set({ displayName: 'Kid' })
    )
    await assertFails(
      ref(as.student, `sessions/${KEY_SAM}/students/someone-else`).set({ displayName: 'x' })
    )
  })
})

describe('links with no tutor keep working for a tutor without a handle', () => {
  it('lets a teacher with no handle write the plain lesson key, but not a tutor’s key', async () => {
    for (const [path, value] of OWNED_NODES(LESSON)) {
      await assertSucceeds(ref(tutor(null), path).set(value))
    }
    for (const [path, value] of OWNED_NODES(KEY_SAM)) {
      await assertFails(ref(tutor(null), path).set(value))
    }
  })

  it('keeps the plain lesson key writable by the legacy handle named in config', async () => {
    await testEnv.withSecurityRulesDisabled((ctx) => ref(ctx, 'config/legacyHandle').set('ryan'))
    for (const [path, value] of OWNED_NODES(LESSON)) {
      await assertSucceeds(ref(tutor('ryan'), path).set(value))
      await assertFails(ref(tutor('sam'), path).set(value))
    }
    for (const [path, value] of OWNED_NODES(KEY_RYAN)) {
      await assertSucceeds(ref(tutor('ryan'), path).set(value))
    }
  })

  it('shuts a handled tutor out of the plain lesson key when no legacy handle is set', async () => {
    await assertFails(ref(tutor('sam'), `sessions/${LESSON}/state`).set('active'))
  })
})

describe('config', () => {
  it('only lets an admin read or write config', async () => {
    await assertSucceeds(ref(as.admin, 'config/legacyHandle').set('ryan'))
    await assertFails(ref(as.teacher, 'config/legacyHandle').set('sam'))
    await assertFails(ref(as.student, 'config/legacyHandle').set('sam'))
    await assertFails(ref(as.teacher, 'config/legacyHandle').get())
  })
})

describe('tutor-only reads follow the same ownership', () => {
  it('lets only the owner (or an admin) read peer help and the archive for a tutor key', async () => {
    await testEnv.withSecurityRulesDisabled(async (ctx) => {
      await ref(ctx, `peerHelp/${KEY_SAM}/x`).set(true)
      await ref(ctx, `sessionArchive/${KEY_SAM}/visits`).set(true)
    })
    await assertSucceeds(ref(tutor('sam'), `peerHelp/${KEY_SAM}`).get())
    await assertSucceeds(ref(tutor('sam'), `sessionArchive/${KEY_SAM}`).get())
    await assertFails(ref(tutor('ryan'), `peerHelp/${KEY_SAM}`).get())
    await assertFails(ref(tutor('ryan'), `sessionArchive/${KEY_SAM}`).get())
    await assertSucceeds(ref(as.admin, `peerHelp/${KEY_SAM}`).get())
  })
})
