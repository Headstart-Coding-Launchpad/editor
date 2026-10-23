// "N of M done" for the class's current task: the same rule the tutor dashboard uses for its
// passed count (StudentGrid: a student whose checks passed, or whom the tutor marked passed).
// Counts only, never names. The presentation window's pseudo-student is not counted.
import { TEACHER_PRESENTER_ID } from './presenter.js'

export function countCurrentTaskDone(session) {
  const students = Object.entries(session?.students ?? {}).filter(
    ([id]) => id !== TEACHER_PRESENTER_ID
  )
  const done = students.filter(
    ([, s]) => s?.checkPassed === true || s?.checkOverridePassed === true
  ).length
  return { done, total: students.length }
}
