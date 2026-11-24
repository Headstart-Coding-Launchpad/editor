// Click-the-line quiz helpers (quizType code_lines): the code's rows, the stored pick ("3", or
// "[4,5]" in pick order, '' before picking), marking and the lesson rules. Pure: used by the
// definition, the quiz UI, the shared quiz validator (legacyValidation.js) and the CLI.
const MAX_LINES = 12
export const codeRows = (task) => String(task?.code ?? '').split(/\r\n?|\n/)
export const correctLinesOf = (task) => (Array.isArray(task?.correctLines) ? task.correctLines : [])
export const pickCountOf = (task) => task?.pick ?? Math.max(1, correctLinesOf(task).length)

/** The picked line numbers in a stored answer ("3" or "[4,5]"); [] for anything else. */
export function parseLinePicks(raw) {
  let value = raw
  try {
    value = typeof raw === 'string' && raw.startsWith('[') ? JSON.parse(raw) : raw
  } catch {
    return []
  }
  const list = Array.isArray(value) ? value : String(value ?? '').trim() ? [Number(value)] : []
  return list.filter((n) => Number.isInteger(n) && n > 0)
}

export const encodeLinePicks = (picks) =>
  picks.length === 0 ? '' : picks.length === 1 ? String(picks[0]) : JSON.stringify(picks)

export const linesLabel = (picks) =>
  picks.length === 1
    ? `Line ${picks[0]}`
    : `Lines ${picks.slice(0, -1).join(', ')} and ${picks.at(-1)}`

/** `{ passed, suggestion }`: the picks match correctLines in any order. A wrong pick's words are
 * its lineFeedback, else the task's feedback, else its explanation. */
export function gradeLinePicks(task, answer) {
  const picks = parseLinePicks(answer)
  const right = correctLinesOf(task)
  const passed = picks.length === right.length && right.every((n) => picks.includes(n))
  const wrong = picks.find((n) => !right.includes(n))
  const feedback = task?.lineFeedback?.[wrong] ?? task?.feedback ?? task?.explanation ?? ''
  return { passed, suggestion: passed ? '' : String(feedback).trim() }
}

// The lesson rules, in the shared quiz validator's shape (legacyValidation.js validateQuizTask).
export function validateCodeLinesTask(task, { n, errors, warnings = [] }) {
  const say = (text) => `Task ${n} is a code-lines quiz ${text}`
  const size = codeRows(task).length
  const right = correctLinesOf(task)
  if (!String(task?.code ?? '').trim()) errors.push(say('but has no code'))
  if (!right.length)
    errors.push(say('but has no correctLines (list the line numbers to pick, e.g. [3])'))
  for (const line of right.filter((v) => !Number.isInteger(v) || v < 1 || v > size))
    errors.push(
      say(`but correctLines has ${line}, which is not a line of its code (it has ${size} lines)`)
    )
  if (new Set(right).size !== right.length) errors.push(say('but correctLines lists a line twice'))
  if (task?.pick != null && task.pick !== right.length) {
    const has = `${right.length} line${right.length === 1 ? '' : 's'}`
    errors.push(
      say(
        `but pick is ${task.pick} and correctLines has ${has} (leave pick out, or make them match)`
      )
    )
  }
  for (const key of Object.keys(task?.lineFeedback ?? {})) {
    const line = Number(key)
    if (right.includes(line))
      warnings.push(
        say(`but lineFeedback has line ${key}, which is a correct line (it is never shown)`)
      )
    else if (!(Number.isInteger(line) && line >= 1 && line <= size))
      warnings.push(say(`but lineFeedback has line ${key}, which is not a line of its code`))
  }
  if (size > MAX_LINES)
    warnings.push(
      `Task ${n} is a code-lines quiz with ${size} lines; keep it to ${MAX_LINES} or fewer so it fits the screen`
    )
}
