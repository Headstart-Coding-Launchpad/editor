import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import firebase from 'firebase/compat/app'
import 'firebase/compat/firestore'
import { contexts, createTestEnvironment } from './setup.js'

// Preview review notes (firestore.rules `lessons/{lessonId}/reviewNotes/{noteId}`, request #127).

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

const { FieldValue } = firebase.firestore
const PATH = 'lessons/L/reviewNotes'
const doc = (ctx, path) => ctx.firestore().doc(path)
const otherAdmin = () => testEnv.authenticatedContext('admin-2', { role: 'admin' })

function newNote(uid, overrides = {}) {
  return {
    lessonId: 'L',
    taskId: 3,
    lessonVersion: 7,
    text: 'Hint gives the answer away',
    tag: 'wrong',
    createdAt: FieldValue.serverTimestamp(),
    status: 'new',
    statusChangedAt: FieldValue.serverTimestamp(),
    createdBy: uid,
    ...overrides,
  }
}

// A note already moved on by the CLI (Admin SDK), written with the rules off.
async function seed(id, data) {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await ctx
      .firestore()
      .doc(`${PATH}/${id}`)
      .set({
        ...newNote('admin-1'),
        createdAt: new Date(),
        statusChangedAt: new Date(),
        ...data,
      })
  })
}

describe('review notes rules', () => {
  it('an admin creates a New note, edits its text and tag, then deletes it', async () => {
    await assertSucceeds(doc(as.admin, `${PATH}/n1`).set(newNote('admin-1')))
    await assertSucceeds(doc(as.admin, `${PATH}/n1`).update({ text: 'Swap 2 and 3', tag: null }))
    await assertSucceeds(doc(as.admin, `${PATH}/n1`).get())
    await assertSucceeds(as.admin.firestore().collection(PATH).get())
    // The preview box's query: one task's notes.
    await assertSucceeds(
      as.admin.firestore().collection(PATH).where('taskId', 'in', [3, '3']).limit(200).get()
    )
    await assertSucceeds(doc(as.admin, `${PATH}/n1`).delete())
  })

  it('any admin may write and read notes (no owner pin)', async () => {
    await assertSucceeds(doc(otherAdmin(), `${PATH}/n2`).set(newNote('admin-2')))
    await assertSucceeds(as.admin.firestore().collection(PATH).get())
  })

  it('refuses a bad create', async () => {
    const bad = [
      newNote('admin-1', { status: 'picked_up' }),
      newNote('admin-1', { extra: true }),
      newNote('admin-1', { text: '' }),
      newNote('admin-1', { text: 'x'.repeat(501) }),
      newNote('admin-1', { tag: 'meh' }),
      newNote('admin-2'),
      newNote('admin-1', { lessonId: 'other' }),
      newNote('admin-1', { createdAt: new Date(0) }),
      newNote('admin-1', { taskId: '' }),
      newNote('admin-1', { taskId: 'x'.repeat(101) }),
      newNote('admin-1', { taskId: -1 }),
      newNote('admin-1', { taskId: null }),
      newNote('admin-1', { lessonVersion: -1 }),
      newNote('admin-1', { lessonVersion: 1.5 }),
      newNote('admin-1', { lessonVersion: '7' }),
    ]
    for (const [i, data] of bad.entries()) {
      await assertFails(doc(as.admin, `${PATH}/bad-${i}`).set(data))
    }
    const { tag: _tag, ...noTag } = newNote('admin-1')
    await assertFails(doc(as.admin, `${PATH}/bad-notag`).set(noTag))
    expect(bad.length).toBe(15)
  })

  it('takes a text task id up to 100 characters and lesson version 0', async () => {
    await assertSucceeds(
      doc(as.admin, `${PATH}/s1`).set(newNote('admin-1', { taskId: 'x'.repeat(100) }))
    )
    await assertSucceeds(
      doc(as.admin, `${PATH}/s2`).set(newNote('admin-1', { taskId: 'task-3', lessonVersion: 0 }))
    )
  })

  it('a client never moves the status on, and cannot edit a note once it is picked up', async () => {
    await assertSucceeds(doc(as.admin, `${PATH}/n1`).set(newNote('admin-1')))
    await assertFails(doc(as.admin, `${PATH}/n1`).update({ status: 'picked_up' }))
    await seed('p1', { status: 'picked_up' })
    await assertFails(doc(as.admin, `${PATH}/p1`).update({ text: 'Changed' }))
    await assertSucceeds(doc(as.admin, `${PATH}/p1`).get())
  })

  it('only the writer edits a New note', async () => {
    await seed('n1', { createdBy: 'admin-1' })
    await assertFails(doc(otherAdmin(), `${PATH}/n1`).update({ text: 'Not mine' }))
  })

  it('an admin can delete any note, so deleting a lesson clears them', async () => {
    await seed('d1', { status: 'done' })
    await assertSucceeds(doc(otherAdmin(), `${PATH}/d1`).delete())
  })

  it('refuses tutors, students and visitors every read and write', async () => {
    await seed('n1', {})
    for (const ctx of [as.teacher, as.student, as.anonymous]) {
      await assertFails(doc(ctx, `${PATH}/n1`).get())
    }
    for (const ctx of [as.teacher, as.student, as.anonymous]) {
      await assertFails(ctx.firestore().collection(PATH).get())
    }
    await assertFails(doc(as.teacher, `${PATH}/t1`).set(newNote('teacher-1')))
    await assertFails(doc(as.student, `${PATH}/s1`).set(newNote('student-1')))
    await assertFails(doc(as.anonymous, `${PATH}/a1`).set(newNote(null)))
    await assertFails(doc(as.teacher, `${PATH}/n1`).update({ text: 'x' }))
    await assertFails(doc(as.teacher, `${PATH}/n1`).delete())
    await assertFails(doc(as.student, `${PATH}/n1`).delete())
  })
})
