// Field declarations: a task shape as data, so `lessons capabilities`, docs checks and lesson
// tooling read one source instead of prose. Used by activity definitions (`fields`), module
// definitions (`taskFields`) and the shared task-type lists (./taskFields.js). Pure.
//
//   FieldSpec: {
//     name, type,            // type: string | number | boolean | array | object
//     required?,             // validation fails without it (validateTask stays the rule of record)
//     authored?,             // lesson content (prompts, text, answers, starter/complete work)
//                            // rather than a setting
//     values?,               // allowed values
//     modes?,                // only used in these modes (activities with a mode field)
//     itemFields?,           // for arrays of objects: the fields of each item (FieldSpecs)
//     description?,
//   }

export const FIELD_TYPES = ['string', 'number', 'boolean', 'array', 'object']

export function normaliseFieldSpecs(list, { where = 'fields', modes = [], fail } = {}) {
  const error = fail ?? ((message) => new Error(message))
  const raise = (message) => {
    throw error(`${where}: ${message}`)
  }
  if (!Array.isArray(list)) raise('must be an array')
  const seen = new Set()
  return Object.freeze(
    list.map((spec) => {
      if (!spec?.name || typeof spec.name !== 'string') raise('a field is missing its name')
      if (seen.has(spec.name)) raise(`duplicate field "${spec.name}"`)
      seen.add(spec.name)
      if (!FIELD_TYPES.includes(spec.type)) {
        raise(`${spec.name}: type must be one of ${FIELD_TYPES.join(', ')}`)
      }
      for (const mode of spec.modes ?? []) {
        if (!modes.includes(mode)) raise(`${spec.name}: unknown mode "${mode}"`)
      }
      if (spec.itemFields && spec.type !== 'array') raise(`${spec.name}: itemFields need an array`)
      return Object.freeze({
        ...spec,
        required: !!spec.required,
        authored: !!spec.authored,
        ...(spec.values ? { values: Object.freeze([...spec.values]) } : {}),
        ...(spec.modes ? { modes: Object.freeze([...spec.modes]) } : {}),
        ...(spec.itemFields
          ? {
              itemFields: normaliseFieldSpecs(spec.itemFields, {
                where: `${where}.${spec.name}[]`,
                modes,
                fail,
              }),
            }
          : {}),
      })
    })
  )
}

// Paths of the authored fields, e.g. ['items', 'items[].text', 'items[].prompt'].
export function authoredFieldPaths(specs, prefix = '') {
  return (specs ?? []).flatMap((spec) => {
    const path = `${prefix}${spec.name}`
    return [...(spec.authored ? [path] : []), ...authoredFieldPaths(spec.itemFields, `${path}[].`)]
  })
}

// The fields that apply in one mode (fields without `modes` apply in all), nested lists included.
export function fieldsForMode(specs, mode) {
  return (specs ?? [])
    .filter((spec) => !spec.modes || spec.modes.includes(mode))
    .map((spec) =>
      spec.itemFields ? { ...spec, itemFields: fieldsForMode(spec.itemFields, mode) } : spec
    )
}

// Plain-JSON copy of specs for CLI output (drops undefined keys).
export function describeFieldSpecs(specs) {
  return JSON.parse(JSON.stringify(specs ?? []))
}
