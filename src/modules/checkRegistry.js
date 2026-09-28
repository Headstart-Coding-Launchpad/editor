// Pure check-type registry. Each module's checks.js exports `CHECKS` — an array of
// check definitions — and src/modules/checks.js builds one registry from them, so
// `evaluateSingleCheck` is a lookup + call instead of an ordered chain of
// array-membership tests. Node-safe (imported by the CLI under plain ESM).
//
// Definition shape:
//   {
//     type,            // canonical check type id
//     owner,           // 'core' | 'module:<type>' | 'activity:<id>' | 'input'
//     subject?, operators?, fields?,  // Builder/authoring metadata
//     aliases?,        // legacy type ids that resolve to this definition
//     timing,          // 'on_run' | 'on_change' | 'on_submit'
//     requiresRun,     // true → the type (and its aliases) need a code run
//     submitAllowed,   // true → allowed in submit-mode (no run) tasks
//     contextKey?,     // the evaluation-context key the check reads (e.g. 'fs')
//     evaluate(check, output, ctx) → boolean,
//     validate?(check, ctx) → string[],
//   }

export const CHECK_TIMINGS = ['on_run', 'on_change', 'on_submit']

const OWNER_PATTERN = /^(core|input|module:[a-z0-9_]+|activity:[a-z0-9_]+)$/

function assertValidDefinition(def) {
  if (!def || typeof def !== 'object') throw new Error('Check definition must be an object')
  if (typeof def.type !== 'string' || !def.type) {
    throw new Error('Check definition is missing a string `type`')
  }
  if (typeof def.owner !== 'string' || !OWNER_PATTERN.test(def.owner)) {
    throw new Error(`Check type "${def.type}" has an invalid owner "${def.owner}"`)
  }
  if (!CHECK_TIMINGS.includes(def.timing)) {
    throw new Error(`Check type "${def.type}" has an invalid timing "${def.timing}"`)
  }
  if (typeof def.evaluate !== 'function') {
    throw new Error(`Check type "${def.type}" is missing an evaluate function`)
  }
  if (def.aliases != null && !Array.isArray(def.aliases)) {
    throw new Error(`Check type "${def.type}" aliases must be an array`)
  }
  if (def.validate != null && typeof def.validate !== 'function') {
    throw new Error(`Check type "${def.type}" validate must be a function`)
  }
}

function freezeDefinition(def) {
  return Object.freeze({
    ...def,
    aliases: Object.freeze([...(def.aliases ?? [])]),
    operators: def.operators ? Object.freeze([...def.operators]) : undefined,
    fields: def.fields ? Object.freeze([...def.fields]) : undefined,
    requiresRun: def.requiresRun === true,
    submitAllowed: def.submitAllowed === true,
  })
}

export function createCheckRegistry(defs = []) {
  const byId = new Map() // canonical types and aliases → definition
  const ordered = []

  function get(type) {
    return (typeof type === 'string' && byId.get(type)) || null
  }

  function registerCheckType(def) {
    assertValidDefinition(def)
    const frozen = freezeDefinition(def)
    const ids = [frozen.type, ...frozen.aliases]
    for (const id of ids) {
      const existing = byId.get(id)
      if (existing || ids.indexOf(id) !== ids.lastIndexOf(id)) {
        throw new Error(
          `Duplicate check type "${id}" (${frozen.owner} conflicts with ${existing?.owner ?? frozen.owner})`
        )
      }
    }
    for (const id of ids) byId.set(id, frozen)
    ordered.push(frozen)
    return frozen
  }

  for (const def of defs) registerCheckType(def)

  // Not frozen on purpose: tests spy on `evaluate` to observe every dispatch.
  return {
    registerCheckType,
    // Resolves a canonical type or an alias to its definition (null when unknown).
    get,
    has(type) {
      return get(type) !== null
    },
    // The canonical type id a type or alias resolves to (null when unknown).
    canonicalType(type) {
      return get(type)?.type ?? null
    },
    list() {
      return [...ordered]
    },
    // Every id (canonical + aliases) whose definition matches `predicate`.
    typeIds(predicate = () => true) {
      return ordered.filter(predicate).flatMap((def) => [def.type, ...def.aliases])
    },
    // Lookup + call. Unknown (or missing) types evaluate to false.
    evaluate(check, output, context = {}) {
      const def = get(check?.type)
      if (!def) return false
      return def.evaluate(check, output, context)
    },
    size() {
      return ordered.length
    },
  }
}
