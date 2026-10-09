// Badge timelines: the normalised, per-student event lists the badge rules read
// (docs/architecture/live-badges-plan.md, "Architecture"). Rules never read Firebase or React:
// a timeline builder (the live one reads the session snapshot) turns stored data into these
// events, and the same rules can later run on a solo timeline. Pure and Node-safe.
//
// A class's input to the rules is `timelines: { [studentId]: TimelineEvent[] }`. Events are
// usually in time order, but rules never rely on array order; they sort by `at`.
//
// Times (`at`, `firstAt`) are milliseconds. Guard comparisons treat a missing time as "before"
// (the conservative reading), so a builder should always fill them when it can. Task ids are
// compared as strings, so numeric lesson ids and RTDB string keys match.

/** Where an event happened: a lesson task, the teacher's session sandbox, or a personal sandbox. */
export const TIMELINE_CONTEXTS = Object.freeze(['task', 'sandbox', 'personal'])

export const TIMELINE_EVENT_TYPES = Object.freeze([
  'attempt',
  'sandbox_run',
  'topic_open',
  'reveal',
  'complete_shown',
  'paste',
  'override',
  'shortcut',
  'first_edit',
  'early_join',
  'autocomplete',
  'peer_help',
  'side_quest_done',
  'emoji_run',
])

/**
 * A checked run or quiz submission on a task (one `attemptLog` entry).
 * @typedef {object} AttemptEvent
 * @property {'attempt'} type
 * @property {'task'} context
 * @property {string|number} taskId
 * @property {boolean} passed
 * @property {boolean} [firstTry] true on the student's first attempt at the task. When no
 *   attempt of a task carries it, the earliest attempt is the first try.
 * @property {boolean|string} [error] a real console error: true, or the error's name
 *   ("NameError"), which the Code Fixer reason shows.
 * @property {boolean} [assisted] the teacher helped (attemptLog `teacherAssisted`).
 * @property {string|null} [submissionHash] a hash of the submitted code, so rules can tell
 *   different code apart (attemptLog only de-duplicates against the previous entry).
 * @property {number|null} at `passedAt` for a pass, otherwise `loggedAt`.
 */

/**
 * A run in a sandbox (the teacher's session sandbox or the student's personal one).
 * @typedef {object} SandboxRunEvent
 * @property {'sandbox_run'} type
 * @property {'sandbox'|'personal'} context
 * @property {boolean|string} [error]
 * @property {string|null} [submissionHash]
 * @property {number|null} at
 */

/**
 * The student opened a Topic Library topic (or the tutor sent one to them).
 * @typedef {object} TopicOpenEvent
 * @property {'topic_open'} type
 * @property {'task'|'sandbox'|'personal'} context
 * @property {string} topicId
 * @property {string} [topicTitle] shown in the Resourceful Coder reason (falls back to topicId)
 * @property {string|number|null} [taskId]
 * @property {'student'|'teacher'} source
 * @property {number|null} at
 */

/**
 * A support or complete code stage was revealed on a task (`supportRevealLog`).
 * @typedef {object} RevealEvent
 * @property {'reveal'} type
 * @property {'task'} context
 * @property {string|number} taskId
 * @property {number} stage the stage index
 * @property {boolean} complete the revealed stage is the task's complete stage
 * @property {number|null} [at]
 */

/**
 * Complete code was shown, previewed or reset to on a task (`studentSignals.completeShown`).
 * @typedef {object} CompleteShownEvent
 * @property {'complete_shown'} type
 * @property {'task'} context
 * @property {string|number} taskId
 * @property {'show'|'preview'|'teacherReset'} [via]
 * @property {number|null} at
 */

/**
 * The first large paste on a task (`pasteLog.firstAt`).
 * @typedef {object} PasteEvent
 * @property {'paste'} type
 * @property {'task'} context
 * @property {string|number} taskId
 * @property {number|null} firstAt
 */

