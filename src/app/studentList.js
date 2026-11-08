// The compact tutor student list (StudentGrid + StudentListRow; sketch v2, Ryan OK 8 Nov 2026):
// one slim row per student with one plain status word. Built only from what the tutor's screen
// already receives, so nothing new is written to Firebase. Stuck uses the Needs you rules in
// needsYou.js (STUCK_FAILS failed checks in a row, or the same error ERROR_LOOP_RUNS runs in a
// row); Failed (a wrong answer) and Error (a crash) follow studentCheckStatus.js.
//
// Pure and Node-safe.

export const STUB_CHARS = 12
export const SAME_OUTPUT_MIN = 3
// Quiet this long (no mouse or key activity reported) and the row says "idle Nm".
export const IDLE_AFTER_MS = 2 * 60_000

// Groups, top to bottom: students asking for help, everyone else, offline.
export const ROW_GROUP = Object.freeze({ help: 0, rest: 1, offline: 2 })

/**
 * One student's row state: { status, presence, stuck }.
 * status, most urgent first: help > stuck > failed | error > finished > away > offline > online.
 * presence ('online' | 'away' | 'offline') is kept apart, so an offline student who finished
 * still shows Finished on a faded row with a hollow marker.
 * `checkStatus` is deriveStudentCheckStatus's result; `needs` is needsYouState's (or null);
 * `errorRuns` is the needsYou error-run counter for the student.
 */
export function classifyStudentRow(student, { checkStatus = null, needs = null, errorRuns } = {}) {
  const presence = !student?.online
    ? 'offline'
    : student.windowFocused === false
      ? 'away'
      : 'online'
  const out = (status, stuck = null) => ({ status, presence, stuck })
  if (student?.needsHelp || needs?.kind === 'help') return out('help')
  if (needs?.kind === 'error') {
    return out('stuck', { kind: 'error', count: errorRuns?.count ?? 0, error: errorRuns?.error })
  }
  if (needs?.kind === 'stuck') {
    return out('stuck', { kind: 'fails', count: Number(student?.studentHint?.failStreak) || 0 })
  }
  if (checkStatus?.errored) return out('error')
  if (checkStatus?.failed) return out('failed')
  if (checkStatus?.passed) return out('finished')
  if (presence === 'away') return out('away')
  if (presence === 'offline') return out('offline')
  return out('online')
}

// Which block of the list the row sits in. "I'm on it" (`acked`) moves a help row down among
// the rest, still amber.
export function rowGroup(state, { acked = false } = {}) {
  if (state?.presence === 'offline') return ROW_GROUP.offline
  if (state?.status === 'help' && !acked) return ROW_GROUP.help
  return ROW_GROUP.rest
}

const nameKey = (student) => String(student?.displayName ?? '').toLocaleLowerCase()

/**
 * The list order: group, then name. It only changes when a student's group (state), name or the
 * set of students changes, never on a run or keystroke (`prev` comes back unchanged). The open
 * row (`pinnedId`) keeps the group it had when opened, so it stays where it is until closed.
 * Returns { ids, groups, names }; pass it back as `prev` next time.
 */
export function orderStudentRows(students, { groupOf, prev = null, pinnedId = null } = {}) {
  const list = Array.isArray(students) ? students.filter((s) => s?.anonymousId) : []
  const groups = {}
  const names = {}
  for (const student of list) {
    const id = student.anonymousId
    groups[id] =
      id === pinnedId && prev?.groups?.[id] != null ? prev.groups[id] : (groupOf?.(student) ?? 1)
    names[id] = nameKey(student)
  }
  const unchanged =
    prev &&
    prev.ids.length === list.length &&
    list.every((s) => {
      const id = s.anonymousId
      return id in prev.groups && prev.groups[id] === groups[id] && prev.names[id] === names[id]
    })
  if (unchanged) return prev
  const ids = list
    .map((s) => s.anonymousId)
    .sort(
      (a, b) =>
        groups[a] - groups[b] || names[a].localeCompare(names[b]) || String(a).localeCompare(b)
    )
  return { ids, groups, names }
}

const lastLine = (text) =>
  String(text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .pop() ?? ''

// The words the row shows for their last run: the error line when it crashed, else the last line
// of output. '' when there is nothing.
export function rowOutputText(student) {
  if (student?.lastRunStatus === 'error' && student.lastRunError) {
    return lastLine(student.lastRunError)
  }
  return lastLine(student?.currentOutput)
}

// The grey stub on the row: about STUB_CHARS characters.
export function outputStub(text, max = STUB_CHARS) {
  const clean = String(text ?? '').trim()
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean
}

// "now", "4m", "2h": how long ago, short enough for the row.
export function ageWords(ts, now) {
  if (!ts || now == null) return ''
  const mins = Math.floor(Math.max(0, now - ts) / 60_000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h`
}

/**
 * The output most students share, when SAME_OUTPUT_MIN or more do: { text, count, studentIds },
 * else null. Only runs that did not crash count.
 */
export function sameOutputSummary(students, { min = SAME_OUTPUT_MIN } = {}) {
  const byText = new Map()
  for (const student of Array.isArray(students) ? students : []) {
    if (!student?.anonymousId || student.lastRunStatus === 'error') continue
    const text = lastLine(student.currentOutput)
    if (!text) continue
    if (!byText.has(text)) byText.set(text, [])
    byText.get(text).push(student.anonymousId)
  }
  let best = null
  for (const [text, studentIds] of byText) {
    if (studentIds.length >= min && (!best || studentIds.length > best.count)) {
      best = { text, count: studentIds.length, studentIds }
    }
  }
  return best
}

// The header's counts. Presence (away, offline) is counted apart from the status word.
export function summariseRowStates(states) {
  const counts = { help: 0, finished: 0, stuck: 0, failed: 0, error: 0, away: 0, offline: 0 }
  for (const state of states ?? []) {
    if (state?.status in counts && state.status !== 'away' && state.status !== 'offline') {
      counts[state.status] += 1
    }
    if (state?.presence === 'away') counts.away += 1
    if (state?.presence === 'offline') counts.offline += 1
  }
  return counts
}
