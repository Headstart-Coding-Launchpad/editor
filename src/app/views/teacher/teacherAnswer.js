// What the teacher view's Answer panel shows for a task (calm teacher view, sketch v2): the
// model answer first, with a quiet Answer / Starter (or Answer / Question only) toggle. Pure
// helpers, so the panel and its tests read the same rules. Students never see this panel.
import { getTaskActivity, isHostedActivityTask } from '../../../activities/registry.pure.js'
import { getStageRole } from '../../../shared/taskUtils'
import { getModuleHostedActivityUi } from '../../../activities/registry.js'

export const MULTIPLE_CHOICE_ACTIVITY = 'quiz_multiple_choice'
export const SHORT_ANSWER_ACTIVITY = 'quiz_short_answer'

/**
 * Which answer view a task gets:
 * - 'info': an information task (no answer);
 * - 'choice' / 'short': a multiple-choice or short-answer quiz (its own answer panel);
 * - 'activity': another hosted activity (its finished state is the answer, when it has one);
 * - 'arrange': a module-hosted activity (Arrange tiles, shown solved);
 * - 'code': a code task (the Complete code or complete stage).
 */
export function teacherAnswerKind(task) {
  if (!task) return null
  if (task.taskType === 'information') return 'info'
  if (isHostedActivityTask(task)) {
    const id = getTaskActivity(task)?.id
    if (id === MULTIPLE_CHOICE_ACTIVITY) return 'choice'
    if (id === SHORT_ANSWER_ACTIVITY) return 'short'
    return 'activity'
  }
  if (getModuleHostedActivityUi(task)?.StudentView) return 'arrange'
  return 'code'
}

/**
 * The teacher-editor tab that holds a code task's model answer: the module's separate
 * Complete tab when it has one, else the stage whose role is 'complete'. Null without one.
 * `definition` is the task's module definition (getModuleDefinition / getLessonModule).
 */
export function answerTabFor(definition, task) {
  if (!task) return null
  if (definition?.lifecycle?.teacherCompleteTab?.(task)) return 'complete'
  const stages = Array.isArray(task.codeStages) ? task.codeStages : []
  const index = stages.findIndex((stage) => getStageRole(stage) === 'complete')
  return index >= 0 ? `stage_${index}` : null
}

/** The tabs the Answer / Starter toggle does not cover (support stages); empty = no tab row. */
export function extraStageTabs(task, answerTab) {
  const stages = Array.isArray(task?.codeStages) ? task.codeStages : []
  return stages
    .map((stage, index) => ({ stage, tab: `stage_${index}` }))
    .filter(({ stage, tab }) => tab !== answerTab && getStageRole(stage) !== 'starter')
    .map(({ tab }) => tab)
}

function checkList(check) {
  if (!check) return []
  return Array.isArray(check) ? check : [check]
}

/**
 * The printed output a right answer gives, from the task's output checks: an exact
 * `output_equals` value, else the `output_contains` values (one per line). Null when the
 * checks say nothing about the output.
 */
export function expectedOutputOf(task) {
  const checks = checkList(task?.check)
  const equals = checks.find((c) => c?.type === 'output_equals' && c.value != null)
  if (equals) return String(equals.value)
  const contains = checks
    .filter((c) => c?.type === 'output_contains' && c.value != null && String(c.value) !== '')
    .map((c) => String(c.value))
  return contains.length ? contains.join('\n') : null
}

/**
 * The Python that draws a Stage task's target picture: its `stageTarget` code, else the model
 * answer when it draws on the Stage and never waits for input(). Null for other tasks.
 */
export function stagePictureCode(task, answerCode) {
  const target = task?.stageTarget?.code
  if (typeof target === 'string' && target.trim()) return target
  if (typeof answerCode !== 'string' || !answerCode.trim()) return null
  if (!/^\s*(from\s+stage\s+import|import\s+stage)\b/m.test(answerCode)) return null
  if (/\binput\s*\(/.test(answerCode)) return null
  return answerCode
}

function studentName(student) {
  return student?.displayName || 'A student'
}

/**
 * How the class answered a multiple-choice task: a count per option id, how many answered and
 * how many were right, and the names of those who have not answered yet. `students` are the
 * session's students (their `currentAnswer` is for the task the class is on).
 */
export function tallyChoiceAnswers(task, students = []) {
  const options = Array.isArray(task?.options) ? task.options : []
  const ids = new Set(options.map((option) => option.id))
  const correct = task?.check?.type === 'answer_equals' ? (task.check.value ?? null) : null
  const counts = Object.fromEntries(options.map((option) => [option.id, 0]))
  const notAnswered = []
  let answered = 0
  let right = 0
  for (const student of students) {
    const raw = student?.currentAnswer
    if (typeof raw === 'string' && ids.has(raw)) {
      counts[raw] += 1
      answered += 1
      if (raw === correct) right += 1
    } else {
      notAnswered.push(studentName(student))
    }
  }
  return { counts, answered, right, correct, notAnswered, total: students.length }
}

/** The short-answer model: what its answer check accepts, or null for an open answer. */
export function shortAnswerModel(task) {
  const check = checkList(task?.check).find(
    (c) => typeof c?.type === 'string' && c.type.startsWith('answer_')
  )
  if (!check || check.value == null || String(check.value) === '') return null
  const value = String(check.value)
  if (check.type === 'answer_equals') return { label: 'Model answer', value }
  if (check.type === 'answer_contains') return { label: 'Must contain', value }
  if (check.type === 'answer_matches_regex') return { label: 'Must match', value: `/${value}/` }
  if (check.type === 'answer_not_contains') return { label: 'Must not contain', value }
  if (check.type === 'answer_not_equals') return { label: 'Must not be', value }
  return { label: 'Answer check', value }
}

/** Submitted short answers (name, text, passed) and who has not answered yet. */
export function shortAnswerResponses(students = []) {
  const responses = []
  const notAnswered = []
  for (const student of students) {
    const text = typeof student?.currentAnswer === 'string' ? student.currentAnswer.trim() : ''
    if (student?.lastRunStatus === 'submitted' && text) {
      responses.push({
        id: student.anonymousId,
        name: studentName(student),
        text,
        passed: !!student.checkPassed,
      })
    } else {
      notAnswered.push(studentName(student))
    }
  }
  return { responses, notAnswered }
}
