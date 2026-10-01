import { chooseLineHints, getTaskLineHintSets } from '../../../shared/lineHints'

// The task's author line hints (💡, src/shared/lineHints.js) on the code the teacher watches in
// StudentModal. Computed from the lesson the same way the student's editor gets them
// (getTaskLineHintSets) — nothing new is mirrored — and only displayed: the CodeEditor
// re-anchors them by line text whenever the mirrored code changes, so a hint the student has
// edited away is gone for the teacher too.

// Mirrors that show the student's code in a text editor ('view' only where the module's
// TeacherLiveView takes `lineHints`, e.g. Turtle).
const CODE_MIRRORS = new Set(['code', 'files', 'view'])

/**
 * The hint sets for the mirrored code (`file` null) or one mirrored file, or null when there
 * are none to show: no hint markers in the task, a mirror that shows no code, or a session
 * sandbox (the student's sandbox editor shows no hints either).
 */
export function getMirrorLineHintSets(task, { mirror, file = null, isSessionSandbox = false }) {
  if (isSessionSandbox || !CODE_MIRRORS.has(mirror)) return null
  const sets = getTaskLineHintSets(task, mirror === 'files' ? file : null)
  return sets.length > 0 ? sets : null
}

// How many of the hints show on `code` (what the editor displays: chooseLineHints).
export function countShownLineHints(code, hintSets) {
  if (typeof code !== 'string' || !hintSets) return 0
  return chooseLineHints(code, hintSets).length
}
