// What a student is being told when their work goes wrong, mirrored for the teacher.
//
// The student side (useStudentCodeState) writes two fields onto
// sessions/{lessonId}/students/{id}:
//   studentHint: { text, source: 'check' | 'override', failStreak, taskId, at } | null
//     the check-feedback hint on the student's banner (CheckFeedbackBanner), or the fail
//     hint the teacher wrote with an override;
//   hintOffer: { kind: 'targeted' | 'support', stageIndex, label, taskId, at } | null
//     a "Want a hint?" reference the student has been offered but not opened.
// Both are lesson-phase only, cleared on a pass and wiped by setTaskId. The teacher views
// (StudentCard, StudentModal, CommonHintsStrip) read them through readStudentHint /
// readHintOffer, which ignore anything left over from another task.
//
// lastRunError (writeStudentRun's errorText) is the error line of the student's latest
// crashed run, shown in the card's "Error" chip.

export const HINT_TEXT_MAX = 600
export const RUN_ERROR_MAX = 300

function clip(text, max) {
  const value = String(text ?? '').trim()
  return value.length > max ? `${value.slice(0, max - 1)}…` : value
}

// The error line of a crashed run's console output: the last non-empty line, which is where
// the Python worker (formatPythonError) and Arcade put "Line 3: NameError: …".
export function lastErrorLine(output) {
  const lines = String(output ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  return lines.length ? clip(lines.at(-1), RUN_ERROR_MAX) : null
}

export function clipRunError(text) {
  const value = clip(text, RUN_ERROR_MAX)
  return value || null
}

function stageLabel(task, stageIndex, fallback) {
  return String(fallback || task?.codeStages?.[stageIndex]?.label || '').trim() || null
}

/**
 * The studentHint / hintOffer values the student should currently publish. `undefined` means
 * "leave what is there" — between a Run starting (feedback reset) and its result, so the
 * teacher keeps seeing the last hint rather than a flicker of nothing.
 */
export function buildStudentHintState({
  task,
  taskId,
  checkAttempted,
  checkPassed,
  checkSuggestion,
  checkFailCount,
  studentData,
  targetedStageOffer,
  offeredSupportStageIndex,
}) {
  if (taskId == null) return { studentHint: undefined, hintOffer: undefined }
  let studentHint
  if (checkAttempted && checkPassed) studentHint = null
  else if (checkAttempted) {
    const text = clip(checkSuggestion, HINT_TEXT_MAX)
    const overrideHint = String(studentData?.checkOverrideHint ?? '').trim()
    const isOverride =
      !!studentData?.checkOverridePushedAt &&
      studentData?.checkOverridePassed === false &&
      !!overrideHint &&
      overrideHint === String(checkSuggestion ?? '').trim()
    studentHint = text
      ? {
          text,
          source: isOverride ? 'override' : 'check',
          failStreak: Number(checkFailCount) || 0,
          taskId: String(taskId),
        }
      : null
  }

  let hintOffer
  if (checkAttempted && checkPassed) hintOffer = null
  else if (targetedStageOffer && Number.isInteger(Number(targetedStageOffer.stageIndex))) {
    const stageIndex = Number(targetedStageOffer.stageIndex)
    hintOffer = {
      kind: 'targeted',
      stageIndex,
      label: stageLabel(task, stageIndex, targetedStageOffer.label),
      taskId: String(taskId),
    }
  } else if (offeredSupportStageIndex != null) {
    const stageIndex = Number(offeredSupportStageIndex)
    hintOffer = {
      kind: 'support',
      stageIndex,
      label: stageLabel(task, stageIndex),
      taskId: String(taskId),
    }
  } else hintOffer = null

  return { studentHint, hintOffer }
}

// Has the student passed the current task (their own check, or the teacher's override)?
function hasPassed(student) {
  if (student?.checkOverridePushedAt) return student.checkOverridePassed === true
  return student?.checkPassed === true
}

function onTask(value, currentTaskId) {
  return value && currentTaskId != null && String(value.taskId) === String(currentTaskId)
}

export function readStudentHint(student, currentTaskId) {
  const hint = student?.studentHint
  if (!onTask(hint, currentTaskId) || !hint.text || hasPassed(student)) return null
  return hint
}

export function readHintOffer(student, currentTaskId) {
  const offer = student?.hintOffer
  if (!onTask(offer, currentTaskId) || hasPassed(student)) return null
  return offer
}

export function describeHintOffer(offer) {
  if (!offer) return ''
  const label = offer.label ? `“${offer.label}”` : 'a reference'
  return `Offered ${label} as a hint — not opened yet`
}

// Hint Markdown flattened to one line for tooltips, the common-hints strip and grouping.
export function hintPlainText(markdown) {
  return String(markdown ?? '')
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```\w*\n?/g, ''))
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(^|[^\w*])[*_]([^*_\n]+)[*_](?=[^\w*]|$)/g, '$1$2')
    .replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+|\d+\.\s+)/gm, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Hints shared by two or more students on the current task, most common first:
 * [{ group: 'hint:<text>', text, studentIds }]. Overrides are left out (they are the
 * teacher's own words to one student, not a pattern in the class).
 */
export function summariseCommonHints(students, currentTaskId, { minStudents = 2 } = {}) {
  const groups = new Map()
  for (const student of students ?? []) {
    const hint = readStudentHint(student, currentTaskId)
    if (!hint || hint.source === 'override') continue
    const text = hintPlainText(hint.text)
    if (!text) continue
    const key = text.toLowerCase()
    const entry = groups.get(key) ?? { group: `hint:${key}`, text, studentIds: [] }
    entry.studentIds.push(student.anonymousId)
    groups.set(key, entry)
  }
  return [...groups.values()]
    .filter((entry) => entry.studentIds.length >= minStudents)
    .sort((a, b) => b.studentIds.length - a.studentIds.length || a.text.localeCompare(b.text))
}
