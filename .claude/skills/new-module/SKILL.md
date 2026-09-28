---
name: new-module
description: Placeholder for adding a new workspace module (lesson type such as python, turtle, filesystem) to the Headstart Coding platform. Use when asked to "build a new module", "add a lesson type", "new workspace module", or when an authoring request (docs/authoring/authoring-requests/*.md) has Kind module. Explains that modules are not scaffoldable yet and gives the current manual checklist. For bounded exercises use the new-activity skill instead.
---

# New workspace module (not scaffoldable yet)

There is no `npm run new:module` yet. The module template, generator and a full skill arrive
with plan step **4.8** (`docs/architecture/modular-activities-plan.md`, Phase 4), after the
workspace module contract v2 migration. Until then, adding a module is manual and touches app
code in several places, so **confirm the plan with the user before starting**.

## First, is it really a module?

Apply the **Workspace module vs Activity** test in the plan ("The Model"): a module is needed
only if a later task builds on what the student made, a teacher would demo freely in it, or
there is a real free-play mode. Otherwise use the **new-activity** skill. Also run
`node cli/cli.mjs lessons capabilities`: the need may be a new check type or a mode on an
existing module.

## Current manual checklist

From `docs/architecture/lesson-type-modules.md` ("Adding A New Type" and "Usually Changes With"):

1. Add `src/modules/<type>/definition.js`, `index.js`, `StudentWorkspace.jsx`,
   `BuilderWorkspace.jsx` and `CheckEditor.jsx`.
2. Add `checks.js` if the type needs custom checks, exporting `CHECKS` and adding them to
   `checkRegistry` in `src/modules/checks.js`.
3. Register the definition in `src/modules/definitions.js` and the module in
   `src/modules/registry.js`.
4. Add authoring docs (`docs/authoring/<type>.md`) with a complete, validated example, the
   validation messages in `docs/authoring/validation-errors.md`, and a CHANGELOG entry.
5. Add module contract tests and focused behaviour tests.
6. Update `docs/CODEBASE_MAP.md`, `docs/FEATURES.md` and `lesson-type-modules.md` if the
   contract changes.

Also check the files listed under "Usually Changes With" in that doc (LessonTaskContent,
TeacherEditorPanel, TaskEditor, TaskOptionsSection, feature-impact-map, TESTING).

## Known traps

- Inline `lesson.type === '…'` branches are scattered through app code; a new type can be
  missed silently. Route behaviour through the module registry (`typeBranchRatchet.test.js`
  must not go up) and never gate on raw `lesson.type` (composed lessons need the per-task
  effective type).
- Add the module to the **real StudentView click-through** in
  `src/app/views/__tests__/StudentViewModules.test.jsx` and prove Run and Stop work.
- Verify live view, force/reset, sandbox and carry-through in a real browser.
- Same final checks as the new-activity skill: `npm test`, `npm run lint`,
  `npm run format:check`, `npm run docs:check`, `npx vite build`.
