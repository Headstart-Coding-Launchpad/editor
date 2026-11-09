// The Builder task editor's three tabs (Content, Settings, Authoring notes), the tab the author
// last chose, and which tab each validation error belongs to (shown as a count on the tab).

export const TASK_EDITOR_TABS = [
  { id: 'content', label: 'Content' },
  { id: 'settings', label: 'Settings' },
  { id: 'notes', label: 'Authoring notes' },
]

// Remembered while the Builder stays open (this page session only, never stored): the editor
// remounts for each task, and the author keeps the tab they were working in.
let rememberedTab = 'content'

// `shownTabs` lists the tabs that hold something for this task; a remembered tab that does not
// (Settings on a quiz) opens Content instead.
export function getRememberedTaskEditorTab(shownTabs) {
  if (Array.isArray(shownTabs) && !shownTabs.includes(rememberedTab)) return 'content'
  return rememberedTab
}

export function rememberTaskEditorTab(tab) {
  if (TASK_EDITOR_TABS.some((t) => t.id === tab)) rememberedTab = tab
}

// Back to Content (tests, and a fresh Builder load).
export function forgetTaskEditorTab() {
  rememberedTab = 'content'
}

// Fields edited in the Authoring notes tab.
const NOTES_FIELDS = /\b(badgeHints|badge hints?|intent|taskActivity|task activity)\b/i

// Fields edited in the Settings tab: the optional features and the Task options fold.
const SETTINGS_FIELDS =
  /\b(copyCode|copyAfter|copyBefore|copy code|showBlocks|showVariables|stageTarget|scrub|slowMo|slow-mo|interactionMode|allowSharing|highlight|inspector|sideQuests?|side.quests?|peerHints|carry\w*|tests?|checks?|feedbackChecks|incorrectChecks)\b/i

/**
 * Counts this task's validation errors by the tab that edits the field.
 * Errors name the task as "Task <n> ..." (src/shared/lessonValidation.js); others are ignored.
 * `hasSettings` is false when the Settings tab has no Task options (quiz, information,
 * activity): their checks are edited on Content.
 */
export function taskEditorTabErrorCounts(errors, taskNumber, { hasSettings = true } = {}) {
  const counts = { content: 0, settings: 0, notes: 0 }
  if (!Array.isArray(errors) || !(taskNumber > 0)) return counts
  const prefix = `Task ${taskNumber}`
  for (const error of errors) {
    if (typeof error !== 'string' || !error.startsWith(prefix)) continue
    const next = error.charAt(prefix.length)
    if (next !== ' ' && next !== '' && next !== ':') continue
    // Route on the error text only: the label can carry the task title, Task 3 ("<title>").
    const rest = error.slice(prefix.length).replace(/^\s*\(".*?"\)/, '')
    if (NOTES_FIELDS.test(rest)) counts.notes += 1
    else if (hasSettings && SETTINGS_FIELDS.test(rest)) counts.settings += 1
    else counts.content += 1
  }
  return counts
}
