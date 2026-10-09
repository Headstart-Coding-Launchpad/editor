// Badge rule helpers (docs/architecture/live-badges-plan.md, "The v1 badge set"). A badge
// definition's `rule` is one of these. Rules read timelines (./timeline.js), never Firebase or
// React, and are deterministic: the same timelines, lesson and decisions always give the same
// suggestions. Pure and Node-safe.
//
// A rule is `{ kind, hintable, evaluate(ctx) }`:
// - `hintable`: a task's `badgeHints.suggest` can make it one of the rule's trigger tasks;
// - `evaluate({ badgeId, timelines, index, decisions, options })` returns candidates
//   `{ studentId, taskId, context, at, values }`, at most one per student, where `values` are
//   the plain values the badge's `reasonText` reads (captured now, so a task later removed by
//   Edit Lesson can't break the stored reason). `index` is buildBadgeLessonIndex(lesson),
//   `options` the resolved badge options plus `currentTaskId` / `sessionEnded`.
// The evaluator (./evaluate.js) removes students who already have a decision on the badge.
import { taskAllowsBadge, taskTriggersBadge } from './lessonIndex.js'
import { KEYBOARD_WIZARD_SHORTCUT_IDS, getKeyboardWizardShortcut } from './shortcuts.js'

const sameId = (a, b) => a != null && b != null && String(a) === String(b)
const timeOrInfinity = (at) => (at == null || !Number.isFinite(at) ? Infinity : at)
// Ascending order that copes with Infinity on both sides.
const compareNumbers = (x, y) => (x === y ? 0 : x < y ? -1 : 1)
const compareAt = (a, b) => compareNumbers(timeOrInfinity(a.at), timeOrInfinity(b.at))

// Stable sort by time; untimed events keep their order after the timed ones.
function sortByTime(events) {
  return events
    .map((event, i) => ({ event, i }))
    .sort((a, b) => compareAt(a.event, b.event) || a.i - b.i)
    .map(({ event }) => event)
}

/**
 * Whether a guard event at `eventAt` happened at or before a pass at `passAt`. A missing time on
 * either side counts as "before": the guards are anti-gaming, so the unsure case is not a pass.
 */
export function atOrBefore(eventAt, passAt) {
  if (eventAt == null || passAt == null) return true
  return eventAt <= passAt
}

/** One student's events of `type` (optionally on `taskId`), in time order. */
export function eventsOf(timeline, type, taskId) {
  const list = (Array.isArray(timeline) ? timeline : []).filter(
    (event) => event?.type === type && (taskId === undefined || sameId(event.taskId, taskId))
  )
  return sortByTime(list)
}

/** A student's attempts at a task, in time order. */
export function getTaskAttempts(timeline, taskId) {
  return eventsOf(timeline, 'attempt', taskId).filter((event) => event.context !== 'sandbox')
}

/** The student's first attempt at a task: the one marked `firstTry`, else the earliest. */
export function getFirstAttempt(timeline, taskId) {
  const attempts = getTaskAttempts(timeline, taskId)
  return attempts.find((attempt) => attempt.firstTry) ?? attempts[0] ?? null
}

/**
 * Why a passing attempt is not a real pass, or null when it is real
 * (docs/architecture/live-badges-plan.md, "Central anti-gaming guards"):
 * 'not_passed', 'assisted', 'override', 'complete_shown', 'complete_revealed' or 'paste'.
 */
export function getPassGuard(attempt, timeline) {
  if (!attempt?.passed) return 'not_passed'
  if (attempt.assisted) return 'assisted'
  const { taskId, at } = attempt
  if (eventsOf(timeline, 'override', taskId).length > 0) return 'override'
  if (eventsOf(timeline, 'complete_shown', taskId).some((event) => atOrBefore(event.at, at))) {
    return 'complete_shown'
  }
  if (
    eventsOf(timeline, 'reveal', taskId).some((event) => event.complete && atOrBefore(event.at, at))
  ) {
    return 'complete_revealed'
  }
  if (eventsOf(timeline, 'paste', taskId).some((event) => atOrBefore(event.firstAt, at))) {
    return 'paste'
  }
  return null
}

/** Whether a passing attempt is a real pass: none of the central guards hold. */
export function isRealPass(attempt, timeline) {
  return getPassGuard(attempt, timeline) === null
}

