// Per-student, per-task typing measures for the session report (`typing` on each student task,
// `typingSummary` on the task summary; docs/authoring/session-reports.md "Typing").
//
// Measured on the student's own device from the shared CodeEditor's keystrokes
// (src/shared/CodeEditor.jsx → BadgeSignalsContext.reportTyping → useStudentTypingStats), kept
// in memory per task and written as one aggregated record to the student's own
// `students/{id}/typingLog/{taskId}` on Run, on a task change and when the tab is hidden: never
// per keystroke. Pastes and accepted autocomplete suggestions never count as typed characters
// (pastes are reported separately as `pastes`).

/** A gap longer than this between two keystrokes ends a typing burst. */
export const TYPING_BURST_GAP_MS = 5000

/** Under this much active typing time, `charsPerMin` is null (too little to be a rate). */
export const TYPING_RATE_MIN_ACTIVE_MS = 5000

/** The lesson (module) types whose code tasks record typing. Scratch and the rest never do. */
export const TYPING_LESSON_TYPES = Object.freeze(['python', 'turtle', 'html'])

/** Above this many edit-distance cells (copyCode length × code length), copyDistance is skipped. */
const MAX_EDIT_DISTANCE_CELLS = 4_000_000

const isCount = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0

/**
 * A fresh tracker state for one task, optionally seeded from the record already stored for it
 * (a reload, or the class coming back to the task) so the counts carry on instead of restarting.
 */
export function createTypingState(seed = null) {
  const copyDistance = isCount(seed?.copyDistance) ? seed.copyDistance : null
  return {
    charsTyped: isCount(seed?.charsTyped) ? seed.charsTyped : 0,
    activeTypingMs: isCount(seed?.activeTypingMs) ? seed.activeTypingMs : 0,
    corrections: isCount(seed?.corrections) ? seed.corrections : 0,
    longestPauseMs: isCount(seed?.longestPauseMs) ? seed.longestPauseMs : 0,
    autocompleteAccepts: isCount(seed?.autocompleteAccepts) ? seed.autocompleteAccepts : 0,
    copyDistance,
    // A stored copyDistance means the first Run has already happened.
    firstRunSeen: copyDistance != null,
    lastKeyAt: null,
  }
}

/**
 * Applies one editor typing event to a tracker state (mutating it) and returns it.
 * - `{ kind: 'insert', chars, at }`: characters typed by keystrokes (never a paste or an
 *   autocomplete insert; see typedCharsInUpdate in CodeEditor.jsx);
 * - `{ kind: 'correction', at }`: one Backspace or Delete press;
 * - `{ kind: 'autocomplete' }`: an accepted autocomplete suggestion.
 * Inserts and corrections are keystrokes: each gap of at most TYPING_BURST_GAP_MS since the
 * previous keystroke adds to `activeTypingMs`, and every gap counts towards `longestPauseMs`.
 */
export function applyTypingEvent(state, event) {
  if (!state || !event) return state
  if (event.kind === 'autocomplete') {
    state.autocompleteAccepts += 1
    return state
  }
  if (event.kind !== 'insert' && event.kind !== 'correction') return state
  if (event.kind === 'insert' && !(event.chars > 0)) return state
  const at = Number.isFinite(event.at) ? event.at : Date.now()
  if (state.lastKeyAt != null) {
    const gap = Math.max(0, at - state.lastKeyAt)
    if (gap <= TYPING_BURST_GAP_MS) state.activeTypingMs += gap
    if (gap > state.longestPauseMs) state.longestPauseMs = gap
  }
  state.lastKeyAt = at
  if (event.kind === 'insert') state.charsTyped += event.chars
  else state.corrections += 1
  return state
}

/** Whether the student typed anything (a keystroke insert or a correction). */
export function hasTyped(state) {
  return !!state && (state.charsTyped > 0 || state.corrections > 0)
}

/**
 * The record written to `students/{id}/typingLog/{taskId}`, or null when nothing was typed.
 * `charsPerMin` is not stored: the report derives it (typingReportFields).
 */
