// Pure logic for the Template Activity activity: task validation, solutions, grading and hints.
// Node-safe (no React, JSX or DOM) so the CLI, the Builder and print share it.
//
// This file is the scaffold from `npm run new:activity`. The starter behaviour is a working
// "type the answer" exercise so every check passes straight away; replace it with the real
// exercise. Search for TODO(new-activity) to find every place to change.

// TODO(new-activity): replace the starter item shape ({ id, prompt, answer }) with the fields
// your activity needs, and document each one in docs/authoring/activities/template_activity.md.

export function normalizeAnswer(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
}

// The correct answer for one item, in the same shape the student produces it.
export function solutionFor(task, item) {
  return { answer: String(item?.answer ?? '') }
}

// Authoring validation shared by the Builder and the CLI. `n` is the 1-based task number.
// Every message pushed here must be listed in docs/authoring/validation-errors.md
// (validationErrorsDoc.test.js checks it), with `…` in place of each ${...}.
export function validateTemplateActivityTask(task, n) {
  const errors = []
  const where = `Task ${n}`
  const items = Array.isArray(task?.items) ? task.items : []
  if (items.length === 0) errors.push(`${where}: template_activity task needs at least one item.`)
  const seen = new Set()
  items.forEach((item, i) => {
    const label = `${where} item ${i + 1}`
    const id = item?.id
    if (id == null || id === '') errors.push(`${label}: needs an id.`)
    else if (seen.has(String(id))) errors.push(`${label}: id "${id}" is used more than once.`)
    seen.add(String(id))
    if (typeof item?.prompt !== 'string' || !item.prompt.trim()) {
      errors.push(`${label}: prompt is required.`)
    }
    if (item?.answer == null || String(item.answer).trim() === '') {
      errors.push(`${label}: answer is required.`)
    }
  })
  return errors
}

// Grade one item. Hints are short, plain words for 8-14 year olds and never give the answer
// away. TODO(new-activity): write hints that point at the student's actual mistake.
export function gradeItem(task, item, itemState = {}) {
  const entered = normalizeAnswer(itemState?.answer)
  if (entered === normalizeAnswer(solutionFor(task, item).answer)) {
    return { correct: true, hint: null }
  }
  if (!entered) return { correct: false, hint: 'Type your answer first.' }
  return { correct: false, hint: 'Not quite. Read the question again and have another go.' }
}

// Whole-task progress for the teacher card and completion: { total, correct, done }.
export function gradeTask(task, state = {}) {
  const items = task?.items ?? []
  const correct = items.filter((item) => gradeItem(task, item, state?.items?.[item.id]).correct)
  return {
    total: items.length,
    correct: correct.length,
    done: items.length > 0 && correct.length === items.length,
  }
}
