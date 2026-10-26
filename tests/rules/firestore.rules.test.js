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

describe('tutor timing runs', () => {
  const path = 'lessons/lesson-1/timingRuns/run-1'

  it('lets teachers and admins create and read a run', async () => {
    await assertSucceeds(doc(as.teacher, path).set({ totalSeconds: 60 }))
    await assertSucceeds(doc(as.teacher, path).get())
    await assertSucceeds(
      doc(as.admin, 'lessons/lesson-1/timingRuns/run-2').set({ totalSeconds: 5 })
    )
  })

  it('blocks students and signed-out users', async () => {
    await assertFails(doc(as.anonymous, path).get())
    await assertFails(doc(as.student, path).get())
    await assertFails(doc(as.student, 'lessons/lesson-1/timingRuns/run-3').set({ totalSeconds: 1 }))
  })

  it('does not let anyone edit or delete a saved run', async () => {
    await doc(as.admin, 'lessons/lesson-1/timingRuns/run-4').set({ totalSeconds: 1 })
    await assertFails(
      doc(as.admin, 'lessons/lesson-1/timingRuns/run-4').update({ totalSeconds: 2 })
    )
    await assertFails(doc(as.admin, 'lessons/lesson-1/timingRuns/run-4').delete())
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

describe('badge catalogue', () => {
  const badge = { emoji: '🌟', title: 'Star Helper', blurb: 'Helped out.', archived: false }

  it('lets teachers and admins read, and nobody else', async () => {
    await assertFails(doc(as.anonymous, 'badgeCatalogue/star_helper').get())
    await assertFails(doc(as.student, 'badgeCatalogue/star_helper').get())
    await assertSucceeds(doc(as.teacher, 'badgeCatalogue/star_helper').get())
    await assertSucceeds(doc(as.admin, 'badgeCatalogue/star_helper').get())
    await assertSucceeds(as.teacher.firestore().collection('badgeCatalogue').get())
  })

  it('lets only admins write', async () => {
    await assertFails(doc(as.student, 'badgeCatalogue/star_helper').set(badge))
    await assertFails(doc(as.teacher, 'badgeCatalogue/star_helper').set(badge))
    await assertSucceeds(doc(as.admin, 'badgeCatalogue/star_helper').set(badge))
    await assertSucceeds(
      doc(as.admin, 'badgeCatalogue/star_helper').set({ archived: true }, { merge: true })
    )
  })
})

describe('class roster', () => {
  const entry = { displayName: 'Jamie B.', createdAt: 1, createdBy: 'teacher-1' }
  const entryPath = 'classes/maple/roster/r1'

  it('is not public: only teachers and admins read or write roster entries', async () => {
    await assertFails(doc(as.anonymous, entryPath).get())
    await assertFails(doc(as.student, entryPath).get())
    await assertFails(doc(as.student, entryPath).set(entry))
    await assertSucceeds(doc(as.teacher, entryPath).set(entry))
    await assertSucceeds(doc(as.teacher, entryPath).get())
    await assertSucceeds(doc(as.admin, entryPath).update({ displayName: 'Jamie Br.' }))
    await assertSucceeds(as.teacher.firestore().collection('classes/maple/roster').get())
    await assertFails(as.student.firestore().collection('classes/maple/roster').get())
    await assertFails(doc(as.student, entryPath).delete())
    await assertSucceeds(doc(as.admin, entryPath).delete())
  })

  it('keeps entries to a 1-30 character name and the known fields', async () => {
    await assertFails(doc(as.teacher, entryPath).set({ ...entry, displayName: '' }))
    await assertFails(doc(as.teacher, entryPath).set({ ...entry, displayName: 'x'.repeat(31) }))
    await assertFails(doc(as.teacher, entryPath).set({ ...entry, displayName: 42 }))
    await assertFails(doc(as.teacher, entryPath).set({ ...entry, surname: 'Brown' }))
    await assertSucceeds(doc(as.teacher, entryPath).set({ ...entry, displayName: 'x'.repeat(30) }))
  })

  it.each([
    `${entryPath}/work/python-l1__1`,
    `${entryPath}/work/python-l1__1/chunks/0`,
    `${entryPath}/typing/t1`,
  ])('%s: teachers and admins only', async (path) => {
    await assertFails(doc(as.anonymous, path).get())
    await assertFails(doc(as.student, path).get())
    await assertFails(doc(as.student, path).set({ kind: 'code', code: 'print(1)' }))
    await assertSucceeds(doc(as.teacher, path).set({ kind: 'code', code: 'print(1)' }))
    await assertSucceeds(doc(as.admin, path).get())
    await assertSucceeds(doc(as.teacher, path).delete())
  })

  it('leaves the parent class record public-read and admin-write', async () => {
    await assertSucceeds(doc(as.anonymous, 'classes/maple').get())
    await assertFails(doc(as.teacher, 'classes/maple').set({ name: 'Maple' }))
  })
})

describe('everything else', () => {
  it('denies reads and writes to collections without a rule', async () => {
    await assertFails(doc(as.admin, 'unlisted/doc-1').get())
    await assertFails(doc(as.admin, 'unlisted/doc-1').set({ a: 1 }))
  })
})
