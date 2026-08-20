# Lesson Authoring Changelog

Author-facing changes that affect how lessons, tasks, topics, checks, assets, or lesson Markdown should be written.

Use this changelog when a platform or documentation change alters the lesson authoring contract. Keep entries newest first and link to the deeper reference doc when the change needs examples or field-level detail.

## What belongs here

- New, renamed, deprecated, or removed lesson YAML/JSON fields.
- New or changed task types, module types, quiz types, checks, feedback checks, or Markdown syntax.
- CLI validation, conversion, publishing, topic, or asset workflow changes that affect authors.
- Builder behavior changes that alter what lesson authors can save, validate, publish, or migrate.
- Compatibility notes for older lessons when authors need to update source files.

## What does not belong here

- Internal refactors with no author-facing lesson behavior change.
- UI polish that does not affect saved lesson fields or authoring workflow.
- Test-only, tooling-only, or deployment-only changes that authors do not need to know about.

## 2026-08-20

### `estimatedMinutes` now accepts decimal values

`estimatedMinutes` previously had to be a positive whole number; it now accepts any positive number, e.g. `estimatedMinutes: 7.5`. The Builder's task editor input steps by 0.5 minutes. See `docs/authoring/lesson-schema.md` and `docs/authoring/lesson-schema-yaml.md`.

## 2026-08-17

### Corrected Scratch `evaluation` values and documented `sprite_property_delta`/`sprite_property_changed`

`docs/authoring/scratch.md` previously told authors to write `evaluation: continuous` for block-structure checks (`block_used`, `blocks_in_order`, `block_count`); the runtime only ever recognizes `after_block_placed`, `after_run`, and `manual` — `continuous` silently fell into the after-run bucket, so a check authored exactly as documented would only ever evaluate after Run, never continuously. Use `evaluation: after_block_placed` instead. No published lesson used `continuous`, so no content migration is needed.

Also documented two previously-unlisted check types that were already implemented and available in the Builder: `sprite_property_delta` (change in a property since before Run) and `sprite_property_changed` (property differs from before Run, any amount).

Added a warning to the `block_run` section: a block is marked "executed" the instant it runs, before its field values are inspected, and this app's click-to-run-a-single-block feature means a bare click into a block (e.g. to edit its text) already counts as a run. Omitting `fieldValues` on a `block_run` check for a block with student-editable input can pass on an unedited/default value — set `fieldValues` (e.g. `operator: not_equals, value: ""`) to require the student's own input.

See `docs/authoring/scratch.md#scratch-check-types`.

### Prebuilt Scratch stacks no longer require their blocks to be in the toolbox

A `prebuiltStacks` (or legacy `predefinedBlocks`) entry now appears in the correct toolbox flyout category even when the task's `toolbox` doesn't otherwise include that block type — the platform resolves the root block's category and creates it if missing. This lets a task restrict its toolbox to already-taught blocks while still handing out a scaffolded starter stack built from blocks ahead of the current lesson. The Builder's prebuilt-stack editor no longer restricts which block types an author can add to a stack.

This only applies to categorized toolboxes; a minimal/flat toolbox (blocks listed directly under `<xml>`) is unchanged and still requires the stack's root block type to already be present there.

See `docs/authoring/scratch.md#prebuilt-stack-object`.

## 2026-08-03

### Added student-added sprites/backdrops and student-created variables (Scratch)

Five new optional Scratch task fields: `allowAddSprite`, `addSpritePresetIds`, `allowAddBackdrop`, `addBackdropPresetIds`, `allowCreateVariable`. When enabled, students get an "Add sprite"/"Add backdrop" picker (sourced from the admin-curated `lessonTypeAssets/scratch.defaultSprites`/`.defaultBackdrops` library, optionally narrowed per task by the `...PresetIds` fields) and/or a "Make a Variable" flyout button. Student-added sprites/backdrops and student-created variables are decorative only — they never satisfy `sprite_property`, `block_used`, `blocks_in_order`, `block_count`, `block_run`, `variable_equals`, or `variable_compare` checks, which continue to see only the author-authored sprite/variable set. They persist through save, carry-through, and remote reset the same as authored content.

See `docs/authoring/scratch.md#student-added-sprites-backdrops-and-variables`.

### Electronics: generic code checks and lockable wires

Electronics tasks with a `microcontroller` component can now use the shared generic check types — `code`, `code_contains`, `code_equals`, `code_matches_regex`, and their negated variants — alongside the existing `circuit_*` checks. These evaluate against the Micro Controller's MicroPython source, not the raw circuit. The Builder's electronics check editor now exposes this as a **Code** subject (with the same operators and wording as the Python/HTML code check editor), so authors can add these checks without hand-editing lesson JSON/YAML. See `docs/authoring/electronics.md` (Checks section) for an example.

