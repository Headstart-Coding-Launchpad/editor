# Python Code Task Fields

Field reference for `python`-type lesson code tasks. For the lesson envelope and common task fields see `docs/authoring/lesson-schema.md`. For Python check types see `docs/authoring/python.md`.

---

## Fields

| Field | Required | Type | Notes |
|---|:---:|---|---|
| `starterCode` | No | string | Code loaded when no carry-through exists. |
| `completeCode` | No | string | Reference solution (builder preview/copy). |
| `codeStages` | No | stage array | Intermediate stages (`label`, `code`). Teacher can send any stage to students. |
| `carryCodeFrom` | No | integer or null | Task ID to carry saved code from. |
| `interactionMode` | No | string | `run` (default) or `submit`. |
| `tests` | No | test array | Automated test cases. See **Task Tests** below. |

**`interactionMode` combinations:**
- `run` or omitted: Run executes Python; checks run against output/code/status.
- `submit`: Submit checks code text only; use `type: code` checks.
- `tests` present: **Run Tests** button appears. Only **Run Tests** sets task completion. Plain **Run** stays interactive.

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
type: python
title: Python Minimal
description: A short Python lesson.
tasks:
  - id: 1
    title: Hello
    explainer: Print `Hello`.
    starterCode: ""
    check:
      type: output
      operator: contains
      value: Hello
```
