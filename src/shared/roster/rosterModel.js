// Class roster: pure helpers (no Firebase). Ryan's 2026-10-14 identity decisions
// (docs/architecture/requests-2026-10-14-plan.md, "Identity: class roster, matched by the tutor"):
// - each class has a roster of first-name-and-initial entries in Firestore,
//   classes/{classId}/roster/{rosterId};
// - the tutor matches each joined (anonymous) student to an entry by hand; the match lives in the
//   teacher-only RTDB node sessions/{lessonId}/rosterMatches/{anonymousId};
// - the tutor's signed-in client saves a matched student's last Run or submission to
//   classes/{classId}/roster/{rosterId}/work/{sourceLessonId}__{sourceTaskId}, keyed by the
//   stock lesson's ids so a later class fork finds an earlier fork's work.
// Roster names stay on the tutor's side: never in session reports or CLI-readable data.

import { decodeFileKey } from '../fileKeys.js'

export const ROSTER_NAME_MAX = 30
export const ROSTER_SUBCOLLECTION = 'roster'
export const ROSTER_WORK_SUBCOLLECTION = 'work'
export const ROSTER_WORK_CHUNKS_SUBCOLLECTION = 'chunks'
export const ROSTER_TYPING_SUBCOLLECTION = 'typing'
// Firestore's hard document limit is 1 MiB. Content longer than this many characters (a UTF-8
// character is at most 3 bytes per UTF-16 unit) moves into the work document's `chunks`
// subcollection, each chunk this size at most, so every document stays well under the limit.
export const ROSTER_WORK_INLINE_MAX_CHARS = 200_000
export const ROSTER_WORK_CHUNK_CHARS = 200_000

// The trimmed, single-spaced roster name ("Jamie B."), or '' when it isn't usable.
export function normaliseRosterName(value) {
  const name = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!name || name.length > ROSTER_NAME_MAX) return ''
  return name
}

export function compareRosterEntries(a, b) {
  return String(a?.displayName ?? '').localeCompare(String(b?.displayName ?? ''), undefined, {
    sensitivity: 'base',
  })
}

// ── Which class a session uses ────────────────────────────────────────────────

// A class fork uses its own `fork.classId`. A stock lesson uses the class the tutor picked for
// this session (`session.classId`, stamped with `classChosenAt`). Returns
// { classId, source: 'fork' | 'session' | 'none' | 'unset' }: 'none' when the tutor chose
// "No class", 'unset' when a stock lesson's tutor hasn't chosen yet.
export function resolveSessionClass(lesson, session) {
  const forkClassId = lesson?.fork?.classId
  if (forkClassId) return { classId: String(forkClassId), source: 'fork' }
  const chosen = session?.classId
  if (typeof chosen === 'string' && chosen) return { classId: chosen, source: 'session' }
  if (session?.classChosenAt != null) return { classId: null, source: 'none' }
  return { classId: null, source: 'unset' }
}

// ── Saved-work keys ───────────────────────────────────────────────────────────

// The stock lesson's ids for a task of `lesson` (live session id `lessonId`): a fork resolves to
// `fork.sourceLessonId` and the task's `fork.taskLinks[].sourceTaskId` (buildLessonFork copies
// tasks 1:1, so the ids match today; the link is still read so a re-numbered fork keeps working).
// A task with no link keeps its own id.
export function resolveSourceIds(lesson, lessonId, taskId) {
  const fork = lesson?.fork
  const sourceLessonId = fork?.sourceLessonId || lesson?.id || lessonId || null
  const link = (fork?.taskLinks ?? []).find((entry) => String(entry?.taskId) === String(taskId))
  const sourceTaskId = link?.sourceTaskId ?? taskId
  return { sourceLessonId, sourceTaskId: sourceTaskId ?? null }
}

