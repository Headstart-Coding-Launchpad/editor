// Badge contract (docs/architecture/live-badges-plan.md, "Registry (code)"). Every built-in badge
// is a src/badges/definitions/<id>.js exporting defineBadge({...}); the registry
// (./registry.pure.js) lists them. Pure: no JSX, React or DOM.
//
//   defineBadge({
//     id: 'bug_hunter',                 // lowercase identifier, stored in decisions and reports
//     emoji: '🐛',                      // unique across all badges
//     title: 'Bug Hunter',
//     blurb: 'Found and fixed a bug.',  // student card and toast hover
//     ruleText: 'First in class to …',  // the exact rule, shown when a tutor hovers the badge
//     rule: firstInClassOnPattern('debug_code_task'),   // ./rules.js; omit for tutor-only
//     reasonText: ({ taskTitle }) => `First to fix the bug in “${taskTitle}”`,
//     autoAwardable: true,              // eligible for the tutor's auto-award toggle
//     examples: [                       // run for every badge by one generic test
//       { name, timelines, lesson?, decisions?, options?, expect: [['alex', 't3']] },
//     ],
//   })
//
// `reasonText` receives the rule's plain values (taskTitle, plus the rule's own, e.g. `tries`),
// computed when the suggestion is made; the reason string is what a decision stores.

const TUTOR_ONLY_RULE_TEXT = 'Tutor-only: awarded by the tutor, never suggested.'

function fail(id, message) {
  throw new Error(`defineBadge(${id ?? '?'}): ${message}`)
}

function requireString(def, key) {
  if (typeof def[key] !== 'string' || !def[key].trim()) {
    fail(def.id, `missing required string "${key}"`)
  }
}

function normaliseExample(id, example, i) {
  if (!example || typeof example !== 'object') fail(id, `examples[${i}] must be an object`)
  if (typeof example.name !== 'string' || !example.name) fail(id, `examples[${i}] needs a name`)
  if (!example.timelines || typeof example.timelines !== 'object') {
    fail(id, `examples[${i}] needs timelines`)
  }
  if (
    !Array.isArray(example.expect) ||
    example.expect.some((pair) => !Array.isArray(pair) || pair.length !== 2)
  ) {
    fail(id, `examples[${i}].expect must be a list of [studentId, taskId] pairs`)
  }
  return Object.freeze({ ...example })
}

export function defineBadge(def) {
  if (!def || typeof def !== 'object') fail(undefined, 'definition must be an object')
  const { id } = def
  if (typeof id !== 'string' || !/^[a-z][a-z0-9_]*$/.test(id)) {
    fail(id, 'id must be a lowercase identifier (letters, digits, underscores)')
  }
  for (const key of ['emoji', 'title', 'blurb']) requireString(def, key)

  const rule = def.rule ?? null
  if (rule) {
    if (typeof rule.evaluate !== 'function' || typeof rule.kind !== 'string') {
      fail(id, 'rule must come from a src/badges/rules.js helper')
    }
    if (typeof def.reasonText !== 'function') fail(id, 'a rule-backed badge needs reasonText')
    requireString(def, 'ruleText')
    if (!Array.isArray(def.examples) || def.examples.length < 2) {
      fail(id, 'a rule-backed badge needs at least two examples')
    }
  } else {
    if (def.autoAwardable) fail(id, 'only a rule-backed badge can be autoAwardable')
    if (def.examples?.length) fail(id, 'a tutor-only badge has no examples')
  }

  return Object.freeze({
    id,
    emoji: def.emoji,
    title: def.title,
    blurb: def.blurb,
    ruleText: def.ruleText ?? TUTOR_ONLY_RULE_TEXT,
    rule,
    reasonText: def.reasonText ?? null,
    autoAwardable: !!def.autoAwardable,
    tutorOnly: !rule,
    examples: Object.freeze(
      (def.examples ?? []).map((example, i) => normaliseExample(id, example, i))
    ),
  })
}
