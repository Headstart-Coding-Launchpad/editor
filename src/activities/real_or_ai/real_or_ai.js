// Pure logic for the Real or AI activity: task validation, solutions, grading and feedback.
// Node-safe (no React, JSX or DOM) so the CLI, the Builder and print share it.
//
// Each item shows a pair (two pictures or two texts, `a` and `b`). One tap picks the one the
// student thinks is AI and reveals the answer at once: a tick or cross plus a one-line note on
// the pair's `tell` (and whether that tell is reliable, if the author said). The round moves on
// by itself (src/activities/round.js): the core pairs, then optional bonus pairs.
//
// Item state: { pick: 'a' | 'b' | '', done: boolean }. A pick sets both at once, so the tutor
// sees it the moment it is made. State also holds `right`, a count of right picks that only ever
// goes up (no streaks to lose; Play again keeps it).
//
// Old lessons: a task-level `tells` list and a per-pair `tell` choice used to feed a second
// "which tell?" question. That question is gone; `tells` is ignored and `tell` is now only the
// text of the note shown after the reveal.
import { coreCountOf, roundSummaryText, validateCoreItems } from '../round.js'

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

export function sideLabel(side) {
  return side === 'b' ? 'B' : 'A'
}

// The finished state of one item, as if the student answered it correctly.
export function solutionFor(task, item) {
  return { pick: item?.answer === 'b' ? 'b' : 'a', done: true }
}

// Authoring validation shared by the Builder and the CLI. `n` is the 1-based task number.
// Every message pushed here must be listed in docs/authoring/validation-errors.md
// (validationErrorsDoc.test.js checks it), with `…` in place of each ${...}.
export function validateRealOrAiTask(task, n) {
  const errors = []
  const where = `Task ${n}`
  const items = Array.isArray(task?.items) ? task.items : []
  if (items.length === 0) errors.push(`${where}: real_or_ai task needs at least one item.`)
  const coreError = validateCoreItems(task, where, items.length)
  if (coreError && items.length > 0) errors.push(coreError)
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
    if (item?.tell != null && typeof item.tell !== 'string') {
      errors.push(`${label}: tell must be text.`)
    }
    if (item?.reliable != null && typeof item.reliable !== 'boolean') {
      errors.push(`${label}: reliable must be true or false.`)
    }
    if (item?.reveal != null && typeof item.reveal !== 'string') {
      errors.push(`${label}: reveal must be text.`)
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

// Grade one item. `done` means the student has picked (the reveal is instant); `correct` means
// they picked the AI side. `hint` is what the student still has to do (never the answer).
export function gradeItem(task, item, itemState = {}) {
  const pick = SIDES.includes(itemState?.pick) ? itemState.pick : ''
  const done = itemState?.done === true && !!pick
  const correct = done && pick === item?.answer
  return { done, correct, hint: done ? null : 'Tap the one you think the AI made.' }
}

// Whole-task progress for the teacher card and completion:
// { total, core, done, correct, finished, passed }. The task passes once the core pairs are
// done; `finished` is every pair (core and bonus) done.
export function gradeTask(task, state = {}) {
  const items = task?.items ?? []
  const results = items.map((item) => gradeItem(task, item, state?.items?.[item.id]))
  const core = coreCountOf(task, items.length)
  const done = results.filter((r) => r.done).length
  return {
    total: items.length,
    core,
    done,
    correct: results.filter((r) => r.correct).length,
    finished: items.length > 0 && done === items.length,
    passed: items.length > 0 && done >= core,
  }
}

// The right picks so far. Never goes down: `state.right` is kept across Play again, and a
// tutor's edit can only raise it.
export function rightCount(task, state) {
  const saved = Number.isInteger(state?.right) && state.right > 0 ? state.right : 0
  return Math.max(saved, gradeTask(task, state).correct)
}

// The one-line note on the tell, as a short sentence, or '' when the pair has no tell.
export function tellNote(item) {
  const tell = tellLabel(item?.tell)
  if (!tell) return ''
  if (item.reliable === true) return `The tell: ${tell}. It is a fair clue to look for.`
  if (item.reliable === false) return `The tell: ${tell}. Don't rely on it by itself.`
  return `The tell: ${tell}.`
}

// What the student sees right after tapping: a verdict (tick or cross plus a word), which side
// was AI, the tell note and the author's optional extra note. Null before the pick.
export function revealInfo(task, item, itemState) {
  const result = gradeItem(task, item, itemState)
  if (!result.done) return null
  const reveal = typeof item.reveal === 'string' ? item.reveal.trim() : ''
  return {
    correct: result.correct,
    mark: result.correct ? '✓' : '✗',
    verdict: result.correct ? 'Right!' : 'Not this time',
    aiLine: `${sideLabel(item.answer)} is the AI one.`,
    note: tellNote(item),
    reveal,
  }
}

// Plain-text summary for the teacher card: "3/5 done · 2 right" (+ bonus after the core).
export function summaryText(task, state) {
  const { total, core, done, correct } = gradeTask(task, state)
  return `${roundSummaryText(done, total, core)} · ${correct} right`
}
