// Peer help: a student who has finished a task helps a stuck classmate, with the teacher
// gating every step. Pure helpers only; Firebase reads and writes live in
// src/app/hooks/usePeerHelp.js and the safety model is enforced in database.rules.json.
// See docs/agents/classroom-behaviours.md "Peer Help".
//
// Data (paths relative to the database root; L = lessonId, R = requestId):
//   peerHelpRequests/L/{stuckId}      { requestId, taskId, at }   stuck student + teacher only
//   peerHelpHelping/L/{helperId}      requestId                    helper + teacher only
//   peerHelpPromises/L/{helperId}     at (the helper promise)      helper + teacher only
//   peerHelp/L/R/stuckId              read: teacher, that student
//   peerHelp/L/R/helperId             read: teacher, that helper (claimed once)
//   peerHelp/L/R/snapshot             the stuck student's work: teacher, stuck, helper
//   peerHelp/L/R/state                { endedAt, endedBy, snapshotRequestedAt }
//   peerHelp/L/R/inbox/{itemId}       what the stuck student sees: thumbs and preset hints
//                                     straight from the helper, edits and notes once approved
//   peerHelp/L/R/review/{itemId}      edits and notes awaiting the teacher, and blocked notes
//   sessions/L/peerHelpOffers/R       { taskId, lessonType, offeredAt, claimedAt?, endedAt? }
//                                     visible to the class; never names either student
//   sessions/L/peerHelpSettings       { notesEnabled, pausedAt }
//   sessions/L/peerHelperOff/{id}     true: the teacher switched this student off as a helper
//
// The request id is random and only linked to a student in the teacher-only nodes above, so
// neither student can look the other up, even from the browser's developer tools.

export const PEER_NOTE_MAX_LENGTH = 140
export const PEER_EDIT_MAX_LINES = 3
export const PEER_EDIT_LINE_MAX_LENGTH = 200
export const PEER_HINT_ID_PATTERN = /^[a-z0-9_-]{1,40}$/

export const PEER_HELP_END_REASONS = ['stuck', 'helper', 'teacher', 'task_changed']
export const PEER_HELP_RESPONSES = ['useful', 'accepted', 'declined', 'not_ok']

// Suggested edits and notes for the teacher to approve are built (the review queue, the word
// filter in ./peerHelpFilter.js, the rules) but switched off: for 9-year-olds peer help is just
// 👍 / 👎 / 💡 on a line. Turning this on shows them again to helpers and the teacher.
export const PEER_HELP_EDITS_AND_NOTES = false

// Kind, code-focused hints, with an emoji and very few words (helpers can be 9). Ids are stable:
// they travel over the wire instead of text, so nothing a helper sends without review can carry
// words of their own. Never renumber or reuse an id: old sessions resolve hints by it.
export const PLATFORM_PEER_HINTS = {
  common: [
    { id: 'run-and-read', emoji: '▶️', text: 'Run it and read the message' },
    { id: 'nearly-there', emoji: '⭐', text: 'Nearly there!' },
    { id: 'spelling', emoji: '🔤', text: 'Check the spelling' },
    { id: 'reread-task', emoji: '📖', text: 'Read the task again' },
    { id: 'look-again', emoji: '👀', text: 'Look at this line again' },
    { id: 'looks-good', emoji: '✅', text: 'This bit is good' },
  ],
  python: [
    { id: 'py-indent', emoji: '↔️', text: 'Check the spaces at the start' },
    { id: 'py-colon', emoji: '❗', text: 'Does it need a : at the end?' },
    { id: 'py-brackets', emoji: '🔢', text: 'Count the brackets ( )' },
    { id: 'py-quotes', emoji: '💬', text: 'Check the " " marks' },
    { id: 'py-case', emoji: '🔠', text: 'Check the capital letters' },
    { id: 'py-order', emoji: '🔀', text: 'Is it in the right order?' },
  ],
  html: [
    { id: 'html-close', emoji: '🔚', text: 'Does the tag close?' },
    { id: 'html-angle', emoji: '📐', text: 'Check the < and >' },
    { id: 'html-attr-quotes', emoji: '💬', text: 'Put " " round the value' },
    { id: 'html-nesting', emoji: '📦', text: 'Is it inside the right tag?' },
  ],
  blocks: [
    { id: 'sc-hat', emoji: '🏁', text: 'Start with a hat block' },
    { id: 'sc-order', emoji: '🔀', text: 'Are the blocks in order?' },
    { id: 'sc-loop', emoji: '🔁', text: 'Try a loop' },
    { id: 'sc-sprite', emoji: '🐱', text: 'Is it on the right sprite?' },
    { id: 'sc-value', emoji: '🔢', text: 'Check the number' },
  ],
}

