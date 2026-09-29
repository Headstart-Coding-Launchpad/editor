# ADR 0009: Activity registry

## Status

Accepted (modular activities plan, Phase 2; `code_arrange` joined in step 4.9).

## Context

Quizzes and `code_arrange` were hard-coded task types: about 66 branch sites across 18 files
decided how each one validated, rendered, synced, graded, printed and converted to YAML. New
bounded exercises (Binary, Keyboard, Mouse) would have multiplied those branches. They also
differ from workspace modules: a student completes a defined target inside one task, with no
artefact carried to later tasks, no sandbox and no playground.

## Decision

Bounded exercises are **activities**, one folder each under `src/activities/<id>/`, registered
in two registries:

- `registry.pure.js` imports every Node-safe `definition.js` (built by `defineActivity`): state,
  serialisation, grading, validation, YAML, reports, print. The CLI, validation, reports and the
  YAML converter import only this.
- `registry.js` merges each definition with its `ui.jsx` for the app.

New tasks are stored as `taskType: 'activity'` + `activityType: '<id>'` (YAML shorthand
`type: <id>`). Legacy data never changes: `resolve.js` maps `taskType: 'quiz'` + `quizType` to
`quiz_<type>` and `taskType: 'code_arrange'` to `code_arrange`, and each legacy activity
declares its `legacy.taskType` / `yaml.type`, which the YAML converter reads instead of naming
them. An unknown `activityType` resolves to a controlled "not available" fallback.
`ActivityHost` + `useActivityState` own persistence, live sync (discrete vs continuous changes),
grading, force/reset and teacher edits once for every activity; an activity with `hostModules`
(`code_arrange`) runs inside that workspace module instead. `npm run new:activity` scaffolds a
new one from `src/activities/_template/`.

## Consequences

- Core code asks the registry (`getTaskActivity`, `isHostedActivityTask`,
  `isModuleHostedActivityTask`, `isLegacyQuizTask`, `legacyTaskTypeForYamlType`, …) rather than
  comparing `taskType`; the type-branch ratchet and ESLint rule enforce it outside the plugin
  folders.
- Adding an activity is one folder plus one import line in each registry;
  `activityInterface.test.js` fails if a folder isn't registered or breaks the contract.
- Stored lesson, localStorage and Realtime Database formats are unchanged; activity state rides
  the existing `currentAnswer` field and per-task aux file.
- See [docs/architecture/activities.md](../architecture/activities.md).
