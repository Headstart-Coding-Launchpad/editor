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

## 2026-08-03

### Added student-added sprites/backdrops and student-created variables (Scratch)

Five new optional Scratch task fields: `allowAddSprite`, `addSpritePresetIds`, `allowAddBackdrop`, `addBackdropPresetIds`, `allowCreateVariable`. When enabled, students get an "Add sprite"/"Add backdrop" picker (sourced from the admin-curated `lessonTypeAssets/scratch.defaultSprites`/`.defaultBackdrops` library, optionally narrowed per task by the `...PresetIds` fields) and/or a "Make a Variable" flyout button. Student-added sprites/backdrops and student-created variables are decorative only — they never satisfy `sprite_property`, `block_used`, `blocks_in_order`, `block_count`, `block_run`, `variable_equals`, or `variable_compare` checks, which continue to see only the author-authored sprite/variable set. They persist through save, carry-through, and remote reset the same as authored content.

See `docs/authoring/scratch.md#student-added-sprites-backdrops-and-variables`.

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
