import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { contexts, createTestEnvironment, OTHER_STUDENT_ID, STUDENT_ID } from './setup.js'

// Peer help (src/shared/peerHelp.js): the rules are the safeguard, not the UI. STUDENT_ID is
// stuck, OTHER_STUDENT_ID helps, BYSTANDER is anyone else in the class.
const LESSON = 'lesson-1'
const R = 'req-1'
const STUCK = STUDENT_ID
const HELPER = OTHER_STUDENT_ID
const BYSTANDER = 'student-3'

let testEnv
let as

beforeAll(async () => {
  testEnv = await createTestEnvironment()
  as = contexts(testEnv)
})

afterAll(async () => {
  await testEnv?.cleanup()
})

const ref = (ctx, path) => ctx.database().ref(path)
const bystander = () => testEnv.authenticatedContext(BYSTANDER)
const seed = (data) => testEnv.withSecurityRulesDisabled((ctx) => ctx.database().ref().update(data))

const claimUpdate = (uid, at = 5) => ({
  [`peerHelp/${LESSON}/${R}/helperId`]: uid,
  [`sessions/${LESSON}/peerHelpOffers/${R}/claimedAt`]: at,
  [`peerHelpHelping/${LESSON}/${uid}`]: R,
})

// A request the teacher has offered on the current task, with a helper who passed and promised.
async function seedOffered(extra = {}) {
  await seed({
    [`sessions/${LESSON}/currentTaskId`]: 2,
    [`sessions/${LESSON}/students/${HELPER}/checkPassed`]: true,
    [`sessions/${LESSON}/students/${BYSTANDER}/checkPassed`]: false,
    [`sessions/${LESSON}/peerHelpOffers/${R}`]: { taskId: 2, lessonType: 'python', offeredAt: 1 },
    [`peerHelp/${LESSON}/${R}/stuckId`]: STUCK,
    [`peerHelp/${LESSON}/${R}/snapshot`]: { code: 'print(1)', taskId: 2 },
    [`peerHelpPromises/${LESSON}/${HELPER}`]: 1,
  })
  // Separately: an extra may sit under a path seeded above, which one update can't hold.
  if (Object.keys(extra).length) await seed(extra)
}

async function seedClaimed(extra = {}) {
  await seedOffered({
    [`peerHelp/${LESSON}/${R}/helperId`]: HELPER,
    [`sessions/${LESSON}/peerHelpOffers/${R}/claimedAt`]: 5,
    ...extra,
  })
}

beforeEach(async () => {
  await testEnv.clearDatabase()
})

describe('asking for peer help', () => {
  it('lets a student open their own request with a snapshot, once', async () => {
    await assertSucceeds(
      ref(as.student, '/').update({
        [`peerHelpRequests/${LESSON}/${STUCK}`]: { requestId: R, taskId: 2, at: 1 },
        [`peerHelp/${LESSON}/${R}/stuckId`]: STUCK,
        [`peerHelp/${LESSON}/${R}/snapshot`]: { code: 'x' },
      })
    )
    // Nobody can take the request over or pin it on someone else.
    await assertFails(ref(as.otherStudent, `peerHelp/${LESSON}/${R}/stuckId`).set(HELPER))
    await assertFails(ref(as.otherStudent, `peerHelp/${LESSON}/req-2/stuckId`).set(STUCK))
    await assertFails(ref(as.otherStudent, `peerHelp/${LESSON}/${R}/snapshot`).set({ code: 'y' }))
  })

  it('keeps the opt-in private to the student and the teacher', async () => {
    const path = `peerHelpRequests/${LESSON}/${STUCK}`
    await assertSucceeds(ref(as.student, path).set({ requestId: R, at: 1 }))
    await assertSucceeds(ref(as.teacher, path).get())
    await assertFails(ref(as.otherStudent, path).get())
    await assertFails(ref(as.otherStudent, `peerHelpRequests/${LESSON}`).get())
    await assertFails(ref(as.otherStudent, path).set({ requestId: 'x', at: 1 }))
  })

  it('only lets the teacher offer a request to the class', async () => {
    const offer = { taskId: 2, lessonType: 'python', offeredAt: 1 }
    await assertFails(ref(as.student, `sessions/${LESSON}/peerHelpOffers/${R}`).set(offer))
    await assertSucceeds(ref(as.teacher, `sessions/${LESSON}/peerHelpOffers/${R}`).set(offer))
    await assertFails(
      ref(as.teacher, `sessions/${LESSON}/peerHelpOffers/${R}`).set({ ...offer, stuck: 'Sam' })
    )
  })
})