export function typingRecordOf(state) {
  if (!hasTyped(state)) return null
  return {
    charsTyped: state.charsTyped,
    activeTypingMs: Math.round(state.activeTypingMs),
    corrections: state.corrections,
    longestPauseMs: Math.round(state.longestPauseMs),
    autocompleteAccepts: state.autocompleteAccepts,
    ...(state.copyDistance != null ? { copyDistance: state.copyDistance } : {}),
  }
}

/** Characters per minute of active typing, rounded; null under TYPING_RATE_MIN_ACTIVE_MS. */
export function charsPerMinOf(charsTyped, activeTypingMs) {
  if (!isCount(charsTyped) || !isCount(activeTypingMs)) return null
  if (activeTypingMs < TYPING_RATE_MIN_ACTIVE_MS) return null
  return Math.round((charsTyped * 60000) / activeTypingMs)
}

/**
 * A stored typing record as the report's per-student `typing` block, or null when there is
 * none or nothing was typed.
 */
export function typingReportFields(raw) {
  if (!raw || typeof raw !== 'object') return null
  const charsTyped = isCount(raw.charsTyped) ? raw.charsTyped : 0
  const corrections = isCount(raw.corrections) ? raw.corrections : 0
  if (charsTyped === 0 && corrections === 0) return null
  const activeTypingMs = isCount(raw.activeTypingMs) ? Math.round(raw.activeTypingMs) : 0
  return {
    charsTyped,
    activeTypingMs,
    charsPerMin: charsPerMinOf(charsTyped, activeTypingMs),
    corrections,
    longestPauseMs: isCount(raw.longestPauseMs) ? Math.round(raw.longestPauseMs) : 0,
    autocompleteAccepts: isCount(raw.autocompleteAccepts) ? raw.autocompleteAccepts : 0,
    ...(isCount(raw.copyDistance) ? { copyDistance: raw.copyDistance } : {}),
  }
}

// ─── Copy accuracy ───────────────────────────────────────────────────────────

/** Text with line endings unified and trailing whitespace dropped from every line and the end. */
export function normalizeForCopyComparison(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n+$/, '')
}

/** Levenshtein distance (insert, delete, substitute = 1), or null when the inputs are too big. */
export function editDistance(a, b) {
  const s = String(a ?? '')
  const t = String(b ?? '')
  if (s === t) return 0
  if (s.length === 0) return t.length
  if (t.length === 0) return s.length
  if (s.length * t.length > MAX_EDIT_DISTANCE_CELLS) return null
  let prev = new Uint32Array(t.length + 1)
  let curr = new Uint32Array(t.length + 1)
  for (let j = 0; j <= t.length; j++) prev[j] = j
  for (let i = 1; i <= s.length; i++) {
    curr[0] = i
    const sc = s.charCodeAt(i - 1)
    for (let j = 1; j <= t.length; j++) {
      const cost = sc === t.charCodeAt(j - 1) ? 0 : 1
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[t.length]
}

// The code texts in a module's stored work: a code string (python, turtle), or each file's
// content of a files list or map (html).
function workTexts(work) {
  if (typeof work === 'string') return [work]
  if (Array.isArray(work)) {
    return work.map((file) => file?.content).filter((content) => typeof content === 'string')
  }
  if (work && typeof work === 'object') {
    return Object.values(work).filter((content) => typeof content === 'string')
  }
  return []
}

/**
 * The edit distance between a task's `copyCode` and the student's work, ignoring trailing
 * whitespace. For multi-file work (html) it is the closest file. Null when the task has no
 * copyCode, there is no work or the texts are too large.
 */
export function copyDistanceFor(copyCode, work) {
  if (typeof copyCode !== 'string' || !copyCode.trim()) return null
  const target = normalizeForCopyComparison(copyCode)
  const distances = workTexts(work)
    .map((text) => editDistance(target, normalizeForCopyComparison(text)))
    .filter((distance) => distance != null)
  return distances.length > 0 ? Math.min(...distances) : null
}

/**
 * Records the student's Run on a tracker state (mutating it): the first Run on a copyCode task
 * sets `copyDistance`. Returns whether the state changed.
 */
export function applyTypingRun(state, { copyCode, work } = {}) {
  if (!state || state.firstRunSeen) return false
  state.firstRunSeen = true
  const distance = copyDistanceFor(copyCode, work)
  if (distance == null) return false
  state.copyDistance = distance
  return true
}
