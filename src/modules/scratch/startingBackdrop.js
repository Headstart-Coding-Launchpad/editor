// Which backdrop the Stage starts on. Pure: no Blockly, no DOM, so the CLI can use it too.
//
// A task's `backdrops[]` lists every backdrop; the one marked `current: true` is showing when
// the task loads (and after a reset). Without a marked one, the first backdrop listed is used,
// which is how every lesson behaved before `current` existed.

export function getStartingBackdrop(backdrops) {
  if (!Array.isArray(backdrops) || backdrops.length === 0) return null
  return backdrops.find((b) => b?.current === true) ?? backdrops[0] ?? null
}

export function getStartingBackdropName(backdrops) {
  return getStartingBackdrop(backdrops)?.name ?? null
}

// Builder: make `id` the starting backdrop. Only that backdrop keeps `current: true`; choosing
// the first backdrop clears the flag everywhere, since the first is the default anyway.
export function setStartingBackdrop(backdrops, id) {
  if (!Array.isArray(backdrops)) return backdrops
  const isFirst = backdrops[0]?.id === id
  return backdrops.map((b) => {
    // eslint-disable-next-line no-unused-vars
    const { current, ...rest } = b ?? {}
    return !isFirst && b?.id === id ? { ...rest, current: true } : rest
  })
}

// Lesson validation: `current` must be true/false, and only one backdrop may be marked.
export function validateStartingBackdrop(task, n, errors, warnings) {
  if (!Array.isArray(task?.backdrops)) return
  const marked = []
  for (const backdrop of task.backdrops) {
    if (backdrop?.current == null) continue
    if (typeof backdrop.current !== 'boolean') {
      errors.push(
        `Task ${n} backdrop "${backdrop.name ?? backdrop.id ?? '?'}" current must be true or false`
      )
      continue
    }
    if (backdrop.current) marked.push(backdrop.name ?? backdrop.id ?? '?')
  }
  if (marked.length > 1)
    warnings.push(
      `Task ${n} has ${marked.length} backdrops marked current (${marked.map((m) => `"${m}"`).join(', ')}); the Stage starts on the first one, "${marked[0]}"`
    )
}
