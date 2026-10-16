// HSC Audit: READ-ONLY aggregate usage counts from Firebase for in-scope courses.
// Outputs counts only: never names, ids of students, emails or code.
// Run: node scripts/hsc-audit/usage-counts.mjs [--since 2026-09-01] [--json out.json]
// Needs cli/.env (GOOGLE_APPLICATION_CREDENTIALS). HSC_REPO points at a checkout
// whose cli/ has its packages and .env (e.g. the main checkout, from a worktree).
// Update COURSE_BY_LEVEL below when the courses taught change.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, isAbsolute } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const REPO = process.env.HSC_REPO || fileURLToPath(new URL('../..', import.meta.url))
const CLI = join(REPO, 'cli')
const args = process.argv.slice(2)
const argVal = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d)
const SINCE = argVal('--since', '2026-09-01')
const SINCE_MS = Date.parse(SINCE + 'T00:00:00Z')
const JSON_OUT = argVal('--json', null)

function readEnv(file) {
  const out = {}
  if (!existsSync(file)) return out
  for (const line of readFileSync(file, 'utf-8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '')
  }
  return out
}
const cliEnv = readEnv(join(CLI, '.env'))
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const p = cliEnv.GOOGLE_APPLICATION_CREDENTIALS
  process.env.GOOGLE_APPLICATION_CREDENTIALS = isAbsolute(p) ? p : join(CLI, p)
}

const { db } = await import(pathToFileURL(join(CLI, 'firebase.mjs')).href)

// ---------- course mapping ----------
const COURSE_BY_LEVEL = {
  'python-level-1': 'Python L1',
  'lessons-python-level-2': 'Python L2',
  'lessons-python-level-2b': 'Python L2B',
  'lessons-python-level-3b': 'Python L3B',
  'lessons-python-level-4b': 'Python L4B',
  'lessons-scratch-level-1': 'Scratch L1',
  'lessons-tinkercad-level-1c': 'Tinkercad L1C',
}
// Archived lessons that belonged to an in-scope course (id prefix).
const COURSE_BY_PREFIX = [
  [/^python-1-/, 'Python L1'],
  [/^python-2b-/, 'Python L2B'],
  [/^python-3b-/, 'Python L3B'],
  [/^python-4b-/, 'Python L4B'],
  [/^scratch-1-/, 'Scratch L1'],
]
function courseOf(id, data) {
  const lv = data.levelId ?? data.levelRef ?? null
  if (lv && COURSE_BY_LEVEL[lv]) return COURSE_BY_LEVEL[lv]
  const src = data.fork?.sourceLessonId
  for (const [re, c] of COURSE_BY_PREFIX) if (re.test(id) || (src && re.test(src))) return c
  return null
}

