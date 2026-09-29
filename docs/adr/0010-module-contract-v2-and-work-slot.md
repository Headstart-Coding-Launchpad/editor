# ADR 0010: Module contract v2 and the generic work slot

## Status

Accepted (modular activities plan, Phase 4, steps 4.1–4.8). Extends
[ADR 0004](0004-lesson-type-module-registry.md).

## Context

ADR 0004 put each lesson type in its own folder, but the classroom still branched on the type:
about 385 inline `lesson.type === '…'` comparisons in 41 files, with the worst in
`useStudentCodeState` (~100) and `TeacherView` (~42). Each new module (Turtle, Arcade, Desktop,
Electronics) needed 20–38 files changed outside its folder and follow-up fixes for the surfaces
it missed.

## Decision

A module's definition (`src/modules/<type>/definition.js`, pure and Node-safe, validated and
frozen by `defineModule`) describes everything core code needs, in named groups:

- `meta` and `capabilities` — labels, icons, picker order, code language, and every UI gate the
  student, teacher and Builder surfaces read (explainer layout, stage reveal, mirrors, teacher
  editor, run kind, teacher layout flags).
- `authoring` — what the Builder does with the module's tasks (new-task fields, print, sandbox
  starter editor, Builder run, draft notices).
- `lifecycle` — reset targets, complete solutions, sandbox starters, composed-lesson fields,
  personal sandbox, playground task.
- `storage` and `wire` — adapters onto the unchanged localStorage record shapes and Realtime
  Database strings (`currentCode` / `sandboxCode`, `sandboxFiles`, teacherLive extras).
- `checking` and `workSlot` — when the task check runs and where the work comes from.

`useStudentCodeState` keeps one **generic work slot** (`{ moduleType, taskId, value }`) and one
change pipeline (`handleWorkChange` / `evaluateAndReport`, `handleRun` dispatching on
`capabilities.run`, `reportRun`) for every module, instead of per-module state and handlers.
TeacherView, the sandbox push, teacherLive publishing and sharing go through the same `wire`.

Outside `src/modules/**` and `src/activities/**`, core code never compares against a module or
task type name: the type-branch ratchet (`typeBranchRatchet.test.js`) is at zero there, and an
ESLint `no-restricted-syntax` rule rejects new comparisons (the Builder included, through the
`authoring` group). New modules are scaffolded with `npm run new:module` from
`src/modules/_template/`.

## Consequences

- Adding a module is its folder plus registration lines (the generator writes them); a surface
  it doesn't support is a capability left off, recorded in `moduleTypeParity`'s `KNOWN_GAPS`.
- A new behaviour difference between modules becomes a definition field with a default in
  `defineModule.js`, never an inline type check.
- Stored data and wire formats did not change; Phase 0 characterisation tests pin the bytes.
- See [docs/architecture/lesson-type-modules.md](../architecture/lesson-type-modules.md).
