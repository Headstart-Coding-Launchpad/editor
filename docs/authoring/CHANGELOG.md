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