// ---------- helpers ----------
const inc = (o, k, n = 1) => {
  if (k === undefined || k === null) k = '(none)'
  o[k] = (o[k] || 0) + n
}
const median = (a) => {
  if (!a.length) return null
  const s = [...a].sort((x, y) => x - y)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const toMs = (v) =>
  v == null
    ? null
    : typeof v === 'number'
      ? v
      : v.toMillis
        ? v.toMillis()
        : v._seconds
          ? v._seconds * 1000
          : Date.parse(v)
const keyPresence = {} // section -> key -> count
const markKeys = (section, obj) => {
  if (!obj || typeof obj !== 'object') return
  const t = (keyPresence[section] ||= {})
  for (const k of Object.keys(obj)) if (obj[k] !== undefined) inc(t, k)
}

// ---------- lessons ----------
const lessonSnap = await db.collection('lessons').get()
const lessons = lessonSnap.docs.map((d) => ({ id: d.id, data: d.data() }))
const inScope = lessons
  .map((l) => ({ ...l, course: courseOf(l.id, l.data) }))
  .filter((l) => l.course)
const lessonCountByCourse = {}
for (const l of inScope) inc(lessonCountByCourse, `${l.course}${l.data.soloOnly ? ' (solo)' : ''}`)

// ---------- session reports ----------
const A = {
  window: { since: SINCE, until: new Date().toISOString().slice(0, 10) },
  lessonsInScope: lessonCountByCourse,
  reportsPerCourse: {},
  reportsPerCourseWithStudents: {},
  lessonsTaughtPerCourse: {},
  studentSlotsPerCourse: {},
  classSizes: [],
  classSizesByCourse: {},
  sessionMinutes: [],
  sessionsUnder10Min: 0,
  sessionsZeroStudents: 0,
  sessionsByMonth: {},
  tasks: {
    reportableTaskRows: 0,
    taughtByType: {}, // with any activity
    infoTasksInTimeline: 0,
    timelineEntries: 0,
    reportsWithTimeline: 0,
    priority: {},
  },
  results: { finalResult: {}, overrideSource: {}, autoCheck: {}, teacherAssisted: 0 },
  attempts: { totalAttempts: 0, distinctAttempts: 0, failedDistinctWithHint: 0, errorAttempts: 0 },
  support: {
    reveals: 0,
    revealsBySource: {},
    teacherLiveCodeReveals: 0,
    studentsTasksWithReveal: 0,
  },
  badges: {
    summary: { suggested: 0, awarded: 0, autoAwarded: 0, manual: 0, dismissed: 0, revoked: 0 },
    awardedById: {},
    suggestedById: {},
    heldBySource: {},
    reportsWithBadgeSummary: 0,
  },
  polls: {
    adHocPolls: 0,
    adHocResponses: 0,
    adHocPrivate: 0,
    reportsWithPolls: 0,
    taskPollsRun: 0,
    taskPollResponses: 0,
  },
  confidence: { tasksRun: 0, responses: 0 },
  shortAnswerShown: { tasksWithShown: 0, answersShown: 0 },
  peerHelp: {
    requests: 0,
    claimed: 0,
    notOk: 0,
    delivered: 0,
    deliveredByKind: {},
    responses: {},
    reviewedByStatus: {},
    endedBy: {},
  },
  sideQuests: { opens: 0, done: 0, studentTasks: 0 },
  tutorTileHighlights: 0,
  tileMisses: 0,
  pastes: { count: 0, studentTasks: 0 },
  teacherSandbox: {
    reportsWithVisits: 0,
    visits: 0,
    totalMinutes: 0,
    pushes: 0,
    studentsUsing: 0,
    studentRuns: 0,
  },
  personalSandbox: { students: 0, runs: 0, errorRuns: 0, fixes: 0, minutes: 0 },
  topics: { opens: 0, byContext: {}, bySource: {}, studentsOpening: 0, libraryButtonOpens: 0 },
  shortcuts: { firstUses: 0, studentsUsing: 0, byId: {} },
  ratings: {
    taskRatings: 0,
    taskRatingDist: {},
    sessionFeedback: 0,
    sessionRatingDist: {},
    sessionFeedbackWithNotes: 0,
  },
  carry: { carryFallbacks: 0, crossLessonCarry: {} },
  joins: { withJoinedAt: 0, rejoins: 0, studentsRejoining: 0 },
  newer: {
    typingStudentTasks: 0,
    slowMoStudentTasks: 0,
    scrubStudentTasks: 0,
    inspectorStudentTasks: 0,
    predictionStudentTasks: 0,
    exampleOpenStudentTasks: 0,
    courseStudentTasks: 0,
    puzzleStudentTasks: 0,
    typingHistoryStudentTasks: 0,
    lastDraftStudentTasks: 0,
    itemProgressStudentTasks: 0,
    quizGroupsReports: 0,
  },
  trimmedReports: 0,
  outOfScopeReportsSince: {},
}

for (const lesson of lessons) {
  const course = courseOf(lesson.id, lesson.data)
  // Fetch all and filter client-side: the startedAt single-field index is exempted
  // on this collection, and this audit must not create indexes.
  const all = await db.collection('lessons').doc(lesson.id).collection('sessionReports').get()
  const docs = all.docs.filter((d) => (toMs(d.data().startedAt) ?? 0) >= SINCE_MS)
  if (!docs.length) continue
  if (!course) {
    inc(
      A.outOfScopeReportsSince,
      lesson.data.levelId ? `${lesson.data.levelId}` : `(no level) ${lesson.id}`,
      docs.length
    )
    continue
  }
  for (const doc of docs) {
    const r = doc.data()
    markKeys('report', r)
    inc(A.reportsPerCourse, course)
    const students = Array.isArray(r.students) ? r.students : []
    const n = students.length
    if (n === 0) A.sessionsZeroStudents++
    else {
      inc(A.reportsPerCourseWithStudents, course)
      A.classSizes.push(n)
      ;(A.classSizesByCourse[course] ||= []).push(n)
    }
    inc(A.studentSlotsPerCourse, course, n)
    ;(A.lessonsTaughtPerCourse[course] ||= new Set()).add(lesson.id)
    const mins = r.endedAt && r.startedAt ? (r.endedAt - r.startedAt) / 60000 : null
    if (mins != null) {
      A.sessionMinutes.push(mins)
      if (mins < 10) A.sessionsUnder10Min++
    }
    // "Likely real class" = at least 10 minutes and at least one student.
    if (mins != null && mins >= 10 && n > 0) {
      const R = (A.likelyRealSessions ||= { perCourse: {}, slotsPerCourse: {}, sizes: [] })
      inc(R.perCourse, course)
      inc(R.slotsPerCourse, course, n)
      R.sizes.push(n)
    }
    inc(A.sessionsByMonth, new Date(r.startedAt).toISOString().slice(0, 7))
    if (r.sizeNote) A.trimmedReports++

    // timeline / info tasks
    const infoIds = new Set(
      (lesson.data.tasks || [])
        .flatMap((t) => [t, ...(t.tasks || t.children || [])])
        .filter((t) => t && (t.type === 'information' || t.taskType === 'information'))
        .map((t) => String(t.id))
    )
    if (Array.isArray(r.taskTimeline)) {
      A.tasks.reportsWithTimeline++
      A.tasks.timelineEntries += r.taskTimeline.length
      const seen = new Set()
      for (const e of r.taskTimeline)
        if (infoIds.has(String(e.taskId)) && !seen.has(e.taskId))
          (seen.add(e.taskId), A.tasks.infoTasksInTimeline++)
    }

    // task summary
    for (const t of r.taskSummary || []) {
      markKeys('taskSummary', t)
      A.tasks.reportableTaskRows++
      inc(A.tasks.priority, t.priority)
      const type =
        t.taskType === 'quiz'
          ? `quiz:${t.quizType}`
          : t.taskType === 'activity'
            ? `activity:${t.activityType}`
            : t.taskType
      const active =
        (t.respondedCount ?? 0) > 0 || (t.completedCount ?? 0) > 0 || (t.avgAttempts ?? 0) > 0
      if (active) inc(A.tasks.taughtByType, type)
      if (t.quizType === 'poll' && (t.respondedCount ?? 0) > 0)
        (A.polls.taskPollsRun++, (A.polls.taskPollResponses += t.respondedCount))
      if (t.quizType === 'confidence' && (t.respondedCount ?? 0) > 0)
        (A.confidence.tasksRun++, (A.confidence.responses += t.respondedCount))
      if (Array.isArray(t.shownResponses) && t.shownResponses.length)
        (A.shortAnswerShown.tasksWithShown++,
          (A.shortAnswerShown.answersShown += t.shownResponses.length))
      if (t.teacherRating) {
        A.ratings.taskRatings++
        inc(A.ratings.taskRatingDist, t.teacherRating.rating ?? 'notes only')
      }
    }
    if (r.quizGroups) A.newer.quizGroupsReports++
    if (r.teacherFeedback) {
      A.ratings.sessionFeedback++
      inc(A.ratings.sessionRatingDist, r.teacherFeedback.rating ?? 'notes only')
      if (
        (r.teacherFeedback.whatWorkedWell || '').trim() ||
        (r.teacherFeedback.whatDidntWork || '').trim()
      )
        A.ratings.sessionFeedbackWithNotes++
    }

    // badges
    if (r.badgeSummary) {
      A.badges.reportsWithBadgeSummary++
      for (const [id, b] of Object.entries(r.badgeSummary)) {
        for (const k of Object.keys(A.badges.summary)) A.badges.summary[k] += b[k] || 0
        inc(A.badges.awardedById, id, b.awarded || 0)
        inc(A.badges.suggestedById, id, b.suggested || 0)
      }
    }
    // polls
    if (Array.isArray(r.polls) && r.polls.length) {
      A.polls.reportsWithPolls++
      for (const p of r.polls) {
        A.polls.adHocPolls++
        A.polls.adHocResponses += p.respondedCount || 0
        if (p.showResults === false) A.polls.adHocPrivate++
      }
    }
    // peer help
    for (const p of r.peerHelp || []) {
      A.peerHelp.requests++
      if (p.helper) A.peerHelp.claimed++
      if (p.notOkAt) A.peerHelp.notOk++
      inc(A.peerHelp.endedBy, p.endedBy)
      for (const d of p.delivered || []) {
        A.peerHelp.delivered++
        inc(A.peerHelp.deliveredByKind, d.kind)
        if (d.response) inc(A.peerHelp.responses, d.response)
      }
      for (const d of p.reviewed || []) inc(A.peerHelp.reviewedByStatus, d.status)
    }
    // teacher sandbox
    if (r.teacherSandbox?.visits?.length) {
      A.teacherSandbox.reportsWithVisits++
      for (const v of r.teacherSandbox.visits) {
        A.teacherSandbox.visits++
        A.teacherSandbox.totalMinutes += (v.durationMs || 0) / 60000
        A.teacherSandbox.pushes += (v.pushes || []).length
      }
    }
    if (r.shortcutSummary)
      for (const [k, v] of Object.entries(r.shortcutSummary)) inc(A.shortcuts.byId, k, v)

    // students
    for (const s of students) {
      markKeys('student', s)
      if (s.joinedAt) A.joins.withJoinedAt++
      if (s.rejoins?.length) (A.joins.studentsRejoining++, (A.joins.rejoins += s.rejoins.length))
      for (const b of s.badges || []) inc(A.badges.heldBySource, b.source)
      if (s.topicsOpened?.length) {
        A.topics.studentsOpening++
        for (const t of s.topicsOpened) {
          A.topics.opens++
          inc(A.topics.byContext, t.context)
          inc(A.topics.bySource, t.source)
          if (t.title === 'Topic Library') A.topics.libraryButtonOpens++
        }
      }
      if (s.shortcutsUsed?.length)
        (A.shortcuts.studentsUsing++, (A.shortcuts.firstUses += s.shortcutsUsed.length))
      if (s.personalSandbox) {
        A.personalSandbox.students++
        A.personalSandbox.runs += s.personalSandbox.runs || 0
        A.personalSandbox.errorRuns += s.personalSandbox.errorRuns || 0
        A.personalSandbox.fixes += s.personalSandbox.fixes || 0
        A.personalSandbox.minutes += (s.personalSandbox.timeMs || 0) / 60000
      }
      if (s.teacherSandbox)
        (A.teacherSandbox.studentsUsing++,
          (A.teacherSandbox.studentRuns += s.teacherSandbox.runs || 0))

      for (const t of s.tasks || []) {
        markKeys('studentTask', t)
        inc(A.results.finalResult, t.finalResult)
        if (t.override) inc(A.results.overrideSource, t.override.source ?? '(pre-2026-10-01)')
        if (t.autoCheck) inc(A.results.autoCheck, t.autoCheck.result)
        if (t.teacherAssisted) A.results.teacherAssisted++
        A.attempts.totalAttempts += t.attempts || 0
        for (const a of t.distinctAttempts || []) {
          A.attempts.distinctAttempts++
          if (a.passed === false && a.suggestion) A.attempts.failedDistinctWithHint++
        }
        A.attempts.errorAttempts += t.errorAttempts || 0
        if (t.supportReveals?.length) {
          A.support.studentsTasksWithReveal++
          for (const sr of t.supportReveals) {
            A.support.reveals++
            inc(A.support.revealsBySource, sr.source)
            if (sr.stageIndex === 'teacherLive') A.support.teacherLiveCodeReveals++
          }
        }
        if (t.pastes) (A.pastes.studentTasks++, (A.pastes.count += t.pastes.count || 0))
        if (t.sideQuests?.length) {
          A.sideQuests.studentTasks++
          for (const q of t.sideQuests) (A.sideQuests.opens++, q.done && A.sideQuests.done++)
        }
        A.tutorTileHighlights += (t.tutorTileHighlights || []).length
        A.tileMisses += (t.tileMisses || []).length
        if (t.carryFallback) A.carry.carryFallbacks++
        if (t.crossLessonCarry) inc(A.carry.crossLessonCarry, t.crossLessonCarry.outcome)
        if (t.typing) A.newer.typingStudentTasks++
        if (t.slowMoUsed) A.newer.slowMoStudentTasks++
        if (t.scrubs) A.newer.scrubStudentTasks++
        if (t.inspector) A.newer.inspectorStudentTasks++
        if (t.predictions) A.newer.predictionStudentTasks++
        if (t.exampleOpens?.length) A.newer.exampleOpenStudentTasks++
        if (t.course) A.newer.courseStudentTasks++
        if (t.linesUsed != null) A.newer.puzzleStudentTasks++
        if (t.typingHistory) A.newer.typingHistoryStudentTasks++
        if (t.lastDraft) A.newer.lastDraftStudentTasks++
        if (t.itemProgress) A.newer.itemProgressStudentTasks++
      }
    }
  }
}

// finalise reports
for (const k of Object.keys(A.lessonsTaughtPerCourse))
  A.lessonsTaughtPerCourse[k] = A.lessonsTaughtPerCourse[k].size
A.totalReports = Object.values(A.reportsPerCourse).reduce((a, b) => a + b, 0)
A.totalStudentSlots = Object.values(A.studentSlotsPerCourse).reduce((a, b) => a + b, 0)
A.medianClassSize = median(A.classSizes)
A.medianClassSizeByCourse = Object.fromEntries(
  Object.entries(A.classSizesByCourse).map(([k, v]) => [k, median(v)])
)
A.medianSessionMinutes = A.sessionMinutes.length ? Math.round(median(A.sessionMinutes)) : null
if (A.likelyRealSessions) {
  A.likelyRealSessions.medianClassSize = median(A.likelyRealSessions.sizes)
  A.likelyRealSessions.total = A.likelyRealSessions.sizes.length
  A.likelyRealSessions.totalSlots = A.likelyRealSessions.sizes.reduce((a, b) => a + b, 0)
  delete A.likelyRealSessions.sizes
}
delete A.classSizes
delete A.classSizesByCourse
delete A.sessionMinutes
A.teacherSandbox.totalMinutes = Math.round(A.teacherSandbox.totalMinutes)
A.personalSandbox.minutes = Math.round(A.personalSandbox.minutes)
const top = (o, n = 10) =>
  Object.fromEntries(
    Object.entries(o)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
  )
A.badges.topAwarded = top(A.badges.awardedById)
A.badges.topSuggested = top(A.badges.suggestedById)
delete A.badges.awardedById
delete A.badges.suggestedById
A.shortcuts.byId = top(A.shortcuts.byId, 20)
A.keyPresence = keyPresence

// ---------- other Firestore collections (counts only) ----------
const other = {}
async function countSafe(label, fn) {
  try {
    other[label] = await fn()
  } catch (e) {
    other[label] = `error: ${e.code ?? ''} ${String(e.message).slice(0, 80)}`
  }
}
const countAgg = async (q) => (await q.count().get()).data().count
const inScopeIds = new Set(inScope.map((l) => l.id))

await countSafe('lessonFeedback (lessons/*/feedback)', async () => {
  const snap = await db.collectionGroup('feedback').get()
  const res = {
    total: snap.size,
    sinceWindow: 0,
    sinceInScope: 0,
    sinceScope: {},
    sinceArchived: 0,
    sinceByCourse: {},
  }
  for (const d of snap.docs) {
    const f = d.data()
    const at = toMs(f.submittedAt)
    if (at == null || at < SINCE_MS) continue
    res.sinceWindow++
    const lid = f.lessonId ?? d.ref.parent.parent?.id
    inc(res.sinceScope, f.taskId != null ? 'task' : 'lesson')
    if (f.archived) res.sinceArchived++
    if (inScopeIds.has(lid)) {
      res.sinceInScope++
      inc(res.sinceByCourse, inScope.find((l) => l.id === lid).course)
    }
  }
  return res
})
await countSafe('platformFeedback', async () => {
  const snap = await db.collection('platformFeedback').get()
  const res = { total: snap.size, sinceWindow: 0, sinceArchived: 0, sinceWithLesson: 0 }
  for (const d of snap.docs) {
    const f = d.data()
    const at = toMs(f.submittedAt)
    if (at == null || at < SINCE_MS) continue
    res.sinceWindow++
    if (f.archived) res.sinceArchived++
    if (f.lessonId) res.sinceWithLesson++
  }
  return res
})
await countSafe('badgeCatalogue (admin manual badges)', () =>
  countAgg(db.collection('badgeCatalogue'))
)
await countSafe('classes', () => countAgg(db.collection('classes')))
await countSafe('classes/*/roster', () => countAgg(db.collectionGroup('roster')))
await countSafe('classes/*/roster/*/work', () => countAgg(db.collectionGroup('work')))
await countSafe('classes/*/roster/*/typing', () => countAgg(db.collectionGroup('typing')))
await countSafe('sharedWork (share links)', () => countAgg(db.collection('sharedWork')))
await countSafe('topicLibrary', () => countAgg(db.collection('topicLibrary')))
await countSafe('users (by role)', async () => {
  const snap = await db.collection('users').get()
  const byRole = {}
  for (const d of snap.docs) inc(byRole, d.data().role)
  return { total: snap.size, byRole }
})
await countSafe('sessionReports (all lessons, all time)', () =>
  countAgg(db.collectionGroup('sessionReports'))
)

const output = { ...A, otherCollections: other }
const text = JSON.stringify(output, null, 2)
if (JSON_OUT) writeFileSync(JSON_OUT, text)
console.log(text)
process.exit(0)