/**
 * The student's real pass on a task, or null. Only the first passing attempt counts: once a
 * pass isn't real (assisted, complete code shown, ...), a later pass on the same task isn't
 * either.
 */
export function getRealPass(timeline, taskId) {
  const pass = getTaskAttempts(timeline, taskId).find((attempt) => attempt.passed) ?? null
  return pass && isRealPass(pass, timeline) ? pass : null
}

/** The student's first attempt at a task when it was a real pass (right first time), or null. */
export function getFirstTryRealPass(timeline, taskId) {
  const first = getFirstAttempt(timeline, taskId)
  return first && isRealPass(first, timeline) ? first : null
}

function candidate(studentId, info, { at = null, context = 'task', values = {} } = {}) {
  return {
    studentId,
    taskId: info ? info.id : null,
    context,
    at,
    values: { ...(info ? { taskTitle: info.title } : {}), ...values },
  }
}

// The earliest of several candidates: by time, then lesson order.
function earliest(candidates) {
  return (
    [...candidates].sort(
      (a, b) => compareAt(a, b) || compareNumbers(a.order ?? Infinity, b.order ?? Infinity)
    )[0] ?? null
  )
}

const asList = (value) => (Array.isArray(value) ? value : [value])
const entriesOf = (timelines) => Object.entries(timelines ?? {})

/**
 * First in class (docs/architecture/live-badges-plan.md, "First-in-class: the exact
 * computation"). A pure function of passes, so a later award or dismissal never moves an
 * earlier suggestion:
 * 1. order the tasks by their earliest qualifying pass (then lesson order);
 * 2. each task's winner is its earliest qualifying student who wasn't already picked for this
 *    badge in this computation and had no decision on it dated before the task's earliest pass.
 * Winners who are already decided are removed afterwards (by the evaluator), so a dismissal
 * uses up its task.
 *
 * `tasks`: [{ info, passes: [{ studentId, at }] }]; `decisions`: { [studentId]: { [badgeId]:
 * { decidedAt } } }. Returns winners `{ studentId, info, at }` in task order.
 */
export function computeFirstInClass({ tasks, badgeId, decisions }) {
  const ordered = tasks
    .map(({ info, passes }) => ({
      info,
      passes: [...passes].sort(
        (a, b) => compareAt(a, b) || String(a.studentId).localeCompare(String(b.studentId))
      ),
    }))
    .filter(({ passes }) => passes.length > 0)
    .sort((a, b) => compareAt(a.passes[0], b.passes[0]) || a.info.order - b.info.order)

  const picked = new Set()
  const winners = []
  for (const { info, passes } of ordered) {
    const earliestAt = passes[0].at
    const winner = passes.find(({ studentId }) => {
      if (picked.has(studentId)) return false
      const decidedAt = decisions?.[studentId]?.[badgeId]?.decidedAt
      // A decision with no time can't be ordered; treating it as later keeps the result stable.
      const decidedBefore =
        decidedAt != null && earliestAt != null && Number(decidedAt) < earliestAt
      return !decidedBefore
    })
    if (!winner) continue
    picked.add(winner.studentId)
    winners.push({ studentId: winner.studentId, info, at: winner.at })
  }
  return winners
}

/**
 * 🐛 / 📋 / 🔍 / 🧩: the first student in class to make a real pass on a task with one of
 * `patterns`, or (`formats`) whose Builder task format is one of them ('code_arrange').
 * `firstTryOnly`: only students whose first attempt at the task was that real pass qualify.
 */
export function firstInClassOnPattern(patterns, { firstTryOnly = false, formats = [] } = {}) {
  const patternList = asList(patterns)
  const formatList = asList(formats)
  return Object.freeze({
    kind: 'firstInClassOnPattern',
    patterns: Object.freeze(patternList),
    formats: Object.freeze(formatList),
    firstTryOnly,
    hintable: true,
    evaluate({ badgeId, timelines, index, decisions }) {
      const tasks = index.tasks
        .filter((info) => taskTriggersBadge(info, badgeId, patternList, formatList))
        .map((info) => ({
          info,
          passes: entriesOf(timelines).flatMap(([studentId, timeline]) => {
            const pass = firstTryOnly
              ? getFirstTryRealPass(timeline, info.id)
              : getRealPass(timeline, info.id)
            return pass ? [{ studentId, at: pass.at }] : []
          }),
        }))
      return computeFirstInClass({ tasks, badgeId, decisions }).map(({ studentId, info, at }) =>
        candidate(studentId, info, { at })
      )
    },
  })
}