// How many hint cards a helper sees at once: few enough to read at a glance.
export const PEER_HINT_CARD_LIMIT = 6
// Common hints worth a card when the module's list leaves room, most useful first.
const COMMON_CARD_IDS = ['run-and-read', 'nearly-there', 'spelling', 'reread-task']

function lessonPeerHints(task) {
  return (Array.isArray(task?.peerHints) ? task.peerHints : [])
    .map((text, index) => ({ id: `lesson-${index}`, emoji: '💡', text: String(text ?? '').trim() }))
    .filter((hint) => hint.text)
}

/**
 * Every hint id that can be resolved on this task: the lesson author's (`peerHints: [...]`, ids
 * `lesson-0`, `lesson-1`, …), the module's list (its `capabilities.peerHelp.hints`: 'python',
 * 'html' or 'blocks') and the common list. For showing what was sent; helpers pick from
 * getPeerHintCards.
 */
export function getPeerHints(hintList, task) {
  return [
    ...lessonPeerHints(task),
    ...(PLATFORM_PEER_HINTS[hintList] ?? []),
    ...PLATFORM_PEER_HINTS.common,
  ]
}

/**
 * The hint cards a helper picks from (at most PEER_HINT_CARD_LIMIT): the lesson's own first,
 * then the module's, then a few common ones.
 */
export function getPeerHintCards(hintList, task) {
  const common = COMMON_CARD_IDS.map((id) => PLATFORM_PEER_HINTS.common.find((h) => h.id === id))
  return [...lessonPeerHints(task), ...(PLATFORM_PEER_HINTS[hintList] ?? []), ...common].slice(
    0,
    PEER_HINT_CARD_LIMIT
  )
}

export function findPeerHint(hintId, hintList, task) {
  return getPeerHints(hintList, task).find((hint) => hint.id === hintId) ?? null
}

// ─── Eligibility ─────────────────────────────────────────────────────────────

export function hasPassedCurrentTask(student) {
  if (!student) return false
  if (student.checkOverridePassed === true) return true
  return student.checkPassed === true && student.checkOverridePassed !== false
}

/**
 * The open offers a student may be shown: the offer is for the class's current task, nobody
 * has claimed it, peer help isn't paused, the student passed the task, the teacher hasn't
 * switched them off, and it isn't their own request.
 */
export function visiblePeerHelpOffers({ session, identityId, ownRequestId }) {
  if (!session || !identityId) return []
  if (session.peerHelpSettings?.pausedAt) return []
  if (session.peerHelperOff?.[identityId]) return []
  if (!hasPassedCurrentTask(session.students?.[identityId])) return []
  return Object.entries(session.peerHelpOffers ?? {})
    .filter(
      ([requestId, offer]) =>
        requestId !== ownRequestId &&
        offer &&
        offer.claimedAt == null &&
        offer.endedAt == null &&
        String(offer.taskId) === String(session.currentTaskId)
    )
    .map(([requestId, offer]) => ({ requestId, ...offer }))
    .sort((a, b) => (a.offeredAt ?? 0) - (b.offeredAt ?? 0))
}

export function isOfferOpen(offer) {
  return !!offer && offer.endedAt == null
}

// ─── Snapshot lines ──────────────────────────────────────────────────────────

