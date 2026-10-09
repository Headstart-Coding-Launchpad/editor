// The live timeline builder: turns the teacher's `sessions/{lessonId}` snapshot into the
// per-student badge timelines the rules read (./timeline.js). The mapping from stored data to
// events is documented in docs/agents/runtime-model.md, "Badge data". Pure and Node-safe: the
// React side (src/app/hooks/useBadgeSuggestions.js) memoises it and runs the rules.
//
// Scope (docs/architecture/live-badges-plan.md, "Timeline scope"):
// - only students on the current roster (`session.students`), so a removed student (or a
//   presentation window, which removes itself as a student) can't hold a first-in-class slot;
// - only tasks still in the lesson the class is using: the session-edited lesson (Edit Lesson →
//   "Apply for this session") in its live form (`liveBadgeLesson`). Task events on a task that
//   has gone are dropped; sandbox events keep no task.
import { isAutoAttempt } from '../shared/autoCheck.js'
import { decodeFileKey } from '../shared/fileKeys.js'
import { filterTasksByMode, flattenTasks } from '../shared/taskUtils.js'
import { getStageRole } from '../shared/taskStages.js'
import {
  attemptEvent,
  autocompleteEvent,
  completeShownEvent,
  earlyJoinEvent,
  emojiRunEvent,
  firstEditEvent,
  overrideEvent,
  pasteEvent,
  peerHelpEvent,
  revealEvent,
  sandboxRunEvent,
  shortcutEvent,
  sideQuestDoneEvent,
  topicOpenEvent,
  TIMELINE_CONTEXTS,
} from './timeline.js'
import {
  contextForSandboxKind,
  hashSubmission,
  NO_TASK_KEY,
  SANDBOX_SIGNAL_KINDS,
  TOPIC_LIBRARY_OPEN_ID,
} from './signals.js'

const entries = (value) =>
  value && typeof value === 'object' ? Object.entries(value).filter(([, v]) => v != null) : []
const values = (value) => entries(value).map(([, v]) => v)
const timeOrInfinity = (at) => (at == null || !Number.isFinite(Number(at)) ? Infinity : Number(at))

/**
 * The lesson the badge engine reads in a live session: the tasks a live class can reach
 * (`filterTasksByMode(..., 'live')`, as TeacherView's task list). Pass the session-edited
 * lesson, so a task removed by Edit Lesson is gone here too.
 */
export function liveBadgeLesson(lesson) {
  if (!lesson) return lesson
  return { ...lesson, tasks: filterTasksByMode(lesson.tasks ?? [], 'live') }
}

/** The current roster's student ids (the keys of `session.students`), sorted. */
export function rosterIds(session) {
  return Object.keys(session?.students ?? {}).sort()
}

// Task ids in `studentSignals` are signalKey-encoded; `none` is "no task".
function signalTaskKey(key) {
  if (key == null || key === NO_TASK_KEY) return null
  return decodeFileKey(String(key))
}

function topicTitleFor(topicId, topicTitles) {
  if (topicId === TOPIC_LIBRARY_OPEN_ID) return null
  return topicTitles?.get(String(topicId).toLowerCase()) ?? null
}

/**
 * A lookup of the lesson's tasks by id (as a string), for building timelines.
 * @returns {Map<string, object>}
 */
export function buildTaskLookup(lesson) {
  return new Map(flattenTasks(lesson?.tasks ?? []).map((task) => [String(task.id), task]))
}

// One task's attemptLog entries → attempt events. The first try is the earliest entry: the
// stored `attemptNumber` restarts at 1 after a student reload (the de-dupe cache is per tab),
// so it can't be trusted on its own. Auto-check-on-leave records (src/shared/autoCheck.js) are
// not attempts: they never make an attempt, a first try, an error or a pass.
function attemptEventsFor(task, logEntries) {
  const ordered = entries(logEntries)
    .filter(([, entry]) => !isAutoAttempt(entry))
    .sort(
      ([keyA, a], [keyB, b]) =>
        timeOrInfinity(a.loggedAt) - timeOrInfinity(b.loggedAt) || (keyA < keyB ? -1 : 1)
    )
  return ordered.map(([, entry], i) =>
    attemptEvent({
      taskId: task.id,
      passed: !!entry.passed,
      firstTry: i === 0,
      error: entry.error ?? false,
      assisted: !!entry.teacherAssisted,
      submissionHash: hashSubmission(entry.submission),
      at: entry.passed ? (entry.passedAt ?? entry.loggedAt) : entry.loggedAt,
    })
  )
}

/**
 * One student's timeline from the session snapshot. Unsorted: rules sort by `at`.
 * @param {object} input
 * @param {object} input.session the `sessions/{lessonId}` value
 * @param {string} input.studentId
 * @param {Map<string, object>} input.tasks buildTaskLookup(liveBadgeLesson(lesson))
 * @param {Map<string, string>} [input.topicTitles] lower-cased topic id → title
 * @returns {import('./timeline.js').TimelineEvent[]}
 */
