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
    const marker = `sessions/${LESSON}/joiningStudents/temp-1`
    await assertSucceeds(ref(as.student, marker).set({ joinedAt: 1000 }))
    await assertFails(ref(as.anonymous, marker).set({ joinedAt: 1000 }))
    await assertFails(ref(as.student, marker).set(true))
    await assertFails(ref(as.student, marker).set({ joinedAt: 1000, extra: 'x' }))
  })

  describe('joining marker typedName and admit', () => {
    const marker = `sessions/${LESSON}/joiningStudents/temp-1`

    beforeEach(async () => {
      await testEnv.withSecurityRulesDisabled((ctx) => ref(ctx, marker).set({ joinedAt: 1000 }))
    })

    it('lets the student share a typed name up to 30 characters', async () => {
      await assertSucceeds(ref(as.student, `${marker}/typedName`).set('Jamie'))
      await assertSucceeds(ref(as.student, `${marker}/typedName`).set('x'.repeat(30)))
      await assertSucceeds(ref(as.student, `${marker}/typedName`).set(null))
      await assertFails(ref(as.student, `${marker}/typedName`).set('x'.repeat(31)))
      await assertFails(ref(as.student, `${marker}/typedName`).set(42))
    })

    it('does not let a typed name or admit recreate a removed marker', async () => {
      await assertSucceeds(ref(as.student, marker).remove())
      await assertFails(ref(as.student, `${marker}/typedName`).set('Jamie'))
      await assertFails(ref(as.teacher, `${marker}/admit`).set({ name: 'Jamie', at: 2000 }))
    })

    it('lets only teachers and admins write admit, with a valid name and time', async () => {
      await assertFails(ref(as.student, `${marker}/admit`).set({ name: 'Jamie', at: 2000 }))
      await assertSucceeds(ref(as.teacher, `${marker}/admit`).set({ name: 'Jamie', at: 2000 }))
      await assertSucceeds(ref(as.admin, `${marker}/admit`).set({ name: 'Sam', at: 3000 }))
      await assertFails(ref(as.teacher, `${marker}/admit`).set({ name: '', at: 2000 }))
      await assertFails(ref(as.teacher, `${marker}/admit`).set({ name: 'x'.repeat(31), at: 2000 }))
      await assertFails(ref(as.teacher, `${marker}/admit`).set({ name: 'Jamie' }))
      await assertFails(ref(as.teacher, `${marker}/admit`).set({ name: 'Jamie', at: 'now' }))
      await assertFails(
        ref(as.teacher, `${marker}/admit`).set({ name: 'Jamie', at: 2000, extra: true })
      )
    })

    it('still lets the student remove its own marker after an admit', async () => {
      await assertSucceeds(ref(as.teacher, `${marker}/admit`).set({ name: 'Jamie', at: 2000 }))
      await assertSucceeds(ref(as.student, `${marker}/typedName`).set('Jamie'))
      await assertSucceeds(ref(as.student, marker).remove())
    })
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

describe('class countdown', () => {
  const path = `sessions/${LESSON}/classCountdown`
  const countdown = { startedAt: 1000, endsAt: 61_000, durationMs: 60_000 }

  it('only lets teachers and admins start or clear the countdown', async () => {
    await assertFails(ref(as.student, path).set(countdown))
    await assertSucceeds(ref(as.teacher, path).set(countdown))
    await assertSucceeds(ref(as.admin, path).set(null))
  })

  it('requires numeric startedAt, endsAt and a positive durationMs, and nothing else', async () => {
    await assertFails(ref(as.teacher, path).set({ startedAt: 1000, endsAt: 61_000 }))
    await assertFails(ref(as.teacher, path).set({ ...countdown, durationMs: 0 }))
    await assertFails(ref(as.teacher, path).set({ ...countdown, endsAt: 500 }))
    await assertFails(ref(as.teacher, path).set({ ...countdown, endsAt: 'soon' }))
    await assertFails(ref(as.teacher, path).set({ ...countdown, label: 'x' }))
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
    ['autocomplete', { firstUsedAt: 1, context: 'personal', taskId: null }],
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

  it('rejects an autocomplete signal with an unknown context', async () => {
    await assertFails(
      ref(as.student, `${signals(STUDENT_ID)}/autocomplete`).set({ firstUsedAt: 1, context: 'x' })
    )
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

describe('presentation annotations (liveInk)', () => {
  const root = `liveInk/${LESSON}`
  const pointer = { surface: 'info:3', anchor: 'b0.p1', rx: 0.4, ry: 0.5, t: 1 }
  const stroke = {
    surface: 'explainer:3',
    anchor: 'b0.li2',
    points: [
      [0.1, 0.2],
      [0.3, 0.4],
    ],
    colour: 'var(--colour-error)',
    t: 1,
  }
  const highlight = { surface: 'info:3', anchor: 'b0.p0', quote: 'print', occurrence: 1, t: 1 }

  it('lets anyone read the annotations, including signed-out visitors', async () => {
    await testEnv.withSecurityRulesDisabled((ctx) => ref(ctx, `${root}/pointer`).set(pointer))
    await assertSucceeds(ref(as.anonymous, root).get())
    await assertSucceeds(ref(as.student, root).get())
  })

  it('lets only teachers and admins write them', async () => {
    await assertSucceeds(ref(as.teacher, `${root}/pointer`).set(pointer))
    await assertSucceeds(ref(as.admin, `${root}/strokes/s1`).set(stroke))
    await assertSucceeds(ref(as.teacher, `${root}/highlights/h1`).set(highlight))
    await assertFails(ref(as.student, `${root}/pointer`).set(pointer))
    await assertFails(ref(as.anonymous, `${root}/highlights/h1`).set(highlight))
    await assertFails(ref(as.student, root).remove())
    await assertSucceeds(ref(as.teacher, root).remove())
  })

  it('rejects malformed pointers, strokes and highlights', async () => {
    await assertFails(ref(as.teacher, `${root}/pointer`).set({ ...pointer, rx: 50 }))
    await assertFails(ref(as.teacher, `${root}/pointer`).set({ ...pointer, extra: true }))
    await assertFails(ref(as.teacher, `${root}/pointer`).set({ surface: 'info:3', rx: 0, ry: 0 }))
    await assertFails(
      ref(as.teacher, `${root}/strokes/s1`).set({ ...stroke, points: [['a', 0.2]] })
    )
    await assertFails(
      ref(as.teacher, `${root}/highlights/h1`).set({ ...highlight, quote: 'x'.repeat(501) })
    )
    await assertFails(ref(as.teacher, `${root}/somethingElse`).set(true))
  })

  it('accepts text-anchored pointers and stroke points, alone or mixed with fractions', async () => {
    const textPointer = { surface: 'info:3', anchor: 'b0.p1', c: 12, dx: 0.25, dy: -0.4, t: 1 }
    await assertSucceeds(ref(as.teacher, `${root}/pointer`).set(textPointer))
    await assertSucceeds(
      ref(as.teacher, `${root}/strokes/s1`).set({
        ...stroke,
        points: [{ c: 3, dx: 0.1, dy: 0.6 }, [0.5, 0.5], { c: 9, dx: -0.2, dy: 0.6 }],
      })
    )
  })

  it('rejects malformed text-anchored pointers and stroke points', async () => {
    const textPointer = { surface: 'info:3', anchor: 'b0.p1', c: 12, dx: 0.25, dy: -0.4, t: 1 }
    await assertFails(ref(as.teacher, `${root}/pointer`).set({ ...textPointer, dx: 500 }))
    await assertFails(ref(as.teacher, `${root}/pointer`).set({ ...textPointer, c: -1 }))
    await assertFails(ref(as.teacher, `${root}/pointer`).set({ ...textPointer, rx: 0.5, ry: 0.5 }))
    const { dy: _dy, ...missingDy } = textPointer
    await assertFails(ref(as.teacher, `${root}/pointer`).set(missingDy))
    await assertFails(
      ref(as.teacher, `${root}/strokes/s1`).set({ ...stroke, points: [{ c: 3, dx: 0.1 }] })
    )
    await assertFails(
      ref(as.teacher, `${root}/strokes/s1`).set({
        ...stroke,
        points: [{ c: 3, dx: 0.1, dy: 0.2, extra: 1 }],
      })
    )
    await assertFails(
      ref(as.teacher, `${root}/strokes/s1`).set({ ...stroke, points: [{ c: 'x', dx: 0, dy: 0 }] })
    )
  })

  it('caps a stroke at 200 points', async () => {
    const points = (count) => Array.from({ length: count }, (_, i) => [i / count, 0.5])
    await assertSucceeds(
      ref(as.teacher, `${root}/strokes/s1`).set({ ...stroke, points: points(200) })
    )
    await assertFails(ref(as.teacher, `${root}/strokes/s2`).set({ ...stroke, points: points(201) }))
    const textPoints = (count) =>
      Array.from({ length: count }, (_, i) => ({ c: i, dx: 0, dy: 0.6 }))
    await assertSucceeds(
      ref(as.teacher, `${root}/strokes/s3`).set({ ...stroke, points: textPoints(200) })
    )
    await assertFails(
      ref(as.teacher, `${root}/strokes/s4`).set({ ...stroke, points: textPoints(201) })
    )
  })
})

describe('shown short answers', () => {
  const path = `sessions/${LESSON}/shownResponses/r1`
  const entry = {
    taskId: 'show-and-tell',
    anonymousId: STUDENT_ID,
    text: 'I made a maze game',
    showName: false,
    shownAt: 1000,
  }

  it('lets teachers show and hide an answer, but not students', async () => {
    await assertSucceeds(ref(as.teacher, path).set(entry))
    await assertSucceeds(ref(as.teacher, `${path}/hiddenAt`).set(2000))
    await assertSucceeds(ref(as.teacher, `${path}/showName`).set(true))
    await assertFails(ref(as.student, `sessions/${LESSON}/shownResponses/r2`).set(entry))
    await assertFails(ref(as.student, `${path}/hiddenAt`).set(3000))
  })

  it('rejects malformed entries', async () => {
    await assertFails(ref(as.teacher, path).set({ ...entry, text: '' }))
    await assertFails(ref(as.teacher, path).set({ ...entry, text: 'x'.repeat(1001) }))
    await assertFails(ref(as.teacher, path).set({ ...entry, showName: 'yes' }))
    await assertFails(ref(as.teacher, path).set({ ...entry, extra: 1 }))
    const { taskId: _taskId, ...noTask } = entry
    await assertFails(ref(as.teacher, path).set(noTask))
  })
})

describe('live class polls', () => {
  const pollPath = `sessions/${LESSON}/polls/p1`
  const poll = {
    question: 'What next?',
    options: ['Games', 'Art'],
    status: 'open',
    showResults: false,
    createdAt: 1000,
  }
  const answerPath = (studentId) => `sessions/${LESSON}/students/${studentId}/pollResponses/p1`

  it('lets teachers launch a poll and name the active poll, but not students', async () => {
    await assertSucceeds(ref(as.teacher, pollPath).set(poll))
    await assertSucceeds(ref(as.teacher, `sessions/${LESSON}/activePollId`).set('p1'))
    await assertFails(ref(as.student, `sessions/${LESSON}/polls/p2`).set(poll))
    await assertFails(ref(as.student, `sessions/${LESSON}/activePollId`).set('p1'))
  })

  it('rejects malformed polls', async () => {
    await assertFails(ref(as.teacher, pollPath).set({ ...poll, status: 'paused' }))
    await assertFails(ref(as.teacher, pollPath).set({ ...poll, question: '' }))
    await assertFails(ref(as.teacher, pollPath).set({ ...poll, extra: 1 }))
    await assertFails(
      ref(as.teacher, pollPath).set({ ...poll, options: ['1', '2', '3', '4', '5', '6', '7'] })
    )
    const { question: _question, ...noQuestion } = poll
    await assertFails(ref(as.teacher, pollPath).set(noQuestion))
  })

  it('lets a student answer an open poll on their own node only', async () => {
    await testEnv.withSecurityRulesDisabled((ctx) => ref(ctx, pollPath).set(poll))
    await assertSucceeds(ref(as.student, answerPath(STUDENT_ID)).set({ choice: 1, answeredAt: 5 }))
    await assertSucceeds(ref(as.student, answerPath(STUDENT_ID)).set({ choice: 0, answeredAt: 6 }))
    await assertFails(
      ref(as.student, answerPath(OTHER_STUDENT_ID)).set({ choice: 1, answeredAt: 5 })
    )
    await assertFails(ref(as.student, answerPath(STUDENT_ID)).set({ choice: 9, answeredAt: 5 }))
    await assertFails(ref(as.student, answerPath(STUDENT_ID)).set({ choice: 'a', answeredAt: 5 }))
    await assertFails(
      ref(as.student, answerPath(STUDENT_ID)).set({ choice: 1, answeredAt: 5, extra: true })
    )
  })

  it('refuses student answers to a closed or missing poll', async () => {
    await testEnv.withSecurityRulesDisabled((ctx) =>
      ref(ctx, pollPath).set({ ...poll, status: 'closed', closedAt: 2000 })
    )
    await assertFails(ref(as.student, answerPath(STUDENT_ID)).set({ choice: 1, answeredAt: 5 }))
    await assertFails(
      ref(as.student, `sessions/${LESSON}/students/${STUDENT_ID}/pollResponses/nope`).set({
        choice: 0,
        answeredAt: 5,
      })
    )
  })
})
