// Pure logic for the Real or AI activity: task validation, solutions, grading and feedback.
// Node-safe (no React, JSX or DOM) so the CLI, the Builder and print share it.
//
// Each item shows a pair (two pictures or two texts, `a` and `b`). The student picks which one
// is AI-made, then picks the "tell" (the clue) from the task's `tells` list, then reveals. The
// item is then locked: the reveal says whether the pick was right, whether the tell matches the
// author's, whether that tell is reliable, and shows the author's `reveal` text.
//
// Item state: { pick: 'a' | 'b' | '', tell: '', done: boolean }. Picks and tells are saved as
// the student goes (so the tutor sees them live); `done` is set by Reveal.

export const ITEM_KINDS = ['image', 'text']
export const SIDES = ['a', 'b']

export function kindOf(item) {
  return item?.kind === 'text' ? 'text' : 'image'
}

// 'too_smooth' -> 'Too smooth'. A tell with spaces or capitals is shown as written.
export function tellLabel(tell) {
  const text = String(tell ?? '').trim()
  if (!text) return ''
  if (!/^[a-z0-9_]+$/.test(text)) return text
  const spaced = text.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function tellsOf(task) {
  return Array.isArray(task?.tells) ? task.tells.filter((t) => typeof t === 'string' && t) : []
}

export function sideLabel(side) {
  return side === 'b' ? 'B' : 'A'
}

// The finished state of one item, as if the student answered it correctly.
export function solutionFor(task, item) {
  return { pick: item?.answer === 'b' ? 'b' : 'a', tell: String(item?.tell ?? ''), done: true }
}

// Authoring validation shared by the Builder and the CLI. `n` is the 1-based task number.
// Every message pushed here must be listed in docs/authoring/validation-errors.md
// (validationErrorsDoc.test.js checks it), with `…` in place of each ${...}.
export function validateRealOrAiTask(task, n) {
  const errors = []
  const where = `Task ${n}`
  const tells = Array.isArray(task?.tells) ? task.tells : []
  const tellOk = new Set()
  if (tells.length < 2) {
    errors.push(`${where}: tells needs at least two entries.`)
  }
  tells.forEach((tell, i) => {
    if (typeof tell !== 'string' || !tell.trim()) {
      errors.push(`${where}: tell ${i + 1} must be a non-empty string.`)
    } else if (tellOk.has(tell)) {
      errors.push(`${where}: tell "${tell}" is listed more than once.`)
    } else {
      tellOk.add(tell)
    }
  })
  const items = Array.isArray(task?.items) ? task.items : []
  if (items.length === 0) errors.push(`${where}: real_or_ai task needs at least one item.`)
  const seen = new Set()
  items.forEach((item, i) => {
    const label = `${where} item ${i + 1}`
    const id = item?.id
    if (id == null || id === '') errors.push(`${label}: needs an id.`)
    else if (seen.has(String(id))) errors.push(`${label}: id "${id}" is used more than once.`)
    seen.add(String(id))
    if (item?.kind != null && !ITEM_KINDS.includes(item.kind)) {
      errors.push(`${label}: kind must be image or text.`)
    }
    if (typeof item?.a !== 'string' || !item.a.trim()) errors.push(`${label}: a is required.`)
    if (typeof item?.b !== 'string' || !item.b.trim()) errors.push(`${label}: b is required.`)
    if (!SIDES.includes(item?.answer)) errors.push(`${label}: answer must be a or b.`)
    if (typeof item?.tell !== 'string' || !item.tell.trim()) {
      errors.push(`${label}: tell is required.`)
    } else if (tells.length >= 2 && !tellOk.has(item.tell)) {
      errors.push(`${label}: tell "${item.tell}" is not in the task's tells list.`)
    }
    if (typeof item?.reliable !== 'boolean') {
      errors.push(`${label}: reliable must be true or false.`)
    }
    if (typeof item?.reveal !== 'string' || !item.reveal.trim()) {
      errors.push(`${label}: reveal is required.`)
    }
    if (item?.altA != null && typeof item.altA !== 'string') {
      errors.push(`${label}: altA must be text.`)
    }
    if (item?.altB != null && typeof item.altB !== 'string') {
      errors.push(`${label}: altB must be text.`)
    }
  })
  return errors
}

// Grade one item. `done` means revealed; `correct` means the right one was picked as AI.
// `tellMatches` means the student's tell is the author's tell. `hint` is what the student still
// has to do (never the answer).
export function gradeItem(task, item, itemState = {}) {
  const pick = SIDES.includes(itemState?.pick) ? itemState.pick : ''
  const tell = typeof itemState?.tell === 'string' ? itemState.tell : ''
  const done = itemState?.done === true && !!pick && !!tell
  const correct = done && pick === item?.answer
  const tellMatches = done && tell === item?.tell
  let hint = null
  if (!done) {
    if (!pick) hint = 'Pick the picture or text you think the AI made.'
    else if (!tell) hint = 'Now pick the clue that gave it away.'
    else hint = 'Press Reveal to see if you were right.'
  }
  return { done, correct, tellMatches, hint }
}

// Whole-task progress for the teacher card and completion:
// { total, done, correct, tellsMatched, finished }.
export function gradeTask(task, state = {}) {
  const items = task?.items ?? []
  const results = items.map((item) => gradeItem(task, item, state?.items?.[item.id]))
  return {
    total: items.length,
    done: results.filter((r) => r.done).length,
    correct: results.filter((r) => r.correct).length,
    tellsMatched: results.filter((r) => r.tellMatches).length,
    finished: items.length > 0 && results.every((r) => r.done),
  }
}

// What the student sees after revealing one item: plain sentences, in order.
export function revealLines(task, item, itemState) {
  const result = gradeItem(task, item, itemState)
  if (!result.done) return null
  const aiSide = sideLabel(item.answer)
  const pickLine = result.correct
    ? `Yes! ${aiSide} is the AI one.`
    : `Not this time. ${aiSide} is the AI one.`
  const tellLine = result.tellMatches
    ? `Your clue matches: ${tellLabel(item.tell)}.`
    : `You said "${tellLabel(itemState.tell)}". The clue to look for here was "${tellLabel(item.tell)}".`
  const reliableLine = item.reliable
    ? `"${tellLabel(item.tell)}" is a reliable clue.`
    : `"${tellLabel(item.tell)}" is not a reliable clue. Don't rely on it by itself.`
  return {
    pickLine,
    tellLine,
    reliableLine,
    reveal: item.reveal,
    correct: result.correct,
    tellMatches: result.tellMatches,
  }
}

// The first item that is not revealed yet (or the last item when all are).
export function firstOpenIndex(task, state) {
  const items = task?.items ?? []
  const index = items.findIndex((item) => !gradeItem(task, item, state?.items?.[item.id]).done)
  return index === -1 ? Math.max(0, items.length - 1) : index
}

// Plain-text summary for the teacher card: the running score plus the item in progress.
export function summaryText(task, state) {
  const { total, done, correct, finished } = gradeTask(task, state)
  if (finished) return `${correct}/${total} right`
  const items = task?.items ?? []
  const open = items[firstOpenIndex(task, state)]
  const st = open ? state?.items?.[open.id] : null
  const bits = []
  if (st?.pick) bits.push(`picked ${sideLabel(st.pick)}`)
  if (st?.tell) bits.push(tellLabel(st.tell))
  const live = bits.length ? `, item ${firstOpenIndex(task, state) + 1}: ${bits.join(', ')}` : ''
  return `${correct}/${done} right so far${live}`
}