/**
 * The teacher passed the student or moved the class on without a pass (`overrideLog`).
 * An override voids every pass on that task, whenever it happened.
 * @typedef {object} OverrideEvent
 * @property {'override'} type
 * @property {'task'} context
 * @property {string|number} taskId
 * @property {number|null} [at]
 */

/**
 * The first use of a listed keyboard shortcut (src/badges/shortcuts.js).
 * @typedef {object} ShortcutEvent
 * @property {'shortcut'} type
 * @property {'task'|'sandbox'|'personal'} context
 * @property {string} shortcutId
 * @property {string|number|null} [taskId]
 * @property {number|null} at
 */

/**
 * The student's first real edit on a task, timed on their own device.
 * @typedef {object} FirstEditEvent
 * @property {'first_edit'} type
 * @property {'task'} context
 * @property {string|number} taskId
 * @property {number} elapsedMs from when the task first rendered for them (or they joined)
 * @property {number|null} [at]
 */

/**
 * The student first joined the session before the tutor pressed Start (`students.{id}.
 * firstJoinedAt` against the session's `startedAt`). Only built once the session has started.
 * The two times come from different devices' clocks.
 * @typedef {object} EarlyJoinEvent
 * @property {'early_join'} type
 * @property {'task'} context
 * @property {null} taskId the lesson as a whole, not a task
 * @property {number} leadMs how long before Start they joined
 * @property {number|null} at when they first joined
 */

/**
 * The first accepted code-editor autocomplete suggestion (`studentSignals.autocomplete`).
 * @typedef {object} AutocompleteEvent
 * @property {'autocomplete'} type
 * @property {'task'|'sandbox'|'personal'} context
 * @property {string|number|null} [taskId]
 * @property {number|null} at
 */

/**
 * The first Run of Python or HTML code with an emoji in a string, or in HTML text or an
 * attribute (`studentSignals.emojiRun`; src/shared/emojiInCode.js decides). Comments don't count.
 * @typedef {object} EmojiRunEvent
 * @property {'emoji_run'} type
 * @property {'task'|'sandbox'|'personal'} context
 * @property {string|number|null} [taskId]
 * @property {number|null} at
 */

/**
 * @typedef {AttemptEvent|SandboxRunEvent|TopicOpenEvent|RevealEvent|CompleteShownEvent|
 *   PasteEvent|OverrideEvent|ShortcutEvent|FirstEditEvent|EarlyJoinEvent|AutocompleteEvent|
 *   PeerHelpEvent|SideQuestDoneEvent|EmojiRunEvent}
 *   TimelineEvent
 */

const time = (value) => (value == null || value === '' ? null : Number(value))

/** @returns {AttemptEvent} */
export function attemptEvent({
  taskId,
  passed = false,
  firstTry = false,
  error = false,
  assisted = false,
  submissionHash = null,
  at = null,
}) {
  return {
    type: 'attempt',
    context: 'task',
    taskId,
    passed: !!passed,
    firstTry: !!firstTry,
    error: typeof error === 'string' && error ? error : !!error,
    assisted: !!assisted,
    submissionHash: submissionHash ?? null,
    at: time(at),
  }
}

/** @returns {SandboxRunEvent} */
export function sandboxRunEvent({
  context = 'sandbox',
  error = false,
  submissionHash = null,
  at = null,
}) {
  return {
    type: 'sandbox_run',
    context,
    error: typeof error === 'string' && error ? error : !!error,
    submissionHash: submissionHash ?? null,
    at: time(at),
  }
}

/** @returns {TopicOpenEvent} */
export function topicOpenEvent({
  context = 'task',
  topicId,
  topicTitle,
  taskId = null,
  source = 'student',
  at = null,
}) {
  return {
    type: 'topic_open',
    context,
    topicId,
    ...(topicTitle ? { topicTitle } : {}),
    taskId,
    source,
    at: time(at),
  }
}