/**
 * 🔓: a real pass on a task with one of `patterns`, per student (the earliest).
 * `noSupportReveal`: no support stage (of any kind) was revealed on the task before the pass.
 */
export function realPassOnPattern(patterns, { noSupportReveal = false } = {}) {
  const patternList = asList(patterns)
  return Object.freeze({
    kind: 'realPassOnPattern',
    patterns: Object.freeze(patternList),
    noSupportReveal,
    hintable: true,
    evaluate({ badgeId, timelines, index }) {
      const tasks = index.tasks.filter((info) => taskTriggersBadge(info, badgeId, patternList))
      return entriesOf(timelines).flatMap(([studentId, timeline]) => {
        const found = tasks.flatMap((info) => {
          const pass = getRealPass(timeline, info.id)
          if (!pass) return []
          if (
            noSupportReveal &&
            eventsOf(timeline, 'reveal', info.id).some((event) => atOrBefore(event.at, pass.at))
          ) {
            return []
          }
          return [{ info, at: pass.at, order: info.order }]
        })
        const first = earliest(found)
        return first ? [candidate(studentId, first.info, { at: first.at })] : []
      })
    },
  })
}

const errorName = (error) => (typeof error === 'string' && error ? error : null)

/**
 * 🔧: fixed a real console error.
 * - Task: an attempt with `error`, then a later real pass with a different submissionHash, on a
 *   task whose pattern isn't in `excludePatterns`.
 * - Sandbox: a sandbox_run with `error`, then a later error-free run with different code, in the
 *   same sandbox.
 * The earliest fix wins. Values: `errorName` (or null), `where` ('task' | 'sandbox' | 'personal').
 */
export function errorThenPass({ excludePatterns = [] } = {}) {
  return Object.freeze({
    kind: 'errorThenPass',
    excludePatterns: Object.freeze([...excludePatterns]),
    hintable: false,
    evaluate({ badgeId, timelines, index }) {
      const tasks = index.tasks.filter(
        (info) => taskAllowsBadge(info, badgeId) && !excludePatterns.includes(info.pattern)
      )
      return entriesOf(timelines).flatMap(([studentId, timeline]) => {
        const fixes = []
        for (const info of tasks) {
          const pass = getRealPass(timeline, info.id)
          if (!pass) continue
          const errorAttempt = getTaskAttempts(timeline, info.id)
            .filter(
              (attempt) =>
                attempt.error &&
                !attempt.passed &&
                attempt !== pass &&
                atOrBefore(attempt.at, pass.at) &&
                attempt.submissionHash !== pass.submissionHash
            )
            .at(-1)
          if (!errorAttempt) continue
          fixes.push({
            info,
            at: pass.at,
            order: info.order,
            context: 'task',
            errorName: errorName(errorAttempt.error),
          })
        }
        for (const context of ['sandbox', 'personal']) {
          const runs = eventsOf(timeline, 'sandbox_run').filter((run) => run.context === context)
          runs.forEach((run, i) => {
            if (run.error) return
            const fixed = runs
              .slice(0, i)
              .filter((earlier) => earlier.error && earlier.submissionHash !== run.submissionHash)
              .at(-1)
            if (fixed) {
              fixes.push({ info: null, at: run.at, context, errorName: errorName(fixed.error) })
            }
          })
        }
        const first = earliest(fixes)
        if (!first) return []
        return [
          candidate(studentId, first.info, {
            at: first.at,
            context: first.context,
            values: { errorName: first.errorName, where: first.context },
          }),
        ]
      })
    },
  })
}

/**
 * 🔨: on a code or Code Arrange task, at least `options[minFailsOption]` unique failed
 * submissionHash values, then a real pass. A→B→A is 2 unique fails; attempts with no hash
 * can't be told apart and don't count. Values: `tries` (the unique fails).
 */
