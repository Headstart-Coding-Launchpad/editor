// Pure helpers for an activity "round": a single goal of a few reps (the core) that moves on by
// itself, then optional bonus reps. Shared by keyboard, binary and mouse (task.coreItems) and the
// round UI (ui/RoundProgress.jsx, ui/useRoundFlow.js). Node-safe: no JSX, React or DOM.

// How many items make the round's goal: task.coreItems when it is a valid whole number from 1 up
// (capped at the items there are), otherwise all of them.
export function coreCountOf(task, total) {
  const core = task?.coreItems
  if (Number.isInteger(core) && core >= 1) return Math.min(core, total)
  return total
}

// The consistent progress wording for every activity: "3 of 5 done", then "5 of 5 done · +2 bonus"
// once the core is met and bonus reps are being played.
export function roundText(done, total, core = total) {
  const goal = Math.min(core, total)
  if (goal < total && done > goal) return `${goal} of ${goal} done · +${done - goal} bonus`
  return `${Math.min(done, goal)} of ${goal} done`
}

// The teacher-card text for a round: "3/5 done", plus "+2 bonus" after the core.
export function roundSummaryText(done, total, core, noun = 'done') {
  const goal = Math.min(core, total)
  const base = `${Math.min(done, goal)}/${goal} ${noun}`
  return goal < total && done > goal ? `${base} · +${done - goal} bonus` : base
}

// Validates task.coreItems against the number of authored items. Returns an error string or null.
export function validateCoreItems(task, where, itemCount) {
  if (task?.coreItems == null) return null
  if (!Number.isInteger(task.coreItems) || task.coreItems < 1 || task.coreItems > itemCount) {
    return `${where}: coreItems must be a whole number from 1 to ${itemCount} (the number of items).`
  }
  return null
}
