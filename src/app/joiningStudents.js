// Shared helpers for the name-entry "joining" marker at
// sessions/{lessonId}/joiningStudents/{tempId} = { joinedAt, typedName?, admit? }.
// The student's NameEntry shares what it is typing (`typedName`) so the teacher grid can
// list who is joining, and a teacher "Pull in" writes `admit = { name, at }`, which the
// student's own device turns into a normal name submit (see useStudentPhase).

/** Matches the NameEntry input's maxLength and the database rules' typedName/admit limits. */
export const NAME_MAX_LENGTH = 30

/** At most one typedName write per this many ms (leading + trailing). */
export const TYPED_NAME_THROTTLE_MS = 750

/** Trimmed, length-capped name; '' for anything that isn't a non-blank string. */
export function normaliseJoinName(value) {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, NAME_MAX_LENGTH).trim()
}

/** `name`, or `name-2`, `name-3`, … when the name is already taken in the session. */
export function applyNameSuffix(name, existing = []) {
  if (!existing.includes(name)) return name
  let n = 2
  while (existing.includes(`${name}-${n}`)) n++
  return `${name}-${n}`
}

/** The session's joining markers as a list, oldest first: [{ tempId, typedName, joinedAt }]. */
export function listJoiningStudents(joiningStudents) {
  if (!joiningStudents || typeof joiningStudents !== 'object') return []
  return Object.entries(joiningStudents)
    .map(([tempId, marker]) => ({
      tempId,
      typedName: normaliseJoinName(marker?.typedName),
      joinedAt: typeof marker?.joinedAt === 'number' ? marker.joinedAt : 0,
    }))
    .sort((a, b) => a.joinedAt - b.joinedAt || a.tempId.localeCompare(b.tempId))
}

/**
 * The name a teacher admit should join with, or null when the admit must be ignored:
 * no usable name, or an admit stamped before the marker was created (both stamps are
 * server timestamps, so they compare without clock skew).
 */
export function readAdmitName(marker) {
  const admit = marker?.admit
  if (!admit || typeof admit !== 'object') return null
  const name = normaliseJoinName(admit.name)
  if (!name) return null
  if (typeof admit.at !== 'number') return null
  if (typeof marker.joinedAt === 'number' && admit.at < marker.joinedAt) return null
  return name
}
