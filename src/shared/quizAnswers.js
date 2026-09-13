// Reading a student's stored quiz answer. The answer arrives either as an object or as
// the JSON string it was persisted as, and is compared case- and whitespace-insensitively
// — the same three places (live quiz UI, submission building, lesson reports) each used
// to carry their own copy of both rules.

export function parseQuizAnswerState(answer) {
  if (answer && typeof answer === 'object' && !Array.isArray(answer)) return answer
  if (typeof answer === 'string' && answer) {
    try {
      const parsed = JSON.parse(answer)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    } catch {}
  }
  return {}
}

export function answerTextMatches(value, expected) {
  return (
    String(value ?? '')
      .trim()
      .toLowerCase() ===
    String(expected ?? '')
      .trim()
      .toLowerCase()
  )
}
