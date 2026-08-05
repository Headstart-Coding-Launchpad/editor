# Platform Asks

Everything the LaunchPad platform (`platform-docs/`, `cli/`) needs to provide that this workspace cannot resolve on its own. Sourced from every **Platform**-tagged entry in `Missing Information.md` — this file exists to hand those asks to whoever maintains the platform repo in one place, rather than making them dig through the log. When an ask is delivered (a doc section lands, a CLI behaviour changes, a feature ships), close the loop in both files: delete it here and delete the matching entry in `Missing Information.md`.

Two kinds of ask:
- **Documentation** — the behaviour already exists; `platform-docs/` just needs to state it.
- **Capability** — the behaviour doesn't exist yet; the platform itself needs to grow it.

---

## Documentation

All documentation asks from this handoff are resolved — see `docs/authoring/lesson-schema.md`, `lesson-schema-yaml.md`, `task-types.md`, `arcade.md`, `scratch.md`, `markdown-renderer.md`, `python.md`, `python-tasks.md`, `html-tasks.md`, `TOPIC_LIBRARY_SCHEMA.md`, and `AUTHORING_GUIDE.md`. This entry can be deleted the next time `Missing Information.md` is closed out in the authoring workspace.

Worth flagging back: the `codeStages` ask assumed stage labels were teacher-only and that Solo mode auto-advances through stages in sequence. Neither is true of the current (post stage-role-rework) system — labels are shown to students, and stage reveal is offer-based (one Support stage offered per failed attempt, in both live and Solo), not a sequential auto-advance. The docs now describe the current behaviour rather than the assumed one.

---

## Capability

### A state-based check type for Arcade game state
**File:** `platform-docs/arcade.md` (once it exists)
**Raised:** 2026-08-04

Arcade has no way to write a completion check based on runtime game state (e.g. "did `character.frame` actually change after the student pressed space"). Currently the only options are a structural check against the unedited starter (which would pass regardless of whether the student ever interacted with the demo) or no check at all. Needed for any Visual Fun Application–style demo task where the point is to watch a live effect, not to verify static code. Concrete example: `python-1-5` task 24 ("⌨️ If a Key Is Pressed") — a demo where pressing space toggles `character.frame`, currently left uncheckable and confirmed only by a tutor watching **Run game**.

### `lessons test-checks` should skip (not fail) runtime-only checks
**File:** `cli/` (the `lessons test-checks` command)
**Raised:** 2026-08-03

`test-checks` only evaluates source-code checks. Any task carrying an `output`, `output_not_empty`, `output_line_count`, `code_no_error`, or `variable_*` check reports a false `completion: fail` against its own correct complete code, because there's no run to evaluate against — indistinguishable from a genuinely broken regex. On `python-1-5` this produced false failures on 7 of 9 Python code tasks. Either make the command skip (and clearly report as skipped) checks it cannot evaluate, or add a documented, supported way to verify a runtime check before publishing (the cases format currently has no field for stdin or expected output).