/**
 * The files of a help snapshot as [{ name, lines }]. Single-code lessons have one unnamed file
 * (name ''); HTML has one entry per file, entry file first.
 */
export function snapshotLineFiles(snapshot) {
  const files = snapshot?.files && Object.keys(snapshot.files).length ? snapshot.files : null
  if (!files) return [{ name: '', lines: String(snapshot?.code ?? '').split('\n') }]
  const names = Object.keys(files).sort((a, b) => {
    if (a === snapshot.activeFile) return -1
    if (b === snapshot.activeFile) return 1
    return a.localeCompare(b)
  })
  return names.map((name) => ({ name, lines: String(files[name] ?? '').split('\n') }))
}

export function snapshotLine(snapshot, file, line) {
  const entry = snapshotLineFiles(snapshot).find((f) => f.name === (file ?? ''))
  return entry?.lines[line - 1] ?? null
}

// ─── Suggested edits ─────────────────────────────────────────────────────────

/**
 * Checks a helper's suggested edit against the agreed limits. `edits` is
 * [{ line, op: 'replace' | 'insert', text }] where `line` is 1-based and an insert goes after
 * that line. `downLines` is the set of lines (in that file) the helper marked 👎.
 *
 * Returns null when it's allowed, otherwise a short reason a student can read.
 */
export function validatePeerEdit({ edits, downLines, lineCount }) {
  if (!Array.isArray(edits) || edits.length === 0) return 'Change at least one line.'
  if (edits.length > PEER_EDIT_MAX_LINES) {
    return `You can change at most ${PEER_EDIT_MAX_LINES} lines. Small nudges help them learn.`
  }
  const down = new Set(downLines ?? [])
  for (const edit of edits) {
    if (!Number.isInteger(edit?.line) || edit.line < 1 || edit.line > Math.max(lineCount, 1)) {
      return 'That line is not in their code.'
    }
    if (edit.op !== 'replace' && edit.op !== 'insert') return 'Unknown change.'
    if (typeof edit.text !== 'string' || edit.text.includes('\n')) return 'One line at a time.'
    if (edit.text.length > PEER_EDIT_LINE_MAX_LENGTH) return 'That line is too long.'
    const nearDown = down.has(edit.line) || (edit.op === 'insert' && down.has(edit.line + 1))
    if (!nearDown) return 'You can only change lines you marked 👎 (or add a line next to one).'
  }
  const replaced = edits.filter((e) => e.op === 'replace').map((e) => e.line)
  if (new Set(replaced).size !== replaced.length) return 'Each line can only be changed once.'
  return null
}

/**
 * Applies an approved edit to the stuck student's current text. Each edit carries `before`,
 * the line as the helper saw it; if the student has changed that line since, the edit can't
 * be applied automatically and null is returned (they can still read and copy it).
 */
export function applyPeerEdit(text, edits) {
  const lines = String(text ?? '').split('\n')
  for (const edit of edits) {
    if (lines[edit.line - 1] !== edit.before) return null
  }
  // Bottom-up so earlier line numbers stay valid.
  const ordered = [...edits].sort((a, b) => b.line - a.line || (a.op === 'insert' ? -1 : 1))
  for (const edit of ordered) {
    if (edit.op === 'replace') lines[edit.line - 1] = edit.text
    else lines.splice(edit.line, 0, edit.text)
  }
  return lines.join('\n')
}

// Firebase stores arrays as objects keyed '0', '1', …
export function editsFromWire(edits) {
  if (!edits) return []
  const list = Array.isArray(edits)
    ? edits
    : Object.keys(edits)
        .sort()
        .map((k) => edits[k])
  return list.filter(Boolean)
}

// ─── Inbox and review ────────────────────────────────────────────────────────

export function sortedItems(items) {
  return Object.entries(items ?? {})
    .map(([itemId, item]) => ({ itemId, ...item }))
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
}

