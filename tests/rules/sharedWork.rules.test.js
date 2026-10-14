import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import firebase from 'firebase/compat/app'
import 'firebase/compat/firestore'
import { contexts, createTestEnvironment } from './setup.js'

// Share links from "Export work" (firestore.rules `sharedWork/{shareId}`).

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
  await testEnv.clearFirestore()
})

const DAY_MS = 24 * 60 * 60 * 1000
const { Timestamp, FieldValue } = firebase.firestore
const doc = (ctx, path) => ctx.firestore().doc(path)

function newShare(uid, overrides = {}) {
  return {
    createdAt: FieldValue.serverTimestamp(),
    createdBy: uid,
    expiresAt: Timestamp.fromMillis(Date.now() + 30 * DAY_MS),
    revoked: false,
    kind: 'python',
    title: 'Looping over a list',
    payload: JSON.stringify({ code: 'print(1)' }),
    ...overrides,
  }
}

async function seed(id, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx
      .firestore()
      .doc(`sharedWork/${id}`)
      .set({
        createdAt: Timestamp.fromMillis(Date.now() - DAY_MS),
        createdBy: 'teacher-1',
        expiresAt: Timestamp.fromMillis(Date.now() + 29 * DAY_MS),
        revoked: false,
        kind: 'python',
        title: 'Work',
        payload: '{}',
        ...data,
      })
  })
}

describe('sharedWork: reading', () => {
  it('lets anyone get a live link', async () => {
    await seed('live', {})
    await assertSucceeds(doc(as.anonymous, 'sharedWork/live').get())
    await assertSucceeds(doc(as.student, 'sharedWork/live').get())
  })

  it('hides an expired or revoked link from the public', async () => {
    await seed('expired', { expiresAt: Timestamp.fromMillis(Date.now() - 1000) })
    await seed('revoked', { revoked: true })
    await assertFails(doc(as.anonymous, 'sharedWork/expired').get())
    await assertFails(doc(as.anonymous, 'sharedWork/revoked').get())
    await assertFails(doc(as.student, 'sharedWork/revoked').get())
  })

  it('still lets the maker and admins read an ended link', async () => {
    await seed('revoked', { revoked: true })
    await assertSucceeds(doc(as.teacher, 'sharedWork/revoked').get())
    await assertSucceeds(doc(as.admin, 'sharedWork/revoked').get())
  })

  it('lets only admins list links', async () => {
    await seed('live', {})
    await assertFails(as.anonymous.firestore().collection('sharedWork').get())
    await assertFails(as.teacher.firestore().collection('sharedWork').get())
    await assertSucceeds(as.admin.firestore().collection('sharedWork').get())
  })
})

describe('sharedWork: creating', () => {
  it('lets teachers and admins create a link as themselves', async () => {
    await assertSucceeds(doc(as.teacher, 'sharedWork/a').set(newShare('teacher-1')))
    await assertSucceeds(doc(as.admin, 'sharedWork/b').set(newShare('admin-1')))
  })

  it('refuses students and signed-out visitors', async () => {
    await assertFails(doc(as.student, 'sharedWork/a').set(newShare('student-1')))
    await assertFails(doc(as.anonymous, 'sharedWork/a').set(newShare('nobody')))
  })

  it('refuses a link made in someone else’s name, already revoked, or with extra fields', async () => {
    await assertFails(doc(as.teacher, 'sharedWork/a').set(newShare('admin-1')))
    await assertFails(doc(as.teacher, 'sharedWork/b').set(newShare('teacher-1', { revoked: true })))
    await assertFails(
      doc(as.teacher, 'sharedWork/c').set(newShare('teacher-1', { studentName: 'Jamie' }))
    )
  })

  it('refuses an expiry more than 30 days on, or in the past', async () => {
    await assertFails(
      doc(as.teacher, 'sharedWork/a').set(
        newShare('teacher-1', { expiresAt: Timestamp.fromMillis(Date.now() + 31 * DAY_MS) })
      )
    )
    await assertFails(
      doc(as.teacher, 'sharedWork/b').set(
        newShare('teacher-1', { expiresAt: Timestamp.fromMillis(Date.now() - 1000) })
      )
    )
  })

  it('refuses a client-made createdAt and a payload that is not a string', async () => {
    await assertFails(
      doc(as.teacher, 'sharedWork/a').set(
        newShare('teacher-1', { createdAt: Timestamp.fromMillis(Date.now()) })
      )
    )
    await assertFails(
      doc(as.teacher, 'sharedWork/b').set(newShare('teacher-1', { payload: { code: 'x' } }))
    )
  })
})

describe('sharedWork: revoking', () => {
  it('lets a teacher or admin revoke, and nothing else change', async () => {
    await seed('a', {})
    await seed('b', {})
    await assertSucceeds(
      doc(as.teacher, 'sharedWork/a').update({
        revoked: true,
        revokedAt: FieldValue.serverTimestamp(),
      })
    )
    await assertSucceeds(
      doc(as.admin, 'sharedWork/b').update({
        revoked: true,
        revokedAt: FieldValue.serverTimestamp(),
      })
    )
    await seed('c', {})
    await assertFails(doc(as.teacher, 'sharedWork/c').update({ title: 'Renamed' }))
    await assertFails(
      doc(as.teacher, 'sharedWork/c').update({
        expiresAt: Timestamp.fromMillis(Date.now() + 90 * DAY_MS),
      })
    )
  })

  it('refuses students and visitors', async () => {
    await seed('a', {})
    await assertFails(
      doc(as.student, 'sharedWork/a').update({
        revoked: true,
        revokedAt: FieldValue.serverTimestamp(),
      })
    )
    await assertFails(doc(as.anonymous, 'sharedWork/a').delete())
  })
})