// The work document id, `{sourceLessonId}__{sourceTaskId}`. Slashes would split the Firestore
// path, so they become '_'; ids Firestore reserves (`__…__`, '.' or '..') come back null.
export function makeRosterWorkId(sourceLessonId, sourceTaskId) {
  if (sourceLessonId == null || sourceLessonId === '' || sourceTaskId == null) return null
  if (sourceTaskId === '') return null
  const id = `${sourceLessonId}__${sourceTaskId}`.replace(/\//g, '_')
  if (/^__.*__$/.test(id) || id === '.' || id === '..') return null
  return id
}

export function rosterEntryPath(classId, rosterId) {
  return `classes/${classId}/${ROSTER_SUBCOLLECTION}/${rosterId}`
}

export function rosterWorkPath(classId, rosterId, workId) {
  return `${rosterEntryPath(classId, rosterId)}/${ROSTER_WORK_SUBCOLLECTION}/${workId}`
}

// ── Matches ───────────────────────────────────────────────────────────────────

// sessions/{lessonId}/rosterMatches/{anonymousId}: { rosterId, matchedAt, matchedBy }.
export function makeRosterMatch(rosterId, matchedBy, matchedAt = Date.now()) {
  if (!rosterId) throw new Error('A roster entry is required')
  return { rosterId: String(rosterId), matchedAt, matchedBy: matchedBy ? String(matchedBy) : null }
}

// { anonymousId: rosterId } for the matches whose entry is still on the roster.
export function activeRosterMatches(matches, roster) {
  const ids = new Set((roster ?? []).map((entry) => entry.id))
  const result = {}
  for (const [anonymousId, match] of Object.entries(matches ?? {})) {
    if (match?.rosterId && ids.has(match.rosterId)) result[anonymousId] = match.rosterId
  }
  return result
}

// The tutor-only roster status for the grid: whether the session has a class roster to match
// against, each matched student's roster name, and which joined students are still unmatched.
export function summariseRosterStatus({ students = [], matches, roster, classId }) {
  const hasRoster = !!classId
  const byId = new Map((roster ?? []).map((entry) => [entry.id, entry]))
  const active = activeRosterMatches(matches, roster)
  const namesByStudent = {}
  const unmatchedIds = []
  for (const student of students) {
    const rosterId = active[student.anonymousId]
    if (rosterId) namesByStudent[student.anonymousId] = byId.get(rosterId)?.displayName ?? null
    else if (hasRoster) unmatchedIds.push(student.anonymousId)
  }
  return {
    hasRoster,
    namesByStudent,
    unmatchedIds,
    matchedRosterIds: new Set(Object.values(active)),
  }
}

// ── Work extraction ───────────────────────────────────────────────────────────

function filesToList(fileMap) {
  if (!fileMap || typeof fileMap !== 'object') return null
  const files = Object.entries(fileMap)
    .filter(([, content]) => typeof content === 'string')
    .map(([name, content]) => ({ name: decodeFileKey(name), content }))
  return files.length ? files.sort((a, b) => a.name.localeCompare(b.name)) : null
}

function parseJson(text) {
  if (typeof text !== 'string' || !text) return null
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

// The roster work for a module (`definition.capabilities.rosterWork`) from what the tutor
// already receives: a student node's last run (`currentCode` / `currentFiles`) or an attempt's
// `submission` (always a string: code, or JSON for files and blocks — logAttempt). Returns
// { kind, code } | { kind, files: [{ name, content }] } | { kind, scratchState } or null.
export function extractRosterWork(definition, { student, submission } = {}) {
  const kind = definition?.capabilities?.rosterWork ?? null
  if (!kind) return null
  if (kind === 'code') {
    const code = submission !== undefined ? submission : student?.currentCode
    return typeof code === 'string' && code !== '' ? { kind, code } : null
  }
  if (kind === 'files') {
    const files =
      submission !== undefined
        ? filesToList(parseJson(submission))
        : filesToList(student?.currentFiles)
    return files ? { kind, files } : null
  }
  if (kind === 'blocks') {
    const raw = submission !== undefined ? submission : student?.currentCode
    const state = definition.wire?.fromCode ? definition.wire.fromCode(raw) : parseJson(raw)
    if (!state || typeof state !== 'object' || !Object.keys(state).length) return null
    return { kind, scratchState: state }
  }
  return null
}

// A stable text form of the work, for hashing and size checks.
export function serialiseRosterWork(work) {
  if (!work) return ''
  if (work.kind === 'code') return work.code
  if (work.kind === 'files') return JSON.stringify(work.files)
  return JSON.stringify(work.scratchState)
}

// FNV-1a 32-bit over the serialised work and its kind: equal work ⇒ equal hash, so a repeat
// save of unchanged work is skipped.
export function hashRosterWork(work) {
  const text = `${work?.kind ?? ''}:${serialiseRosterWork(work)}`
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

// Splits text into pieces of at most `size` characters, never between the two halves of a
// surrogate pair (so each piece is valid UTF-16 on its own).
export function splitIntoChunks(text, size = ROSTER_WORK_CHUNK_CHARS) {
  const value = String(text ?? '')
  if (!value) return []
  const chunks = []
  let start = 0
  while (start < value.length) {
    let end = Math.min(start + size, value.length)
    const code = value.charCodeAt(end - 1)
    if (end < value.length && code >= 0xd800 && code <= 0xdbff) end -= 1
    chunks.push(value.slice(start, end))
    start = end
  }
  return chunks
}

export function joinChunks(chunks) {
  return (chunks ?? []).join('')
}

// The Firestore document for one saved task, plus any `chunks` to write beside it. The content
// travels inline (`code`, `files`, or `scratchState` as a JSON string, since Blockly state nests
// arrays Firestore can't hold) unless it is longer than `inlineMax`, when it moves to
// `chunks/{0..n-1}` ({ data }) as `contentJson` and the document carries `chunkCount`.
export function buildRosterWorkDoc(
  work,
  { moduleType, sessionLessonId, taskId, sourceLessonId, sourceTaskId, origin, hash },
  { inlineMax = ROSTER_WORK_INLINE_MAX_CHARS, chunkSize = ROSTER_WORK_CHUNK_CHARS } = {}
) {
  if (!work) throw new Error('Nothing to save')
  const doc = {
    kind: work.kind,
    moduleType: moduleType ?? null,
    sessionLessonId: sessionLessonId ?? null,
    taskId: taskId ?? null,
    sourceLessonId: sourceLessonId ?? null,
    sourceTaskId: sourceTaskId ?? null,
    origin: origin ?? null,
    hash: hash ?? hashRosterWork(work),
    chunkCount: 0,
  }
  const content =
    work.kind === 'code'
      ? { code: work.code }
      : work.kind === 'files'
        ? { files: work.files }
        : { scratchState: JSON.stringify(work.scratchState) }
  const size = JSON.stringify(content).length
  if (size <= inlineMax) return { doc: { ...doc, ...content }, chunks: [] }
  const chunks = splitIntoChunks(JSON.stringify(content), chunkSize)
  return { doc: { ...doc, chunkCount: chunks.length }, chunks }
}

// The inverse of buildRosterWorkDoc: { kind, code | files | scratchState, ...meta } from a work
// document and its chunk texts (in order), or null when it holds nothing usable.
export function readRosterWorkDoc(doc, chunks = []) {
  if (!doc?.kind) return null
  let content = doc
  if (doc.chunkCount > 0) {
    if (chunks.length !== doc.chunkCount) return null
    content = parseJson(joinChunks(chunks))
    if (!content) return null
  }
  const meta = {
    moduleType: doc.moduleType ?? null,
    sessionLessonId: doc.sessionLessonId ?? null,
    taskId: doc.taskId ?? null,
    sourceLessonId: doc.sourceLessonId ?? null,
    sourceTaskId: doc.sourceTaskId ?? null,
    origin: doc.origin ?? null,
    hash: doc.hash ?? null,
    savedAt: doc.savedAt ?? null,
  }
  if (doc.kind === 'code' && typeof content.code === 'string') {
    return { kind: 'code', code: content.code, ...meta }
  }
  if (doc.kind === 'files' && Array.isArray(content.files)) {
    return { kind: 'files', files: content.files, ...meta }
  }
  if (doc.kind === 'blocks') {
    const state = typeof content.scratchState === 'string' ? parseJson(content.scratchState) : null
    return state ? { kind: 'blocks', scratchState: state, ...meta } : null
  }
  return null
}