export function uniqueFailsThenPass({ minFailsOption = 'persistenceMinFails' } = {}) {
  return Object.freeze({
    kind: 'uniqueFailsThenPass',
    minFailsOption,
    hintable: false,
    evaluate({ badgeId, timelines, index, options }) {
      const minFails = options[minFailsOption]
      const tasks = index.tasks.filter((info) => info.isCode && taskAllowsBadge(info, badgeId))
      return entriesOf(timelines).flatMap(([studentId, timeline]) => {
        const found = tasks.flatMap((info) => {
          const pass = getRealPass(timeline, info.id)
          if (!pass) return []
          const failed = new Set(
            getTaskAttempts(timeline, info.id)
              .filter(
                (attempt) =>
                  !attempt.passed &&
                  attempt.submissionHash != null &&
                  atOrBefore(attempt.at, pass.at)
              )
              .map((attempt) => attempt.submissionHash)
          )
          return failed.size >= minFails
            ? [{ info, at: pass.at, order: info.order, tries: failed.size }]
            : []
        })
        const first = earliest(found)
        return first
          ? [candidate(studentId, first.info, { at: first.at, values: { tries: first.tries } })]
          : []
      })
    },
  })
}

/**
 * 📚 / ⌨️: the student's earliest `eventType` event that `filter` accepts, in a task or a
 * sandbox. Events on a task that isn't in the lesson, or whose badgeHints suppress the badge,
 * don't count. `values(event)` adds the reason's values.
 */
export function anySignal(eventType, { filter = () => true, values = () => ({}) } = {}) {
  return Object.freeze({
    kind: 'anySignal',
    eventType,
    hintable: false,
    evaluate({ badgeId, timelines, index }) {
      return entriesOf(timelines).flatMap(([studentId, timeline]) => {
        const event = eventsOf(timeline, eventType).find((e) => {
          if (!filter(e)) return false
          const info = index.get(e.taskId)
          if (info) return taskAllowsBadge(info, badgeId)
          // A task event whose task has gone (Edit Lesson) doesn't count.
          return e.context !== 'task' || e.taskId == null
        })
        if (!event) return []
        return [
          candidate(studentId, index.get(event.taskId), {
            at: event.at,
            context: event.context ?? 'task',
            values: values(event),
          }),
        ]
      })
    },
  })
}

/** Keyboard Wizard's filter and values: a shortcut from src/badges/shortcuts.js. */
export const keyboardWizardSignal = () =>
  anySignal('shortcut', {
    filter: (event) => KEYBOARD_WIZARD_SHORTCUT_IDS.includes(event.shortcutId),
    values: (event) => ({
      shortcutLabel: getKeyboardWizardShortcut(event.shortcutId)?.label ?? event.shortcutId,
    }),
  })

/**
 * 🚀: on a code task (any module), the first real edit within `options[secondsOption]` seconds of
 * the task opening, timed on the student's own device. Values: `seconds` (rounded).
 */
export function firstEditWithin({ secondsOption = 'readyToCodeSeconds' } = {}) {
  return Object.freeze({
    kind: 'firstEditWithin',
    secondsOption,
    hintable: false,
    evaluate({ badgeId, timelines, index, options }) {
      const limitMs = options[secondsOption] * 1000
      return entriesOf(timelines).flatMap(([studentId, timeline]) => {
        const found = eventsOf(timeline, 'first_edit').flatMap((event) => {
          const info = index.get(event.taskId)
          if (!info?.isCode || !taskAllowsBadge(info, badgeId)) return []
          const elapsed = Number(event.elapsedMs)
          if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > limitMs) return []
          return [{ info, at: event.at, order: info.order, elapsed }]
        })
        const first = earliest(found)
        return first
          ? [
              candidate(studentId, first.info, {
                at: first.at,
                values: { seconds: Math.round(first.elapsed / 1000) },
              }),
            ]
          : []
      })
    },
  })
}

/**
 * 🐦: first joined the session at least `options[minutesOption]` minutes before the tutor pressed
 * Start (an `early_join` event). Not tied to a task. Values: `minutes` (rounded down).
 */
