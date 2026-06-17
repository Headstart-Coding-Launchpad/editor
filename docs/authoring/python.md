# Python Lesson Authoring

Everything needed to author a Python lesson. For envelope and common task fields see `docs/authoring/AUTHORING_GUIDE.md`.

---

## Lesson Envelope (Python-specific)

```yaml
id: python-for-loops
type: python
title: Python For Loops
description: Practise loops in Python.
level: 1
sandboxStarter: |        # optional — pre-loaded code shown in the sandbox
  # Try anything here!
```

---

## Code Task Fields

```yaml
  - title: Print a message
    explainer: Use `print()` to show text.
    starterCode: |            # optional — loaded when no carry-through exists
      print('Hello')
    completeCode: |           # optional — reference solution (builder only)
      print('Hello Headstart')
    codeStages: []            # optional — intermediate stages (label, code)
    carryCodeFrom: 1          # optional — carry saved code from task ID
    interactionMode: run      # optional — run (default) | submit
    check:
      type: output_contains
      value: Hello Headstart
```

**`interactionMode` combinations:**
- `run` or omitted: Run executes Python; checks run against output/code/variables/status.
- `submit`: Submit checks code text only; use only submit-compatible check types (`code_contains`, `code_does_not_contain`, `code_equals`, `code_not_equals`, `code_matches_regex`).
- `tests` present: **Run Tests** button appears. Only **Run Tests** sets task completion. Plain **Run** stays interactive.

---

## Automated Tests

```yaml
  - title: Greet the user
    explainer: Ask for a name and print `Hello <name>`.
    starterCode: |
      name = input('What is your name? ')
      print('Hello', name)
    tests:
      - id: t1
        name: Greet Alice
        inputs:
          - name: username
            value: Alice
        check:
          type: output_contains
          value: "Hello {username}"   # {username} substituted with Alice
```

When `tests` is present, a **Run Tests** button appears. Students must pass all tests to complete the task. Plain **Run** remains interactive but does not gate completion.

| Field | Required | Notes |
|---|:---:|---|
| `id` | Yes | Stable string ID, e.g. `"t1"`. |
| `name` | No | Display name in builder and student results. |
| `inputs` | Yes | Ordered values provided to each `input()` call. |
| `check` | Yes | Evaluated after the test run. Supports all non-DOM check types. |

**Input object:** `{ name?: string, value: string }`. `name` is used for `{name}` placeholder substitution in `check.value`.

---

## Python Variable Checks

Evaluated after the Python run completes. `value` accepts a JSON-encoded string (`"42"`, `"[1,2,3]"`) or plain string. Python literals `True`, `False`, `None` are also recognised.

| Type | Extra fields | Notes |
|---|---|---|
| `variable_exists` | `name` | Variable exists in scope |
| `variable_type` | `name`, `value` | Type matches. Aliases: `str`/`string`, `int`/`float`/`number`, `bool`/`boolean`, `list`/`tuple`/`array`, `dict`/`dictionary` |
| `variable_equals` | `name`, `value` | Variable equals value |
| `variable_dict_contains` | `name`, `value` | Dict contains value (any key) |
| `variable_dict_equals` | `name`, `value` | Dict deep-equals value |
| `variable_dict_key_value` | `name`, `key`, `value` | Dict key `key` equals value |
| `variable_array_contains` | `name`, `value` | List contains value |
| `variable_array_equals` | `name`, `value` | List deep-equals value |
| `variable_array_nth_item` | `name`, `index`, `value` | List item at zero-based index equals value |

---

## Output and Code Checks (shared with HTML)

| Type | Fields | Run | Submit | Notes |
|---|---|:---:|:---:|---|
| `code_no_error` | `type` | Y | N | Python run status is `success` |
| `output_contains` | `type`, `value` | Y | N | stdout contains value |
| `output_equals` | `type`, `value` | Y | N | Exact match (trailing newlines trimmed) |
| `output_not_contains` | `type`, `value` | Y | N | Does not contain value |
| `output_not_equals` | `type`, `value` | Y | N | Does not equal value |
| `output_matches_regex` | `type`, `value` | Y | N | Matches regex (case-sensitive) |
| `output_line_count` | `type`, `value` | Y | N | Exactly N lines |
| `output_not_empty` | `type` | Y | N | Output is not empty |
| `output_empty` | `type` | Y | N | Output is empty / whitespace-only |
| `code_contains` | `type`, `value` | Y | Y | Source contains value (whitespace ignored outside quotes) |
| `code_does_not_contain` | `type`, `value` | Y | Y | Source does not contain value |
| `code_equals` | `type`, `value` | Y | Y | Source equals value |
| `code_not_equals` | `type`, `value` | Y | Y | Source does not equal value |
| `code_matches_regex` | `type`, `value` | Y | Y | Source matches regex (whitespace normalised) |

**Submit mode** only accepts: `code_contains`, `code_does_not_contain`, `code_equals`, `code_not_equals`, `code_matches_regex`.

**Wildcards:** `*` matches any sequence (including newlines). **Multi-option:** `"opt1","opt2"` passes if the actual value contains any option (works for `output_contains`, `code_contains`). **Case sensitivity:** regex checks are case-sensitive; all other comparisons are case-insensitive.

---

## Minimal JSON Example

```json
{
  "id": "python-minimal",
  "type": "python",
  "title": "Python Minimal",
  "description": "A short Python lesson.",
  "tasks": [
    {
      "id": 1,
      "title": "Hello",
      "explainer": "Print `Hello`.",
      "starterCode": "",
      "check": { "type": "output_contains", "value": "Hello" }
    }
  ]
}
```
