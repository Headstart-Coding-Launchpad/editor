# Python Code Task Fields

Field reference for `python` module code tasks in a `composed` lesson. Set `moduleType: python` on each such task; use `moduleId` when it belongs to a named Python workspace. For the lesson envelope and common task fields see `docs/authoring/lesson-schema.md`. For Python check types see `docs/authoring/python.md`.

---

## Fields

| Field | Required | Type | Notes |
|---|:---:|---|---|
| `starterCode` | No | string | **Legacy.** Code loaded when no carry-through exists. Use a `role: starter` entry in `codeStages` in new lessons; see below. |
| `completeCode` | No | string | **Legacy.** Reference solution (builder preview/copy). Use a `role: complete` entry in `codeStages` in new lessons; see below. |
| `copyCode` | No | string | Read-only reference panel shown above the student editor; does not replace the student's code. |
| `copyAfter` | No | string | The exact text of the line the `copyCode` lines go after. The panel shows that line dimmed ("after this line"), then the typed lines in green with `+`. See **Change view** below. Also on Turtle and Arcade Kit tasks. |
| `copyBefore` | No | string | For a change at the top of the code: the line the `copyCode` lines go before ("before this line"). Not with `copyAfter`. |
| `codeStages` | No | stage array | Intermediate stages (`label`, `code`, optional `role`). Teachers can send any stage to students; Support stages open read-only without replacing student code. A feedback check may target a stage by zero-based index for a preview/recovery offer. |
| `carryCodeFrom` | No | integer or null | Task ID to carry saved code from. |
| `interactionMode` | No | string | `run` (default) or `submit`. |
| `tests` | No | test array | Automated test cases. See **Task Tests** below. |
| `setupCode` | No | string | Hidden setup: Python run first on every Run, in the same program, never shown. See [python.md](python.md#hidden-setup-setupcode-setupnote). Also on Turtle tasks. |
| `setupNote` | No | string | One short line above the editor saying what `setupCode` made. |
| `showBlocks` | No | boolean | Default `true`: coloured block brackets beside the lines each `:` line controls, with a **Blocks** button to hide them. `false` hides both. See [python.md](python.md). |
| `puzzle` | No | object | Puzzle rules `{ onlyEdit, maxLines, par }` and the `max_lines` check. See [python.md](python.md#puzzle-rules-puzzle-and-the-max_lines-check). Also on Turtle tasks. Lock single lines with a `#@lock` marker line above them ([python.md](python.md#locked-lines-lock)). |

**`interactionMode` combinations:**
- `run` or omitted: Run executes Python; checks run against output/code/status.
- `submit`: Submit checks code text only; use `type: code` checks.
- `tests` present: **Run Tests** button appears. Only **Run Tests** sets task completion. Plain **Run** stays interactive.

**Stage object:** `role` may be `starter`, `support`, or `complete`; omitted `role` defaults to `support`. The first Starter is the default, and teachers may apply any Starter to a class or individual learner. Every Support stage is an offerable read-only reference. A Complete stage can be revealed read-only before the student or teacher explicitly takes it over, using the same preview-then-replace flow as a Support stage. Legacy `core` and `extension` roles remain readable as Support, and `solution` remains readable as Complete.

**Stage `show` (Complete stages):** `show: change` shows the student only what changes, not the whole program; `show: full` (the default, or no field) shows it all as before. See **Change view** below.

**Current authoring convention:** author `codeStages` entries with `role: starter` and `role: complete` instead of the separate `starterCode`/`completeCode` fields — see the Minimal Example below. `starterCode`/`completeCode` remain fully supported at runtime (student, teacher-live, reset, carry-through, preview, print, and sandbox paths all still read them when an equivalent stage is absent), but the current Builder authoring UI no longer creates or edits them. See `docs/authoring/legacy-lesson-compatibility.md` for the full compatibility table.

For the full runtime mechanics — when stages are offered, what's destructive vs. read-only, why a stage can't carry its own `check`, and the Solo-mode self-serve complete-code load — see "Code stage runtime behaviour" and "Solo-mode complete-code self-reveal" in `docs/authoring/lesson-schema.md`.

### Change view

A Complete stage usually differs from the student's code by a line or two, but it shows the whole program. Set `show: change` on the Complete stage and, when it opens, the student sees only what to do, each change placed by a line of their own code:

```text
  size -= step      after this line
+ turn += 10        Add
```

- **What it compares.** The code in the student's editor when the stage opens (their carried or current code). If the editor is empty, the task's starter. It is worked out in the student's browser and never stored; nothing in the lesson changes.
- **What shows.** New lines in green with `+` and **Add**, already indented. Removed lines in red with `-` and **Remove**. A changed line is its old line in red, then its new line in green. Each new line is placed by the line before it, dimmed, with **after this line** (at the top of the program, the line after it, with **before this line**). If that line appears more than once, the line after it or the two lines before it are used instead. Lines that only need indenting are one amber note: "Indent these 3 lines (4 spaces in)". No line numbers: students add lines, so numbers shift.
- **Ignored.** `#@lock`, `#@slot` and `#>` marker lines, spaces at the ends of lines, blank lines, and tabs versus spaces of the same width.
- **Too much change.** The stage shows the whole program with the changed lines marked, and "A lot changed in this step, so here is all of the code. Green lines are new, red lines go." when more than half of its lines are new or re-indented, there are more than 3 separate changes, one block of new lines is more than 8 lines, or a new line has no line that places it.
- **Nothing to do.** "Your code already matches this step".
- **Controls.** **Show all the code** shows the whole program with the changes marked (**Show only the changes** goes back). In Solo, the load button reads **Replace my code with this** while the changes show; it still loads the whole stage. The tutor's send stage and the Solo "See complete code" use the same view, against that student's own code.
- **Writing for it.** Keep each Complete a small, local change from the step before it, so the place line makes sense; split a step that rewrites most of the program. Python only (Python module tasks); `show: change` on a Support stage, or in another module, is ignored with a warning.

The Copy code panel can use the same look: `copyAfter: "size -= step"` (or `copyBefore` for a change at the top) shows that line dimmed, then the `copyCode` lines in green with `+`. Write the line exactly as it is in the starter (spaces at the start and end don't matter). `copyCode` stays an example the student types, so checks are unchanged. A tutor's own "Type this out" text drops the place line.

```yaml
copyCode: "turn += 10"
copyAfter: "size -= step"
codeStages:
  - { label: Starter, role: starter, code: "size = 100\nstep = 5\nsize -= step" }
  - { label: Complete, role: complete, show: change, code: "size = 100\nstep = 5\nsize -= step\nturn += 10" }
```

---

## Task Tests

When `tests` is present, students must pass all tests to complete the task. Each test provides pre-set inputs to `input()` calls and checks the resulting output.

```yaml
tests:
  - id: t1
    name: Greet Alice
    inputs:
      - name: username
        value: Alice
    check:
      type: output
      operator: contains
      value: "Hello {username}"
```

| Field | Required | Notes |
|---|:---:|---|
| `id` | Yes | Stable string ID, e.g. `"t1"`. |
| `name` | No | Display name in builder and student results. |
| `inputs` | Yes | Ordered values provided to each `input()` call. |
| `check` | Yes | Check evaluated after the test run. Supports all non-DOM check types. |

**Input object:** `{ name?: string, value: string }`. `name` is used for `{name}` placeholder substitution in `check.value`.

**Placeholder substitution:** `{username}` in a check value is replaced with the corresponding input's `value` at run time.

Excess `input()` calls beyond the test's entries receive an empty string.

---

## Minimal Example

```yaml
id: python-minimal
type: composed
title: Python Minimal
description: A short Python lesson.
tasks:
  - id: 1
    moduleType: python
    title: Hello
    explainer: Print `Hello`.
    codeStages:
      - label: Starter
        role: starter
        code: |
          # Print Hello below
    check:
      type: output
      operator: contains
      value: Hello
```
