// Where a student's sprites, backdrop and variables stood when their Scratch workspace unmounted
// (for a classmate's shared work), so Back puts them there. Pen trails are not restored. Keyed by
// student + task, kept only if the task's authored sprites are unchanged, newest 20 kept.
const memory = new Map()
const MAX_ENTRIES = 20

const fingerprint = (sprites) => JSON.stringify(sprites ?? [])

export function rememberRuntime(key, task, data) {
  memory.delete(key)
  if (!data) return
  memory.set(key, { fp: fingerprint(task?.sprites), data })
  if (memory.size > MAX_ENTRIES) memory.delete(memory.keys().next().value)
}

export function recallRuntime(key, task) {
  const entry = memory.get(key)
  return entry && entry.fp === fingerprint(task?.sprites) ? entry.data : null
}