Wires now support an optional `wire.locked: true` field, mirroring the existing component `locked` convention: a locked wire cannot be deleted or recolored by students (new wires can still be attached to its pins). The builder's wire inspector gained a "Fixed for students" checkbox alongside the existing color select. See `docs/authoring/electronics.md` for the field description.

No lesson migration is required — omitted `wire.locked` behaves exactly as before (unlocked).

### Arcade Kit now honours the "Web editor" asset flag

Arcade's student workspace and the Builder's author preview now filter both
per-lesson `storageAssets` and Arcade-wide shared assets by `showInEditor`,
matching the existing HTML module behaviour. Generated sprites and tilemaps
from the visual design tools are unaffected.

**Migration note:** shared Arcade assets uploaded before this change default
to `showInEditor: false` and will disappear from lessons until an admin
re-ticks **Web editor** for them in the Admin Portal's Shared Assets panel.

See `docs/authoring/arcade.md#assets` for details.

### Added `taskActivity` field; authoring intent now previewable

Tasks may now carry an optional `taskActivity` field — a plain-text, author-only note on the intended in-class activity (e.g. "Pair-share discussion"). Like `intent`, it is stored but never shown to students, and it is always optional (not required in Draft). It rides along under the existing generic `taskLastChangedAt` timestamp; it has no dedicated `taskActivityLastChangedAt`.

Authoring intent (and the new `taskActivity`) are now also visible in the Builder's inline student/quiz preview and in the teacher's full read-only lesson preview, in an "Authoring metadata" section above the student-facing content. This section is visible by default while `lesson.draft: true`, and collapsed (one click to expand) once Draft is cleared. Both fields remain strictly author-only in every case — never rendered on any student-facing render path.

See `docs/authoring/lesson-schema.md` and `docs/authoring/lesson-schema-yaml.md` for the field reference.

### Added the `code_arrange` task type

New task type for Python and HTML: `taskType: "code_arrange"`. Students assemble a program line by line and run it for real through the same Pyodide/HTML pipeline as an ordinary code task. Completion is decided by the task's normal `check`/`feedbackChecks` against the real run result, not by matching tile identity or order.

`code_arrange` is a distinct task type alongside `python`/`html` code tasks, not a `quiz` sub-type, since quiz tasks must not carry code/output check fields.

Every line in `lines` is authored the same way: as an ordered `parts` array alternating fixed text (`{type: "text", text}`) and blanks (`{type: "slot", id, code}`) — never parsed out of a `___`-marker text blob. A line that's just a single blank with no surrounding text behaves like a traditional whole draggable line; a line mixing text and blanks reads like `for i in range(___):`. There is no separate mode/schema branch for the two — it's purely how many/which parts a line has.

There is exactly one shared tile pool for the whole task: every blank's own correct code, plus the task-level `distractors` list (`{id, code}[]`). Any tile in that pool can be dropped into any blank in the task — whatever tile currently sits in a blank, correct or distractor, is exactly what gets spliced into the assembled program and run.

New fields: `lines` (`{id, parts}[]`, one program line per entry, `parts` joined together and lines joined by newlines), `distractors` (task-level `{id, code}[]`, the shared pool's wrong tiles). HTML tasks also use the ordinary `entryFile` / `starterFiles` fields; the entry file's content is replaced by the assembled lines. There is no `prefixCode`/`suffixCode` — the assembled program is just `lines` joined by newlines, nothing wrapped around them.

See `docs/authoring/lesson-schema.md` ("Code Arrange Task Fields") for the full field reference and an example combining a whole-line blank and a line with an inline blank. See `docs/authoring/python.md` / `docs/authoring/html.md` for module-specific examples. Builder support: choose **Arrange** in the task format picker (composed lessons only) — a visual, reorderable line list where every line uses the same part-by-part composer, plus one shared "Distractor tiles" list, not a raw JSON-shaped form.

## 2026-07-30

### Changed grouped subtask titles

Grouped subtasks now keep their own `title` values instead of being auto-renamed from the parent group title. Authors no longer need `_customTitle`; Builder saves and exports strip that legacy field from grouped subtasks.

See `docs/authoring/lesson-schema-yaml.md` for the updated group example.

## 2026-07-29

### Added authoring changelog maintenance rule

The authoring docs now include this changelog for future lesson-writing changes. When a change affects how lessons are authored, update this file in the same PR with:

- the author-facing impact;
- any required migration or compatibility note;
- links to the detailed reference docs that were updated.

This entry introduces the process only; it does not change the lesson schema or publishing workflow.
