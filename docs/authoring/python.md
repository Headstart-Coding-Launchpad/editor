# Python Module Code-Task Authoring

Everything needed to author Python code tasks in a composed lesson. For envelope and common task fields see `docs/authoring/AUTHORING_GUIDE.md`.

---

## Composed Lesson and Python Module

```yaml
id: python-for-loops
type: composed
title: Python For Loops
description: Practise loops in Python.
level: 1
modules:
  - id: python-practice
    type: python
    sandbox:
      sandboxStarter: |    # optional — pre-loaded code shown in this module's sandbox
        # Try anything here!
```

---

## Code Task Fields

```yaml
  - title: Print a message
    moduleType: python
    moduleId: python-practice # optional — omit when one Python workspace is enough
    explainer: Use `print()` to show text.
    starterCode: |            # optional — loaded when no carry-through exists
      print('Hello')
    completeCode: |           # optional — reference solution (builder only)
      print('Hello Headstart')
    copyCode: |               # optional — read-only panel above the student editor
      print('Hello Headstart')
    codeStages: []            # optional — intermediate stages (label, role?, revealable?, code)
    carryCodeFrom: 1          # optional — carry saved code from task ID
    interactionMode: run      # optional — run (default) | submit
    check:
      type: output
      operator: contains
      value: Hello Headstart
```

**`interactionMode` combinations:**
- `run` or omitted: Run executes Python; checks run against output/code/variables/status.
- `submit`: Submit checks code text only; use only submit-compatible checks (`type: code`).
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
          type: output
          operator: contains
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

Prefer the canonical `type` + `operator` form:

| Type | Operators | Run | Submit | Fields |
|---|---|:---:|:---:|---|
| `output` | `contains`, `not_contains`, `equals`, `not_equals`, `matches_regex`, `not_matches_regex` | Y | N | `value`, optional `flags` for regex |
| `output_line_count` | `equals`, `not_equals`, `greater_than`, `greater_than_or_equal`, `less_than`, `less_than_or_equal` | Y | N | `value` |
| `code` | `contains`, `not_contains`, `equals`, `not_equals`, `matches_regex`, `not_matches_regex` | Y | Y | `value`, optional `flags` for regex |
| `code_no_error` | none | Y | N | Python run status is `success` |
| `output_not_empty` / `output_empty` | none | Y | N | Legacy convenience checks |

Legacy aliases such as `output_contains`, `output_equals`, `output_matches_regex`, `code_contains`, `code_does_not_contain`, and `code_matches_regex` still load, but new lessons should use the canonical form above.

**Submit mode** only accepts `type: code` checks. Output and variable checks require a run.

**Regex:** `matches_regex` and `not_matches_regex` use JavaScript `RegExp(pattern, flags)`. Put the regex pattern in `value`; put flags such as `i`, `m`, or `s` in `flags`. Regex is case-sensitive unless `flags: i` is set. Anchors (`^`, `$`), groups, alternation, lookarounds, and backreferences follow the browser JavaScript regex engine.

**Normalisation:** output checks normalise `\r\n` to `\n` and compare case-insensitively except regex. Exact output checks trim trailing newline characters only, not other leading/trailing spaces. Code checks normalise whitespace outside quoted strings before contains/equality checks; regex checks see that same normalised source.

**Wildcards and multi-option contains:** for non-regex contains/equality checks, `*` matches any sequence including newlines. A value written as `"opt1","opt2"` passes `contains` if any option is present.

## Feedback Checks

Python tasks support `feedbackChecks`. They use the same check shapes as completion checks and require a completion `check`. `show: after_attempt` runs after Run/Submit; `show: on_idle` runs after the learner pauses editing and is most useful with code checks. `incorrectChecks` is a legacy alias for blocking feedback.

```yaml
feedbackChecks:
  - type: code
    operator: contains
    value: input(
    mode: blocking        # blocking | nudge
    show: after_attempt   # after_attempt | on_idle
    hint: This task should print a fixed message, not ask for input.
```

If a completion check passes but a blocking feedback check also matches, the task fails and the feedback hint is shown. A matching `mode: nudge` hint is shown without failing the task. If a blocking feedback check has no `hint`, students see `Not quite.` and the builder warns authors to add one.

For a misconception-specific recovery path, add `priority` and `stageOffer` to a feedback check. The offer targets an existing `codeStages` index after two matching attempts by default; use `action: preview` to show the stage first, or `action: replace` to offer a confirmed replacement. See `docs/authoring/lesson-schema.md` for the full shape.

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
      "check": { "type": "output", "operator": "contains", "value": "Hello" }
    }
  ]
}
```
