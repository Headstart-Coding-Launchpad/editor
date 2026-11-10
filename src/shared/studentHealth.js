/**
 * A student's screen health, for the tutor (deep review 2026-11-10, R3; field OK'd by Ryan
 * 10 Nov): students/{anonymousId}/health = 'ok' | 'python_stuck' | 'screen_error'. The student's
 * own screen writes it once on a change (useSession.writeStudentHealth): Python stuck or failed
 * to load (useStudentCodeState), or a render error caught by RenderErrorBoundary. Never per
 * keystroke, never on a timer. The tutor's card, row, header count and Student View banner read
 * it through these helpers.
 */

export const STUDENT_HEALTH = Object.freeze({
  ok: 'ok',
  pythonStuck: 'python_stuck',
  screenError: 'screen_error',
})

const VALUES = Object.values(STUDENT_HEALTH)

export function isStudentHealth(value) {
  return VALUES.includes(value)
}

/**
 * The problem to show for a student ('python_stuck' | 'screen_error'), or null. Only while they
 * are online: an offline student's chip is Offline, and their next page clears the field.
 */
export function studentHealthProblem(student) {
  if (!student?.online) return null
  const health = student.health
  return health === STUDENT_HEALTH.pythonStuck || health === STUDENT_HEALTH.screenError
    ? health
    : null
}

const CHIPS = {
  python_stuck: {
    icon: '🐍',
    label: 'Python stuck',
    title: 'Python stopped working on their screen. Their code is safe: they can tap Reload.',
  },
  screen_error: {
    icon: '🛠️',
    label: 'Screen error',
    title: 'Part of their screen hit an error. They can tap Try again.',
  },
}

/** The chip for a problem: { icon, label, title }, or null. */
export function studentHealthChip(problem) {
  return CHIPS[problem] ?? null
}

/** The Student View banner line for a problem, or null. */
export function studentHealthBanner(problem, name) {
  const who = name || 'This student'
  if (problem === STUDENT_HEALTH.pythonStuck) {
    return `🐍 ${who}'s Python stopped working. Their code is safe: they see a Reload button.`
  }
  if (problem === STUDENT_HEALTH.screenError) {
    return `🛠️ Part of ${who}'s screen hit an error. They see a Try again button.`
  }
  return null
}