describe('claiming an offer', () => {
  it('lets a promised student who passed the task claim it, atomically with the offer', async () => {
    await seedOffered()
    await assertSucceeds(ref(as.otherStudent, '/').update(claimUpdate(HELPER)))
    // Then nobody else can.
    await seed({ [`sessions/${LESSON}/students/${BYSTANDER}/checkPassed`]: true })
    await seed({ [`peerHelpPromises/${LESSON}/${BYSTANDER}`]: 1 })
    await assertFails(ref(bystander(), '/').update(claimUpdate(BYSTANDER)))
  })

  it('refuses a student who has not passed, or was failed by the teacher', async () => {
    await seedOffered({ [`peerHelpPromises/${LESSON}/${BYSTANDER}`]: 1 })
    await assertFails(ref(bystander(), '/').update(claimUpdate(BYSTANDER)))
    await seed({
      [`sessions/${LESSON}/students/${HELPER}/checkOverridePassed`]: false,
    })
    await assertFails(ref(as.otherStudent, '/').update(claimUpdate(HELPER)))
  })

  it('accepts a teacher pass in place of a passed check', async () => {
    await seedOffered({
      [`sessions/${LESSON}/students/${BYSTANDER}/checkOverridePassed`]: true,
      [`peerHelpPromises/${LESSON}/${BYSTANDER}`]: 1,
    })
    await assertSucceeds(ref(bystander(), '/').update(claimUpdate(BYSTANDER)))
  })

  it('refuses without the helper promise', async () => {
    await seedOffered({ [`peerHelpPromises/${LESSON}/${HELPER}`]: null })
    await assertFails(ref(as.otherStudent, '/').update(claimUpdate(HELPER)))
  })

  it('refuses a student the teacher switched off, and everyone while paused', async () => {
    await seedOffered({ [`sessions/${LESSON}/peerHelperOff/${HELPER}`]: true })
    await assertFails(ref(as.otherStudent, '/').update(claimUpdate(HELPER)))
    await seed({
      [`sessions/${LESSON}/peerHelperOff/${HELPER}`]: null,
      [`sessions/${LESSON}/peerHelpSettings/pausedAt`]: 9,
    })
    await assertFails(ref(as.otherStudent, '/').update(claimUpdate(HELPER)))
  })

  it('refuses an ended offer, an offer for another task, and the stuck student', async () => {
    await seedOffered({ [`sessions/${LESSON}/peerHelpOffers/${R}/endedAt`]: 3 })
    await assertFails(ref(as.otherStudent, '/').update(claimUpdate(HELPER)))
    await seed({
      [`sessions/${LESSON}/peerHelpOffers/${R}/endedAt`]: null,
      [`sessions/${LESSON}/currentTaskId`]: 3,
    })
    await assertFails(ref(as.otherStudent, '/').update(claimUpdate(HELPER)))
    await seed({
      [`sessions/${LESSON}/currentTaskId`]: 2,
      [`sessions/${LESSON}/students/${STUCK}/checkPassed`]: true,
      [`peerHelpPromises/${LESSON}/${STUCK}`]: 1,
    })
    await assertFails(ref(as.student, '/').update(claimUpdate(STUCK)))
  })

  it('refuses claiming for someone else, or marking an offer claimed without claiming it', async () => {
    await seedOffered()
    await assertFails(ref(bystander(), `peerHelp/${LESSON}/${R}/helperId`).set(HELPER))
    await assertFails(ref(bystander(), `sessions/${LESSON}/peerHelpOffers/${R}/claimedAt`).set(5))
  })
})

