import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { contexts, createTestEnvironment } from './setup.js'

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

const doc = (ctx, path) => ctx.firestore().doc(path)

describe('public content collections', () => {
  it.each(['lessons', 'topicLibrary', 'lessonLevels', 'classes', 'lessonTypeAssets'])(
    '%s: anyone reads, only admins write',
    async (collection) => {
      await assertSucceeds(doc(as.anonymous, `${collection}/item-1`).get())
      await assertFails(doc(as.student, `${collection}/item-1`).set({ title: 'x' }))
      await assertFails(doc(as.teacher, `${collection}/item-1`).set({ title: 'x' }))
      await assertSucceeds(doc(as.admin, `${collection}/item-1`).set({ title: 'x' }))
    }
  )
})

describe('users', () => {
  it('lets a teacher read only their own user document', async () => {
    await assertSucceeds(doc(as.teacher, 'users/teacher-1').get())
    await assertFails(doc(as.teacher, 'users/someone-else').get())
    await assertSucceeds(doc(as.admin, 'users/someone-else').get())
  })

  it('blocks all client writes, even from admins (Cloud Functions only)', async () => {
    await assertFails(doc(as.teacher, 'users/teacher-1').set({ role: 'admin' }))
    await assertFails(doc(as.admin, 'users/teacher-1').set({ role: 'admin' }))
  })
})

describe('lesson feedback and session reports', () => {
  it.each(['feedback', 'sessionReports'])('%s: teachers and admins only', async (sub) => {
    const path = `lessons/lesson-1/${sub}/item-1`
    await assertFails(doc(as.anonymous, path).get())
    await assertFails(doc(as.student, path).get())
    await assertFails(doc(as.student, path).set({ text: 'x' }))
    await assertSucceeds(doc(as.teacher, path).set({ text: 'x' }))
    await assertSucceeds(doc(as.teacher, path).get())
  })

  it('allows collection-group reads of feedback for teachers only', async () => {
    await assertSucceeds(as.teacher.firestore().collectionGroup('feedback').get())
    await assertFails(as.student.firestore().collectionGroup('feedback').get())
  })
})

describe('platform feedback', () => {
  it('lets teachers submit but only admins read', async () => {
    await assertSucceeds(doc(as.teacher, 'platformFeedback/f1').set({ text: 'idea' }))
    await assertFails(doc(as.teacher, 'platformFeedback/f1').get())
    await assertFails(doc(as.student, 'platformFeedback/f2').set({ text: 'spam' }))
    await assertSucceeds(doc(as.admin, 'platformFeedback/f1').get())
  })
})

describe('everything else', () => {
  it('denies reads and writes to collections without a rule', async () => {
    await assertFails(doc(as.admin, 'unlisted/doc-1').get())
    await assertFails(doc(as.admin, 'unlisted/doc-1').set({ a: 1 }))
  })
})