/** @returns {RevealEvent} */
export function revealEvent({ taskId, stage = null, complete = false, at = null }) {
  return { type: 'reveal', context: 'task', taskId, stage, complete: !!complete, at: time(at) }
}

/** @returns {CompleteShownEvent} */
export function completeShownEvent({ taskId, via = 'show', at = null }) {
  return { type: 'complete_shown', context: 'task', taskId, via, at: time(at) }
}

/** @returns {PasteEvent} */
export function pasteEvent({ taskId, firstAt = null }) {
  return { type: 'paste', context: 'task', taskId, firstAt: time(firstAt) }
}

/** @returns {OverrideEvent} */
export function overrideEvent({ taskId, at = null }) {
  return { type: 'override', context: 'task', taskId, at: time(at) }
}

/** @returns {ShortcutEvent} */
export function shortcutEvent({ context = 'task', shortcutId, taskId = null, at = null }) {
  return { type: 'shortcut', context, shortcutId, taskId, at: time(at) }
}

/** @returns {FirstEditEvent} */
export function firstEditEvent({ taskId, elapsedMs, at = null }) {
  return { type: 'first_edit', context: 'task', taskId, elapsedMs: Number(elapsedMs), at: time(at) }
}

/** @returns {EarlyJoinEvent} */
export function earlyJoinEvent({ leadMs, at = null }) {
  return { type: 'early_join', context: 'task', taskId: null, leadMs: Number(leadMs), at: time(at) }
}

/**
 * A classmate found this student's peer help useful: the stuck student pressed 👍 Useful on an
 * item, or used a suggested change (`response` on `peerHelp/{lessonId}/{requestId}/inbox`, read
 * teacher-side; see src/shared/peerHelp.js). Never stored as a student signal.
 * @typedef {object} PeerHelpEvent
 * @property {'peer_help'} type
 * @property {'task'} context
 * @property {string|number|null} taskId the task the help was on
 * @property {'useful'|'accepted'} outcome
 * @property {number|null} at
 */

/** @returns {PeerHelpEvent} */
export function peerHelpEvent({ taskId = null, outcome = 'useful', at = null }) {
  return { type: 'peer_help', context: 'task', taskId, outcome, at: time(at) }
}

/**
 * The student marked a side-quest Done (`sideQuestLog/{id}/{taskId}/{index}`, see
 * src/shared/sideQuests.js). Self-reported, never checked: the badge that reads it is only ever
 * suggested.
 * @typedef {object} SideQuestDoneEvent
 * @property {'side_quest_done'} type
 * @property {'task'} context
 * @property {string|number} taskId the task the side-quest belongs to
 * @property {number} index the side-quest's index on that task (0-2)
 * @property {number|null} at `doneAt`
 */

/** @returns {SideQuestDoneEvent} */
export function sideQuestDoneEvent({ taskId, index = 0, at = null }) {
  return { type: 'side_quest_done', context: 'task', taskId, index: Number(index), at: time(at) }
}

/** @returns {AutocompleteEvent} */
export function autocompleteEvent({ context = 'task', taskId = null, at = null }) {
  return { type: 'autocomplete', context, taskId, at: time(at) }
}

/** @returns {EmojiRunEvent} */
export function emojiRunEvent({ context = 'task', taskId = null, at = null }) {
  return { type: 'emoji_run', context, taskId, at: time(at) }
}

/**
 * Only the students on the current roster: a removed student can't hold a first-in-class slot.
 * `roster` is an array of ids or the session's `students` object.
 */
export function filterTimelinesToRoster(timelines, roster) {
  const ids = new Set(
    (Array.isArray(roster) ? roster : Object.keys(roster ?? {})).map((id) => String(id))
  )
  return Object.fromEntries(
    Object.entries(timelines ?? {}).filter(([studentId]) => ids.has(String(studentId)))
  )
}
