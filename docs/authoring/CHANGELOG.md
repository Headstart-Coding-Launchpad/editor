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

### Electronics: generic code checks and lockable wires

Electronics tasks with a `microcontroller` component can now use the shared generic check types — `code`, `code_contains`, `code_equals`, `code_matches_regex`, and their negated variants — alongside the existing `circuit_*` checks. These evaluate against the Micro Controller's MicroPython source, not the raw circuit. The Builder's electronics check editor now exposes this as a **Code** subject (with the same operators and wording as the Python/HTML code check editor), so authors can add these checks without hand-editing lesson JSON/YAML. See `docs/authoring/electronics.md` (Checks section) for an example.

Wires now support an optional `wire.locked: true` field, mirroring the existing component `locked` convention: a locked wire cannot be deleted or recolored by students (new wires can still be attached to its pins). The builder's wire inspector gained a "Fixed for students" checkbox alongside the existing color select. See `docs/authoring/electronics.md` for the field description.

No lesson migration is required — omitted `wire.locked` behaves exactly as before (unlocked).

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