/** Everything awaiting the teacher across every request: [{ requestId, itemId, ... }]. */
export function pendingReviewItems(peerHelp) {
  return Object.entries(peerHelp ?? {})
    .flatMap(([requestId, request]) =>
      sortedItems(request?.review)
        .filter((item) => item.status === 'pending')
        .map((item) => ({ requestId, ...item }))
    )
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0))
}

/** Requests the stuck student flagged "Not OK" that the teacher hasn't acknowledged. */
export function notOkAlerts(peerHelp) {
  return Object.entries(peerHelp ?? {})
    .filter(([, request]) => request?.state?.notOkAt != null && !request?.state?.notOkSeenAt)
    .map(([requestId, request]) => ({ requestId, ...request }))
}

/**
 * Each student's peer help role right now, with their partner, for the teacher:
 * { [id]: { role, partnerId, requestId } } where role is 'asked' (opted in, not offered yet) |
 * 'offered' | 'being_helped' | 'helping', and partnerId the other student (null until claimed).
 */
export function peerHelpPairsByStudent({ requests, peerHelp, offers }) {
  const pairs = {}
  for (const [studentId, request] of Object.entries(requests ?? {})) {
    const entry = peerHelp?.[request?.requestId]
    if (!entry || entry.state?.endedAt) continue
    const offer = offers?.[request.requestId]
    if (offer?.endedAt != null) continue
    pairs[studentId] = {
      role: !offer ? 'asked' : offer.claimedAt ? 'being_helped' : 'offered',
      partnerId: offer?.claimedAt ? (entry.helperId ?? null) : null,
      requestId: request.requestId,
    }
  }
  for (const [requestId, entry] of Object.entries(peerHelp ?? {})) {
    if (!entry?.helperId || entry.state?.endedAt) continue
    if (offers?.[requestId]?.endedAt != null) continue
    pairs[entry.helperId] = { role: 'helping', partnerId: entry.stuckId ?? null, requestId }
  }
  return pairs
}

/** Just the roles of peerHelpPairsByStudent: { [id]: role }. */
export function peerHelpRolesByStudent(input) {
  return Object.fromEntries(
    Object.entries(peerHelpPairsByStudent(input)).map(([id, pair]) => [id, pair.role])
  )
}

// ─── Session report ──────────────────────────────────────────────────────────

/**
 * The audit trail for the session report: one entry per request with both students' names
 * (the report is teacher-only), what was sent, what was approved, rejected or blocked, and how
 * it ended. Keeps every item, including rejected and blocked ones, for safeguarding.
 */
export function buildPeerHelpAudit({ peerHelp, offers, students, nameOf }) {
  const name = (id) =>
    id ? (nameOf?.(id) ?? students?.[id]?.displayName ?? 'Unknown student') : null
  return Object.entries(peerHelp ?? {})
    .map(([requestId, request]) => {
      const offer = offers?.[requestId] ?? null
      return {
        requestId,
        taskId: request?.snapshot?.taskId ?? offer?.taskId ?? null,
        stuck: name(request?.stuckId),
        helper: name(request?.helperId),
        offeredAt: offer?.offeredAt ?? null,
        claimedAt: offer?.claimedAt ?? null,
        endedAt: request?.state?.endedAt ?? offer?.endedAt ?? null,
        endedBy: request?.state?.endedBy ?? null,
        notOkAt: request?.state?.notOkAt ?? null,
        delivered: sortedItems(request?.inbox).map(auditItem),
        reviewed: sortedItems(request?.review).map(auditItem),
      }
    })
    .sort((a, b) => (a.offeredAt ?? 0) - (b.offeredAt ?? 0))
}

function auditItem(item) {
  return {
    kind: item.kind,
    status: item.status ?? 'delivered',
    file: item.file || null,
    line: item.line ?? null,
    verdict: item.verdict ?? null,
    hintId: item.hintId ?? null,
    text: item.text ?? null,
    edits: item.edits ? editsFromWire(item.edits) : null,
    blockedReason: item.blockedReason ?? null,
    response: item.response ?? null,
    createdAt: item.createdAt ?? null,
  }
}
