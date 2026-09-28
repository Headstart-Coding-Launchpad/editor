# ADR 0008: Split CLI and Builder validation

## Status

Accepted. Amended 2026-09-28 (modular-activities plan step 1.4): one shared rule set, with only
environment-specific extras split.

## Context

The CLI validates lesson data in Node.js for authoring and publishing workflows. The Builder validates richer browser-only editing states and can use browser APIs unavailable to the CLI.

Originally `cli/validate.mjs` was a hand copy of the Builder's `validateLesson`. The copies drifted: different wording for the same rule (full stops, "Lesson ID" vs "id"), and rules only one side enforced (the CLI skipped feedback checks, most Scratch checks and Python/HTML check fields; the Builder skipped `recordingUrl` and Electronics stage labels).

## Decision

Keep two entry points — `validateLessonForMcp` (CLI) and `validateLesson` (Builder) — but have both call one pure, Node-safe core, `src/shared/lessonValidation.js` (`validateLessonCore`):

- Every rule that doesn't depend on the environment lives in the core or below it, with **one wording** used by both validators.
- Type-specific rules belong to the workspace module: each `src/modules/<type>/definition.js` has a pure `validateTask(task, { n, lesson, errors, warnings })`, looked up by the task's effective module type (composed lessons use each task's own module, never `lesson.type`). Check types can add their own rules through the check registry's optional `validate`.
- `taskType: 'activity'` tasks are validated by the activity registry's `validateTask` (an unknown `activityType` gets the fallback definition's error). Quiz and code_arrange rules live in `src/activities/legacyValidation.js` until they become activity definitions.
- Each validator adds only its **environment-specific extras** through hooks on the core:
  - CLI: `description is required` (CLI-published lessons go straight to the lesson list).
  - Builder: duplicate task-id warnings (the Builder renumbers ids), module rules that need browser APIs (`validateTaskInBrowser`, e.g. Scratch toolbox XML via `DOMParser`), and the untested-check reminder (`_checkTested` is Builder editing state).

## Consequences

- A lesson can still pass CLI validation and trigger a Builder-only error or warning (and a Builder-saved lesson can lack the CLI's `description`); `docs/authoring/validation-errors.md` marks those rows **CLI only** / **Builder only**.
- A validation rule change is made once — in the core, a module definition or an activity definition — and both publish paths pick it up. `src/shared/__tests__/lessonValidationParity.test.js` runs every authoring-doc example and test fixture through both validators and requires identical shared errors and warnings.
- `validationErrorsDoc.test.js` scans the core, the module definitions and both entry points, so every message still needs a row in `validation-errors.md`.