export function buildStudentTimeline({ session, studentId, tasks, topicTitles = null }) {
  const events = []
  const taskFor = (taskKey) => (taskKey == null ? null : (tasks.get(String(taskKey)) ?? null))

  for (const [taskKey, logEntries] of entries(session?.attemptLog?.[studentId])) {
    const task = taskFor(taskKey)
    if (task) events.push(...attemptEventsFor(task, logEntries))
  }

  for (const [taskKey, stages] of entries(session?.supportRevealLog?.[studentId])) {
    const task = taskFor(taskKey)
    if (!task) continue
    for (const [stageKey, reveal] of entries(stages)) {
      const stage = Number(reveal.stageIndex ?? stageKey)
      const stageDef = task.codeStages?.[stage]
      events.push(
        revealEvent({
          taskId: task.id,
          stage,
          complete: !!stageDef && getStageRole(stageDef) === 'complete',
          at: reveal.revealedAt,
        })
      )
    }
  }

  for (const [taskKey, override] of entries(session?.overrideLog?.[studentId])) {
    const task = taskFor(taskKey)
    if (task) events.push(overrideEvent({ taskId: task.id, at: override.overriddenAt }))
  }

  for (const [taskKey, paste] of entries(session?.students?.[studentId]?.pasteLog)) {
    const task = taskFor(taskKey)
    if (task) events.push(pasteEvent({ taskId: task.id, firstAt: paste.firstAt }))
  }

  // Side-quests the student marked Done (src/shared/sideQuests.js): self-reported, unchecked.
  for (const [taskKey, quests] of entries(session?.sideQuestLog?.[studentId])) {
    const task = taskFor(taskKey)
    if (!task) continue
    for (const [indexKey, quest] of entries(quests)) {
      if (quest?.done !== true) continue
      events.push(sideQuestDoneEvent({ taskId: task.id, index: indexKey, at: quest.doneAt }))
    }
  }

  const signals = session?.studentSignals?.[studentId] ?? {}

  for (const [taskKey, shown] of entries(signals.completeShown)) {
    const task = taskFor(signalTaskKey(taskKey))
    if (task) events.push(completeShownEvent({ taskId: task.id, via: shown.via, at: shown.at }))
  }

  for (const [taskKey, edit] of entries(signals.firstEdits)) {
    const task = taskFor(signalTaskKey(taskKey))
    if (task) {
      events.push(firstEditEvent({ taskId: task.id, elapsedMs: edit.elapsedMs, at: edit.at }))
    }
  }

  // Topic opens and shortcuts: a task context names its task (dropped when that task has gone,
  // kept with no task when there was none); a sandbox keeps no task.
  const signalTask = (context, taskKey) => {
    if (context !== 'task' || taskKey == null) return { keep: true, taskId: null }
    const task = taskFor(taskKey)
    return { keep: !!task, taskId: task?.id ?? null }
  }

  for (const [context, byTask] of entries(signals.topics)) {
    if (!TIMELINE_CONTEXTS.includes(context)) continue
    for (const [taskKey, byTopic] of entries(byTask)) {
      const { keep, taskId } = signalTask(context, signalTaskKey(taskKey))
      if (!keep) continue
      for (const [topicKey, open] of entries(byTopic)) {
        const topicId = decodeFileKey(topicKey)
        events.push(
          topicOpenEvent({
            context,
            topicId,
            topicTitle: topicTitleFor(topicId, topicTitles) ?? undefined,
            taskId,
            source: open.source === 'teacher' ? 'teacher' : 'student',
            at: open.openedAt,
          })
        )
      }
    }
  }

  for (const [shortcutId, used] of entries(signals.shortcuts)) {
    const context = TIMELINE_CONTEXTS.includes(used.context) ? used.context : 'task'
    const { keep, taskId } = signalTask(context, used.taskId ?? null)
    if (!keep) continue
    events.push(shortcutEvent({ context, shortcutId, taskId, at: used.firstUsedAt }))
  }

  if (signals.autocomplete) {
    const used = signals.autocomplete
    const context = TIMELINE_CONTEXTS.includes(used.context) ? used.context : 'task'
    const { keep, taskId } = signalTask(context, used.taskId ?? null)
    if (keep) events.push(autocompleteEvent({ context, taskId, at: used.firstUsedAt }))
  }

  // The first Run of code with an emoji in a string or HTML text (src/shared/emojiInCode.js).
  if (signals.emojiRun) {
    const ran = signals.emojiRun
    const context = TIMELINE_CONTEXTS.includes(ran.context) ? ran.context : 'task'
    const { keep, taskId } = signalTask(context, ran.taskId ?? null)
    if (keep) events.push(emojiRunEvent({ context, taskId, at: ran.firstRunAt }))
  }

  // Joined before the tutor pressed Start (only once the session has started).
  const startedAt = Number(session?.startedAt)
  const firstJoinedAt = Number(session?.students?.[studentId]?.firstJoinedAt)
  if (session?.startedAt != null && Number.isFinite(startedAt) && Number.isFinite(firstJoinedAt)) {
    if (firstJoinedAt > 0 && firstJoinedAt < startedAt) {
      events.push(earlyJoinEvent({ leadMs: startedAt - firstJoinedAt, at: firstJoinedAt }))
    }
  }

  for (const kind of SANDBOX_SIGNAL_KINDS) {
    const context = contextForSandboxKind(kind)
    for (const run of values(signals.sandbox?.[kind]?.runsLog)) {
      events.push(
        sandboxRunEvent({
          context,
          error: run.error ?? false,
          submissionHash: run.submissionHash ?? null,
          at: run.at,
        })
      )
    }
  }

  return events
}

