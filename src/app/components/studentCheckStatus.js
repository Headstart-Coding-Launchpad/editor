// One answer to "did this student pass, fail or crash the current task?", shared by the
// student card (its chips) and the grid header (its counts) so the two never disagree (#242:
// the header used to count raw checkPassed, so an overridden or submitted student was missed).
//
// Rules, in order: a task marked never (a confidence rating) or a session sandbox has no
// pass/fail; a tutor override outranks the run result; a run that crashed is "errored", not
// "failed", because the check never got a fair go; an activity with its own marking counts
// once it is submitted.
export function deriveStudentCheckStatus({
  student,
  currentTask,
  isNeverMarked = false,
  isSessionSandbox = false,
  activitySubmitted = false,
}) {
  const hasCheck =
    !isNeverMarked &&
    !isSessionSandbox &&
    (currentTask?.check != null || (activitySubmitted && student?.checkPassed != null))
  const checkAttempted = student?.lastRunStatus != null
  const hasActiveOverride = !!student?.checkOverridePushedAt
  const passed =
    hasCheck &&
    (hasActiveOverride ? student.checkOverridePassed === true : student?.checkPassed === true)
  const errored =
    !isSessionSandbox && !hasActiveOverride && !passed && student?.lastRunStatus === 'error'
  const failed =
    hasCheck &&
    !errored &&
    (hasActiveOverride
      ? student.checkOverridePassed === false
      : checkAttempted && student?.checkPassed !== true)
  return { hasCheck, checkAttempted, hasActiveOverride, passed, failed, errored }
}