export function joinedEarly({ minutesOption = 'earlyBirdMinutes' } = {}) {
  return Object.freeze({
    kind: 'joinedEarly',
    minutesOption,
    hintable: false,
    evaluate({ timelines, options }) {
      const leadNeededMs = options[minutesOption] * 60 * 1000
      return entriesOf(timelines).flatMap(([studentId, timeline]) => {
        const event = eventsOf(timeline, 'early_join').find((e) => {
          const lead = Number(e.leadMs)
          return Number.isFinite(lead) && lead >= leadNeededMs
        })
        if (!event) return []
        return [
          candidate(studentId, null, {
            at: event.at,
            values: { minutes: Math.floor(Number(event.leadMs) / 60000) },
          }),
        ]
      })
    },
  })
}

/**
 * 🗺️: at least `options[minDoneOption]` side-quests marked Done in the session
 * (`side_quest_done` events, src/shared/sideQuests.js), across any tasks. Done is self-reported,
 * so a badge using this is never auto-awardable. A side-quest on a task that has gone, or whose
 * task suppresses the badge, doesn't count. The suggestion's task is the one the qualifying
 * side-quest was on. Values: `count` (side-quests done when it qualified).
 */
export function sideQuestsDone({ minDoneOption = 'sideQuesterMinDone' } = {}) {
  return Object.freeze({
    kind: 'sideQuestsDone',
    minDoneOption,
    hintable: false,
    evaluate({ badgeId, timelines, index, options }) {
      const needed = options[minDoneOption]
      return entriesOf(timelines).flatMap(([studentId, timeline]) => {
        const seen = new Set()
        const done = eventsOf(timeline, 'side_quest_done').filter((event) => {
          const info = index.get(event.taskId)
          if (!info || !taskAllowsBadge(info, badgeId)) return false
          // One per side-quest, however often it was marked.
          const key = `${String(event.taskId)}#${event.index}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        if (done.length < needed) return []
        const qualifying = done[needed - 1]
        return [
          candidate(studentId, index.get(qualifying.taskId), {
            at: qualifying.at,
            values: { count: needed },
          }),
        ]
      })
    },
  })
}

/**
 * 🎯: in a quiz group (a lesson group with at least `quizMasterMinQuizzes` graded quizzes), at
 * least `quizMasterThreshold` of them right first time. A group is evaluated once the student
 * has attempted all of its graded quizzes, or the class has moved past it (`options.currentTaskId`
 * is after the group, or `options.sessionEnded`); unattempted quizzes count as not right. The
 * first qualifying group in lesson order wins; the suggestion's taskId is its last graded quiz.
 * Values: `groupTitle`, `right`, `total`.
 */
export function quizGroupFirstTry({
  thresholdOption = 'quizMasterThreshold',
  minQuizzesOption = 'quizMasterMinQuizzes',
} = {}) {
  return Object.freeze({
    kind: 'quizGroupFirstTry',
    thresholdOption,
    minQuizzesOption,
    hintable: false,
    evaluate({ badgeId, timelines, index, options }) {
      const currentOrder = index.get(options.currentTaskId)?.order ?? -1
      const groups = index.groups
        .map((group) => ({
          group,
          quizzes: group.taskIds
            .map((id) => index.get(id))
            .filter((info) => info?.isGradedQuiz && taskAllowsBadge(info, badgeId)),
        }))
        .filter(({ quizzes }) => quizzes.length >= options[minQuizzesOption])

      return entriesOf(timelines).flatMap(([studentId, timeline]) => {
        for (const { group, quizzes } of groups) {
          const lastOrder = Math.max(...quizzes.map((info) => info.order))
          const attemptedAll = quizzes.every(
            (info) => getTaskAttempts(timeline, info.id).length > 0
          )
          const movedPast = !!options.sessionEnded || currentOrder > lastOrder
          if (!attemptedAll && !movedPast) continue
          const right = quizzes.filter((info) => getFirstTryRealPass(timeline, info.id)).length
          if (right / quizzes.length < options[thresholdOption]) continue
          const last = quizzes.find((info) => info.order === lastOrder)
          const lastAttempt = getTaskAttempts(timeline, last.id).at(-1)
          return [
            candidate(studentId, last, {
              at: lastAttempt?.at ?? null,
              values: { groupTitle: group.title, right, total: quizzes.length },
            }),
          ]
        }
        return []
      })
    },
  })
}
