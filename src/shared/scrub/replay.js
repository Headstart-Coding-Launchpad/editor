// Replayed input() answers during live scrubbing (P6-21; useScrubPreview). A program that asks
// for input previews live by replaying, in order, the answers the student gave on their last
// Run. The workspaces show which answers a preview used ("Using your last answers: Ada, Mars,
// teal"), so a student isn't puzzled that no questions appeared. Pure.

export const REPLAY_NOTE_MAX_ANSWERS = 3
export const REPLAY_NOTE_MAX_CHARS = 16

function shortAnswer(answer, maxChars) {
  const text = String(answer ?? '')
  if (!text.trim()) return '(blank)'
  return text.length > maxChars ? `${text.slice(0, Math.max(1, maxChars - 1))}…` : text
}

/**
 * The replay note's words for the answers a preview used, or '' for none: up to three answers
 * (each cut to 16 characters; a blank answer shows as "(blank)"), then "and N more".
 */
export function scrubReplayNoteText(
  answers,
  { maxAnswers = REPLAY_NOTE_MAX_ANSWERS, maxChars = REPLAY_NOTE_MAX_CHARS } = {}
) {
  const list = Array.isArray(answers) ? answers : []
  if (list.length === 0) return ''
  const shown = list.slice(0, maxAnswers).map((answer) => shortAnswer(answer, maxChars))
  const more = list.length - shown.length
  return `Using your last answers: ${shown.join(', ')}${more > 0 ? ` and ${more} more` : ''}`
}

/** The notice a scrub shows when the program can't preview live (useEditorScrub). */
export function scrubNoticeText(status) {
  if (status === 'press-run-answers') return 'Press Run and answer the questions first'
  if (status === 'press-run') return 'Press Run to see it'
  return null
}
