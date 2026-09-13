# Python Code Task Fields

Field reference for `python` module code tasks in a `composed` lesson. Set `moduleType: python` on each such task; use `moduleId` when it belongs to a named Python workspace. For the lesson envelope and common task fields see `docs/authoring/lesson-schema.md`. For Python check types see `docs/authoring/python.md`.

---

## Fields

| Field | Required | Type | Notes |
|---|:---:|---|---|
| `starterCode` | No | string | **Legacy.** Code loaded when no carry-through exists. Use a `role: starter` entry in `codeStages` in new lessons; see below. |
| `completeCode` | No | string | **Legacy.** Reference solution (builder preview/copy). Use a `role: complete` entry in `codeStages` in new lessons; see below. |
| `copyCode` | No | string | Read-only reference panel shown above the student editor; does not replace the student's code. |
| `codeStages` | No | stage array | Intermediate stages (`label`, `code`, optional `role`). Teachers can send any stage to students; Support stages open read-only without replacing student code. A feedback check may target a stage by zero-based index for a preview/recovery offer. |
| `carryCodeFrom` | No | integer or null | Task ID to carry saved code from. |
| `interactionMode` | No | string | `run` (default) or `submit`. |
| `tests` | No | test array | Automated test cases. See **Task Tests** below. |

**`interactionMode` combinations:**
- `run` or omitted: Run executes Python; checks run against output/code/status.
- `submit`: Submit checks code text only; use `type: code` checks.
- `tests` present: **Run Tests** button appears. Only **Run Tests** sets task completion. Plain **Run** stays interactive.

**Stage object:** `role` may be `starter`, `support`, or `complete`; omitted `role` defaults to `support`. The first Starter is the default, and teachers may apply any Starter to a class or individual learner. Every Support stage is an offerable read-only reference. A Complete stage can be revealed read-only before the student or teacher explicitly takes it over, using the same preview-then-replace flow as a Support stage. Legacy `core` and `extension` roles remain readable as Support, and `solution` remains readable as Complete.

**Current authoring convention:** author `codeStages` entries with `role: starter` and `role: complete` instead of the separate `starterCode`/`completeCode` fields — see the Minimal Example below. `starterCode`/`completeCode` remain fully supported at runtime (student, teacher-live, reset, carry-through, preview, print, and sandbox paths all still read them when an equivalent stage is absent), but the current Builder authoring UI no longer creates or edits them. See `docs/authoring/legacy-lesson-compatibility.md` for the full compatibility table.

For the full runtime mechanics — when stages are offered, what's destructive vs. read-only, why a stage can't carry its own `check`, and the Solo-mode self-serve complete-code load — see "Code stage runtime behaviour" and "Solo-mode complete-code self-reveal" in `docs/authoring/lesson-schema.md`.

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
    starterCode: ""
    check:
      type: output
      operator: contains
      value: Hello
```
