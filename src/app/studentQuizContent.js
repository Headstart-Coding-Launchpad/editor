import { getFirstFailedCheckHint } from '../modules/checks'

function parseAnswerState(answer) {
  if (answer && typeof answer === 'object' && !Array.isArray(answer)) return answer
  if (typeof answer === 'string' && answer) {
    try {
      const parsed = JSON.parse(answer)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed
    } catch {}
  }
  return {}
}

function textMatches(value, expected) {
  return (
    String(value ?? '')
      .trim()
      .toLowerCase() ===
    String(expected ?? '')
      .trim()
      .toLowerCase()
  )
}

export function buildQuizSubmission(task, answer) {
  const quizType = task?.quizType ?? 'multiple_choice'

  if (quizType === 'fill_blank') {
    const state = parseAnswerState(answer)
    const mode = task?.mode ?? 'drag'
    const tiles = [
      ...(task?.blanks ?? []).map((blank) => ({ id: blank.id, text: blank.answer })),
      ...(task?.distractors ?? []).map((distractor) => ({
        id: distractor.id,
        text: distractor.text,
      })),
    ]
    return Object.fromEntries(
      (task?.blanks ?? []).map((blank) => {
        const rawValue = state[blank.id]
        const value =
          mode === 'drag'
            ? (tiles.find((tile) => tile.id === rawValue)?.text ?? rawValue ?? '')
            : (rawValue ?? '')
        const expected = blank.answer ?? ''
        const correct =
          mode === 'drag' ? String(value ?? '') === String(expected) : textMatches(value, expected)
        return [blank.id, { value, expected, correct }]
      })
    )
  }

  if (quizType === 'match') {
    const state = parseAnswerState(answer)
    return Object.fromEntries(
      (task?.pairs ?? []).map((pair) => {
        const placedId = state[pair.id]
        const placedPair = (task?.pairs ?? []).find((candidate) => candidate.id === placedId)
        const value = placedPair?.answer ?? placedId ?? ''
        const expected = pair.answer ?? ''
        return [
          pair.id,
          {
            prompt: pair.prompt ?? '',
            value,
            expected,
            correct: placedId === pair.id,
          },
        ]
      })
    )
  }

  if (quizType === 'confidence') {
    const rating = Number(answer)
    return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : answer
  }

  if (quizType === 'short_answer') {
    return typeof answer === 'string' ? answer : String(answer ?? '')
  }

  return typeof answer === 'string' ? answer : String(answer ?? '')
}

export function getQuizSuggestion(task, answer) {
  if (!task) return ''
  if ((task.quizType ?? 'multiple_choice') === 'multiple_choice') {
    const option = task.options?.find((o) => o.id === answer)
    return String(
      option?.feedback ?? option?.hint ?? task.feedback ?? task.check?.hint ?? ''
    ).trim()
  }
  if (task.quizType === 'short_answer' && task.check) {
    return getFirstFailedCheckHint(task.check, answer, {
      answer: typeof answer === 'string' ? answer : '',
    })
  }
  return String(task.feedback ?? task.check?.hint ?? '').trim()
}
