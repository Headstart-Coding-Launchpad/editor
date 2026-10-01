// Live class polls: the teacher asks the class a single-choice question from the top bar
// (useSession.launchPoll), students pick one option while it is open (answerPoll, changeable
// until it closes) and the teacher sees a live tally. Every poll goes into the session report.
//
// RTDB shape (docs/agents/runtime-model.md):
//   sessions/{lessonId}/polls/{pollId}: { question, options: [text…], status: 'open'|'closed',
//                                        showResults, createdAt, closedAt }
//   sessions/{lessonId}/activePollId: the poll on students' screens (open, or closed with
//                                     results), null when none
//   sessions/{lessonId}/students/{id}/pollResponses/{pollId}: { choice: <option index>,
//                                                             answeredAt }
//
// Pure and Node-safe: used by useSession, the teacher and student UI and lessonReport.js.

export const POLL_MIN_OPTIONS = 2
export const POLL_MAX_OPTIONS = 6
export const POLL_QUESTION_MAX_LENGTH = 200
export const POLL_OPTION_MAX_LENGTH = 100
export const POLL_STATUSES = Object.freeze(['open', 'closed'])

// RTDB returns a stored array as an array, or as an index-keyed object when it is sparse.
export function pollOptionList(poll) {
  const raw = poll?.options
  if (Array.isArray(raw)) return raw.map((text) => String(text ?? ''))
  if (raw && typeof raw === 'object') {
    return Object.keys(raw)
      .filter((key) => /^\d+$/.test(key))
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => String(raw[key] ?? ''))
  }
  return []
}

/**
 * Checks and tidies a teacher's poll draft. Blank options are dropped; the question and every
 * option are trimmed. Returns `{ poll: { question, options } }` or `{ error }` (a sentence for
 * the form).
 */
export function normalizePollDraft({ question, options } = {}) {
  const q = String(question ?? '').trim()
  const opts = (Array.isArray(options) ? options : [])
    .map((option) => String(option ?? '').trim())
    .filter(Boolean)
  if (!q) return { error: 'Type a question.' }
  if (q.length > POLL_QUESTION_MAX_LENGTH)
    return { error: `Keep the question under ${POLL_QUESTION_MAX_LENGTH} characters.` }
  if (opts.length < POLL_MIN_OPTIONS) return { error: `Add at least ${POLL_MIN_OPTIONS} options.` }
  if (opts.length > POLL_MAX_OPTIONS) return { error: `Use at most ${POLL_MAX_OPTIONS} options.` }
  if (opts.some((option) => option.length > POLL_OPTION_MAX_LENGTH))
    return { error: `Keep each option under ${POLL_OPTION_MAX_LENGTH} characters.` }
  if (new Set(opts.map((option) => option.toLowerCase())).size !== opts.length)
    return { error: 'Each option must be different.' }
  return { poll: { question: q, options: opts } }
}

// The poll on students' screens, with its id, or null.
export function getActivePoll(session) {
  const pollId = session?.activePollId
  if (!pollId) return null
  const poll = session?.polls?.[pollId]
  if (!poll) return null
  return { ...poll, pollId, options: pollOptionList(poll) }
}

// A valid option index for this poll, or null.
export function pollChoiceIndex(poll, choice) {
  const index = Number(choice)
  return Number.isInteger(index) && index >= 0 && index < pollOptionList(poll).length ? index : null
}

// A student's current answer to a poll (an option index), or null.
export function getStudentPollChoice(session, anonymousId, pollId) {
  if (!anonymousId || !pollId) return null
  const response = session?.students?.[anonymousId]?.pollResponses?.[pollId]
  return pollChoiceIndex(session?.polls?.[pollId], response?.choice)
}

/**
 * The live tally for one poll over the students in the session:
 * `{ total, respondedCount, options: [{ index, text, count, voters: [student] }],
 *    notResponded: [student] }`, each student `{ anonymousId, name }`.
 */
export function tallyPoll(session, pollId) {
  const poll = session?.polls?.[pollId]
  const optionTexts = pollOptionList(poll)
  const options = optionTexts.map((text, index) => ({ index, text, count: 0, voters: [] }))
  const notResponded = []
  const students = Object.entries(session?.students ?? {})
  for (const [anonymousId, node] of students) {
    const student = { anonymousId, name: node?.displayName || 'Student' }
    const choice = pollChoiceIndex(poll, node?.pollResponses?.[pollId]?.choice)
    if (choice === null) {
      notResponded.push(student)
      continue
    }
    options[choice].count += 1
    options[choice].voters.push(student)
  }
  const byName = (a, b) => a.name.localeCompare(b.name)
  for (const option of options) option.voters.sort(byName)
  notResponded.sort(byName)
  return {
    total: students.length,
    respondedCount: students.length - notResponded.length,
    options,
    notResponded,
  }
}

// Each option's share of the votes as a whole percentage (0 when nobody has voted).
export function pollPercent(count, respondedCount) {
  return respondedCount > 0 ? Math.round((count / respondedCount) * 100) : 0
}

function finiteOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

/**
 * The session report's top-level `polls` list (docs/authoring/session-reports.md), oldest
 * first. `labelFor(anonymousId)` gives the report's anonymous "Student N" label. A student who
 * first joined after a poll closed is not counted as not responding to it.
 */
export function buildPollsReport(session, labelFor) {
  const polls = session?.polls
  if (!polls || typeof polls !== 'object') return []
  const students = Object.entries(session?.students ?? {})
  return Object.entries(polls)
    .filter(([, poll]) => poll && typeof poll === 'object')
    .map(([pollId, poll]) => {
      const optionTexts = pollOptionList(poll)
      const counts = optionTexts.map(() => 0)
      const responses = []
      const notResponded = []
      const closedAt = finiteOrNull(poll.closedAt)
      const cutoff = closedAt ?? finiteOrNull(session?.endedAt)
      for (const [anonymousId, node] of students) {
        const response = node?.pollResponses?.[pollId]
        const choice = pollChoiceIndex(poll, response?.choice)
        if (choice === null) {
          const joinedAt = finiteOrNull(node?.firstJoinedAt)
          if (cutoff == null || joinedAt == null || joinedAt <= cutoff) {
            notResponded.push(labelFor(anonymousId))
          }
          continue
        }
        counts[choice] += 1
        responses.push({
          studentLabel: labelFor(anonymousId),
          choice,
          choiceText: optionTexts[choice],
          answeredAt: finiteOrNull(response?.answeredAt),
        })
      }
      return {
        pollId,
        question: String(poll.question ?? ''),
        options: optionTexts.map((text, index) => ({ index, text, count: counts[index] })),
        status: poll.status === 'open' ? 'open' : 'closed',
        showResults: poll.showResults === true,
        createdAt: finiteOrNull(poll.createdAt),
        closedAt,
        respondedCount: responses.length,
        responses: responses.sort((a, b) =>
          a.studentLabel.localeCompare(b.studentLabel, undefined, { numeric: true })
        ),
        notResponded: notResponded.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      }
    })
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
}