/**
 * Peer help outcomes (src/shared/peerHelp.js) → `peer_help` events on each helper's timeline: an
 * item the stuck classmate marked 👍 Useful or whose change they used. `peerHelp` is the
 * teacher's read of `peerHelp/{lessonId}` (students can't read each other's), so this only ever
 * runs teacher-side. Help on a task that has gone is dropped.
 * @returns {{ [helperId: string]: import('./timeline.js').PeerHelpEvent[] }}
 */
export function buildPeerHelpEvents(peerHelp, tasks) {
  const byHelper = {}
  for (const request of values(peerHelp)) {
    const helperId = request?.helperId
    const taskId = request?.snapshot?.taskId
    if (!helperId || taskId == null || !tasks.has(String(taskId))) continue
    for (const item of values(request.inbox)) {
      if (item.response !== 'useful' && item.response !== 'accepted') continue
      ;(byHelper[helperId] ??= []).push(
        peerHelpEvent({ taskId, outcome: item.response, at: item.respondedAt ?? item.createdAt })
      )
    }
  }
  return byHelper
}

/** A lower-cased topic id → title lookup from the Topic Library's topics (optional). */
export function buildTopicTitles(topics) {
  if (!Array.isArray(topics) || topics.length === 0) return null
  return new Map(
    topics
      .filter((topic) => topic?.id && topic?.title)
      .map((topic) => [String(topic.id).toLowerCase(), String(topic.title)])
  )
}

/**
 * Every rostered student's timeline, from the session snapshot.
 * @param {object} input
 * @param {object} input.session the `sessions/{lessonId}` value
 * @param {object} input.lesson the session-edited lesson (Edit Lesson overrides applied);
 *   it is narrowed to its live tasks here
 * @param {object[]} [input.topics] the Topic Library's topics, for Resourceful Coder's reason
 * @returns {{ [studentId: string]: import('./timeline.js').TimelineEvent[] }}
 */
export function buildLiveTimelines({ session, lesson, topics = null, peerHelp = null }) {
  const tasks = buildTaskLookup(liveBadgeLesson(lesson))
  const topicTitles = buildTopicTitles(topics)
  const peerHelpEvents = buildPeerHelpEvents(peerHelp, tasks)
  return Object.fromEntries(
    rosterIds(session).map((studentId) => [
      studentId,
      [
        ...buildStudentTimeline({ session, studentId, tasks, topicTitles }),
        ...(peerHelpEvents[studentId] ?? []),
      ],
    ])
  )
}

// Code and free-text feedback never change a timeline except through their hash, and an
// attemptLog entry's submission never changes after it is written, so the key leaves them out.
const KEY_OMIT = new Set(['submission', 'suggestion'])
const keyReplacer = (key, value) => (KEY_OMIT.has(key) ? undefined : value)

/**
 * A cheap serialised key of everything one student's timeline is built from. `snap.val()`
 * rebuilds the whole session object on every write, so memoising by reference never hits; equal
 * keys mean an equal timeline.
 */
export function studentTimelineInputKey(session, studentId) {
  return JSON.stringify(
    [
      session?.attemptLog?.[studentId] ?? null,
      session?.supportRevealLog?.[studentId] ?? null,
      session?.overrideLog?.[studentId] ?? null,
      session?.students?.[studentId]?.pasteLog ?? null,
      session?.studentSignals?.[studentId] ?? null,
      session?.sideQuestLog?.[studentId] ?? null,
      session?.students?.[studentId]?.firstJoinedAt ?? null,
      session?.startedAt ?? null,
    ],
    keyReplacer
  )
}

// Only what buildPeerHelpEvents reads: helper, task and each item's response.
function peerHelpOutcomesKey(peerHelp) {
  return entries(peerHelp).map(([requestId, request]) => [
    requestId,
    request?.helperId ?? null,
    request?.snapshot?.taskId ?? null,
    entries(request?.inbox).map(([itemId, item]) => [itemId, item.response ?? null]),
  ])
}

/**
 * The key for a whole class evaluation: the roster, each student's timeline inputs, the badge
 * decisions, the current task and whether the session has ended.
 */
export function badgeEvaluationInputKey(session, peerHelp = null) {
  const students = rosterIds(session).map(
    (studentId) => `${studentId}=${studentTimelineInputKey(session, studentId)}`
  )
  return JSON.stringify([
    students,
    peerHelpOutcomesKey(peerHelp),
    session?.badges ?? null,
    session?.currentTaskId ?? null,
    session?.state === 'ended',
  ])
}