describe('anonymity', () => {
  it('never lets either student read who the other is', async () => {
    await seedClaimed()
    await assertFails(ref(as.otherStudent, `peerHelp/${LESSON}/${R}/stuckId`).get())
    await assertFails(ref(as.student, `peerHelp/${LESSON}/${R}/helperId`).get())
    await assertFails(ref(as.student, `peerHelp/${LESSON}/${R}`).get())
    await assertFails(ref(as.otherStudent, `peerHelp/${LESSON}/${R}`).get())
    // Each can read their own role.
    await assertSucceeds(ref(as.student, `peerHelp/${LESSON}/${R}/stuckId`).get())
    await assertSucceeds(ref(as.otherStudent, `peerHelp/${LESSON}/${R}/helperId`).get())
  })

  it('keeps the work, the inbox and the state away from the rest of the class', async () => {
    await seedClaimed()
    for (const part of ['snapshot', 'state', 'inbox', 'review']) {
      await assertFails(ref(bystander(), `peerHelp/${LESSON}/${R}/${part}`).get())
    }
    await assertSucceeds(ref(as.otherStudent, `peerHelp/${LESSON}/${R}/snapshot`).get())
    await assertSucceeds(ref(as.student, `peerHelp/${LESSON}/${R}/inbox`).get())
    // Only the helper sees the review queue (their own pending items).
    await assertFails(ref(as.student, `peerHelp/${LESSON}/${R}/review`).get())
    await assertSucceeds(ref(as.teacher, `peerHelp/${LESSON}`).get())
  })
})

describe('what a helper can send', () => {
  const inbox = (id) => `peerHelp/${LESSON}/${R}/inbox/${id}`
  const review = (id) => `peerHelp/${LESSON}/${R}/review/${id}`

  it('sends thumbs and preset hints straight to the stuck student', async () => {
    await seedClaimed()
    await assertSucceeds(
      ref(as.otherStudent, inbox('a')).set({ kind: 'mark', line: 2, verdict: 'down', createdAt: 1 })
    )
    await assertSucceeds(
      ref(as.otherStudent, inbox('b')).set({
        kind: 'hint',
        hintId: 'py-colon',
        line: 2,
        createdAt: 1,
      })
    )
  })

  it('cannot smuggle words into the inbox', async () => {
    await seedClaimed()
    await assertFails(
      ref(as.otherStudent, inbox('a')).set({ kind: 'hint', hintId: 'you are bad', createdAt: 1 })
    )
    await assertFails(
      ref(as.otherStudent, inbox('b')).set({ kind: 'mark', line: 1, text: 'hi', createdAt: 1 })
    )
    await assertFails(
      ref(as.otherStudent, inbox('c')).set({ kind: 'note', text: 'hi', createdAt: 1 })
    )
    await assertFails(
      ref(as.otherStudent, inbox('d')).set({ kind: 'mark', line: 1, extra: 'hi', createdAt: 1 })
    )
    // Nor change or delete what is already there.
    await seed({ [inbox('e')]: { kind: 'mark', line: 1, verdict: 'up', createdAt: 1 } })
    await assertFails(ref(as.otherStudent, `${inbox('e')}/verdict`).set('down'))
    await assertFails(ref(as.otherStudent, inbox('e')).set(null))
  })

  it('sends edits and notes to the teacher, never the student', async () => {
    await seedClaimed({ [`sessions/${LESSON}/peerHelpSettings/notesEnabled`]: true })
    const edit = {
      kind: 'edit',
      status: 'pending',
      createdAt: 1,
      file: '',
      edits: { 0: { line: 2, op: 'replace', text: 'if x:', before: 'if x' } },
    }
    await assertSucceeds(ref(as.otherStudent, review('a')).set(edit))
    await assertSucceeds(
      ref(as.otherStudent, review('b')).set({
        kind: 'note',
        status: 'pending',
        line: 2,
        text: 'Try a colon',
        createdAt: 1,
      })
    )
    // A helper cannot approve their own item.
    await assertFails(ref(as.otherStudent, review('c')).set({ ...edit, status: 'approved' }))
    await assertFails(ref(as.otherStudent, `${review('a')}/status`).set('approved'))
  })

  it('limits an edit to three lines', async () => {
    await seedClaimed()
    const line = { line: 2, op: 'insert', text: 'x', before: 'y' }
    await assertFails(
      ref(as.otherStudent, review('a')).set({
        kind: 'edit',
        status: 'pending',
        createdAt: 1,
        edits: { 0: line, 1: line, 2: line, 3: line },
      })
    )
  })

  it('refuses notes unless the teacher turned them on, and caps them at 140 characters', async () => {
    await seedClaimed()
    const note = { kind: 'note', status: 'pending', line: 1, text: 'Try a colon', createdAt: 1 }
    await assertFails(ref(as.otherStudent, review('a')).set(note))
    // A blocked attempt is still recorded for the teacher.
    await assertSucceeds(
      ref(as.otherStudent, review('b')).set({
        ...note,
        status: 'blocked',
        blockedReason: 'language',
      })
    )
    await seed({ [`sessions/${LESSON}/peerHelpSettings/notesEnabled`]: true })
    await assertSucceeds(ref(as.otherStudent, review('c')).set(note))
    await assertFails(ref(as.otherStudent, review('d')).set({ ...note, text: 'x'.repeat(141) }))
  })

  it('stops a bystander, and stops everything once the help has ended', async () => {
    await seedClaimed()
    const mark = { kind: 'mark', line: 1, verdict: 'up', createdAt: 1 }
    await assertFails(ref(bystander(), inbox('a')).set(mark))
    await seed({ [`peerHelp/${LESSON}/${R}/state/endedAt`]: 9 })
    await assertFails(ref(as.otherStudent, inbox('b')).set(mark))
    await assertFails(ref(as.student, `peerHelp/${LESSON}/${R}/snapshot`).set({ code: 'z' }))
  })
})

