// Preview review notes (platform request #127): pure helpers shared by the preview strip, the
// Builder's task feedback panel and the tests. Firestore access lives in reviewNotesService.js.

export const REVIEW_NOTE_MAX_LENGTH = 500

export const REVIEW_NOTE_TAGS = [
  { value: 'wrong', label: 'Wrong' },
  { value: 'confusing', label: 'Confusing' },
  { value: 'too_long', label: 'Too long' },
  { value: 'love_it', label: 'Love it' },
]

export const REVIEW_NOTE_STATUSES = ['new', 'picked_up', 'done']

// Status chip colours: New grey, Picked up blue, Done green.
export const CHIP_COLOURS = {
  new: { background: '#e5e7eb', color: '#374151' },
  picked_up: { background: '#dbeafe', color: '#1d4ed8' },
  done: { background: '#dcfce7', color: '#15803d' },
}

const STATUS_LABELS = { new: 'New', picked_up: 'Picked up', done: 'Done' }

export function reviewNoteStatusLabel(status) {
  return STATUS_LABELS[status] ?? STATUS_LABELS.new
}

export function reviewNoteTagLabel(tag) {
  return REVIEW_NOTE_TAGS.find((t) => t.value === tag)?.label ?? null
}

function toMillis(value) {
  if (typeof value === 'number') return value
  if (value?.toMillis) return value.toMillis()
  if (typeof value?.seconds === 'number') return value.seconds * 1000
  // serverTimestamp() reads back as null in the local echo before the server confirms it.
  return null
}

/** A Firestore doc ({ id, ...data }) with its times as epoch ms. */
export function normaliseReviewNote(raw) {
  return {
    id: raw.id,
    lessonId: raw.lessonId ?? null,
    taskId: raw.taskId ?? null,
    lessonVersion: raw.lessonVersion ?? null,
    text: raw.text ?? '',
    tag: raw.tag ?? null,
    status: REVIEW_NOTE_STATUSES.includes(raw.status) ? raw.status : 'new',
    createdAt: toMillis(raw.createdAt),
    statusChangedAt: toMillis(raw.statusChangedAt),
    createdBy: raw.createdBy ?? null,
  }
}

/** Notes on one task, oldest first (the box reads top to bottom). Ids compare as text. */
export function notesForTask(notes, taskId) {
  const key = String(taskId)
  // A note still waiting for its server time sorts last: it is the one just saved.
  const at = (n) => n.createdAt ?? Number.MAX_SAFE_INTEGER
  return notes.filter((n) => String(n.taskId) === key).sort((a, b) => at(a) - at(b))
}

/** The status the chip shows: the newest note's. null when the task has no notes. */
export function latestReviewNoteStatus(taskNotes) {
  return taskNotes.length ? taskNotes[taskNotes.length - 1].status : null
}

/** Edit and Delete are offered only to the writer, and only while the note is New. */
export function canChangeReviewNote(note, uid) {
  return !!uid && note.status === 'new' && note.createdBy === uid
}

/** Trimmed text, or an error string. */
export function checkReviewNoteText(text) {
  const trimmed = String(text ?? '').trim()
  if (!trimmed) return { error: 'Type a note first.' }
  if (trimmed.length > REVIEW_NOTE_MAX_LENGTH)
    return { error: `Keep it under ${REVIEW_NOTE_MAX_LENGTH} characters.` }
  return { text: trimmed }
}