describe('the stuck student and the teacher', () => {
  it('lets the stuck student respond, flag Not OK and end it, but not write items', async () => {
    await seedClaimed({
      [`peerHelp/${LESSON}/${R}/inbox/a`]: { kind: 'mark', line: 1, verdict: 'up', createdAt: 1 },
    })
    const base = `peerHelp/${LESSON}/${R}`
    await assertSucceeds(ref(as.student, `${base}/inbox/a/response`).set('useful'))
    await assertFails(ref(as.student, `${base}/inbox/a/response`).set('rude'))
    await assertFails(ref(as.otherStudent, `${base}/inbox/a/response`).set('useful'))
    await assertFails(
      ref(as.student, `${base}/inbox/b`).set({ kind: 'mark', line: 1, verdict: 'up', createdAt: 1 })
    )
    await assertSucceeds(ref(as.student, `${base}/state/notOkAt`).set(7))
    await assertFails(ref(as.otherStudent, `${base}/state/notOkAt`).set(7))
    await assertFails(ref(as.student, `${base}/state/notOkSeenAt`).set(8))
    await assertSucceeds(
      ref(as.student, '/').update({
        [`${base}/state/endedAt`]: 9,
        [`${base}/state/endedBy`]: 'stuck',
        [`sessions/${LESSON}/peerHelpOffers/${R}/endedAt`]: 9,
      })
    )
  })

  it('lets the helper end it as the helper only', async () => {
    await seedClaimed()
    const base = `peerHelp/${LESSON}/${R}/state`
    await assertFails(ref(as.otherStudent, `${base}/endedBy`).set('stuck'))
    await assertSucceeds(ref(as.otherStudent, `${base}/endedBy`).set('helper'))
    await assertFails(ref(bystander(), `sessions/${LESSON}/peerHelpOffers/${R}/endedAt`).set(9))
  })

  it('lets only the teacher approve, pause, switch helpers off and turn notes on', async () => {
    await seedClaimed()
    await assertSucceeds(
      ref(as.teacher, `peerHelp/${LESSON}/${R}/inbox/x`).set({
        kind: 'note',
        text: 'Try a colon',
        line: 2,
        reviewItemId: 'r1',
        createdAt: 1,
      })
    )
    await assertSucceeds(
      ref(as.teacher, `sessions/${LESSON}/peerHelpSettings`).set({
        notesEnabled: true,
        pausedAt: 1,
      })
    )
    await assertSucceeds(ref(as.teacher, `sessions/${LESSON}/peerHelperOff/${HELPER}`).set(true))
    await assertFails(ref(as.student, `sessions/${LESSON}/peerHelpSettings/notesEnabled`).set(true))
    await assertFails(ref(as.otherStudent, `sessions/${LESSON}/peerHelperOff/${HELPER}`).set(null))
  })
})
