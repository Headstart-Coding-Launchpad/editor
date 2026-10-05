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

Author starter and complete code as `codeStages` entries with `role: starter` / `role: complete` — this is the current authoring convention and what the Builder's own UI creates and edits:

```yaml
  - title: Print a message
    moduleType: python
    moduleId: python-practice # optional — omit when one Python workspace is enough
    explainer: Use `print()` to show text.
    codeStages:
      - role: starter
        label: Starter
        code: |
          print('Hello')
      - role: complete
        label: Complete
        code: |
          print('Hello Headstart')
    copyCode: |               # optional — read-only panel above the student editor
      print('Hello Headstart')
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

**Legacy `starterCode` / `completeCode`:** older lessons author starter and complete code as separate `starterCode: "..."` / `completeCode: "..."` string fields instead of `codeStages` roles. Both still work fully at runtime and are read whenever an equivalent stage is absent, but the current Builder UI no longer creates or edits them — don't use them in new lessons. See `docs/authoring/legacy-lesson-compatibility.md`.

---

## Line Hints

Put instructions **next to** a line of starter code instead of in a comment the student has to read around, delete or accidentally break. A line whose trimmed text starts with `#>` is a **line hint**: it is removed from the code and its text is shown beside the next line — a 💡 in the editor gutter (hover for the text) and the text in faded grey after the line. The hint is never part of the student's code.

```yaml
    codeStages:
      - role: starter
        label: Starter
        code: |
          #> Change "red" to your favourite colour
          colour = "red"
          for i in range(3):
              #> Print the colour here
              #> Use the colour variable, not the word
              pass
```

- A marker attaches to the **next non-marker line**; its own indentation (and the target line's) doesn't matter.
- Several markers in a row stack onto the same line.
- A marker on the empty line where students should write works: put `#> Write your loop here` above a blank line.
- A marker with no line after it (the last thing in the code) gets a new empty line at the end, so a closing `#> Write your code here` marks where the student starts typing — no extra blank lines needed (YAML `code: |` drops trailing blank lines anyway).
- Markers work in `codeStages` of every role and in the legacy `starterCode` / `completeCode`. Support stages shown as a read-only reference show their hints too.
- Markers are stripped before the code is shown, saved, run, checked (`code_contains`, regex and every other check see the code without them), carried to a later task or mirrored to the teacher. The Builder's editor shows the raw markers so you can edit them; its Run and check buttons strip them.
- Hints show while the editor holds the starter (or a stage). When a student comes back to saved code, each hint re-attaches to the line that still reads the same (ignoring indentation) — if that line was deleted, or several lines now match, the hint is dropped. Deleting a hinted line removes its hint.
- An ordinary comment (`# …`) or a `#>` after code on the same line is left alone.

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
| `variable_not_equals` | `name`, `value` | Variable does not equal value |
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

**Submit mode** only accepts `type: code` and `type: code_structure` checks. Output and variable checks require a run.

**Regex:** `matches_regex` and `not_matches_regex` use JavaScript `RegExp(pattern, flags)`. Put the regex pattern in `value`; put flags such as `i`, `m`, or `s` in `flags`. Regex is case-sensitive unless `flags: i` is set. Anchors (`^`, `$`), groups, alternation, lookarounds, and backreferences follow the browser JavaScript regex engine.

**Normalisation:** output checks normalise `\r\n` to `\n` and compare case-insensitively except regex. Exact output checks trim trailing newline characters only, not other leading/trailing spaces. Code checks normalise whitespace outside quoted strings before contains/equality checks; regex checks see that same normalised source. Because indentation is removed too, use [`code_structure`](#code-structure-checks-code_structure) to check nesting.

**Wildcards and option lists:** for non-regex contains/equality checks, `*` matches any sequence including newlines. A value written as `"opt1","opt2"` passes `contains` if any option is present, and passes `not_contains` only if none of them are. An invalid regex fails both `matches_regex` and `not_matches_regex`, so a typo in a pattern never lets every student pass.

## Code Structure Checks (`code_structure`)

`code` checks remove all whitespace, so they can't tell a nested `if` from two `if`s one after the
other. `code_structure` is the only check that reads **indentation**: it checks that one line sits
inside the block another line opens. Python only (including `code_arrange` tasks with
`moduleType: python`); it needs no run, so it also works in submit mode and on idle feedback.

| Field | Required | Meaning |
|---|---|---|
| `operator` | Y | `nested_in`, `directly_nested_in` or `not_nested_in` (no default) |
| `inner` | Y | The line that should (or shouldn't) be inside the block |
| `outer` | Y | The line that opens the block, usually ending in `:` |

Nested ifs: the inner `if` must be inside the outer one (at any depth).

```yaml
check:
  type: code_structure
  operator: nested_in
  inner: "if has_water_bottle:"
  outer: "if has_backpack:"
  hint: Indent the water bottle `if` so it sits inside the backpack `if`.
```

A loop inside a function: the `print` must be the loop's own body, and the loop must be inside
the function.

```yaml
check:
  - type: code_structure
    operator: directly_nested_in
    inner: "print(name)"
    outer: "for name in *:"
  - type: code_structure
    operator: nested_in
    inner: "for name in *:"
    outer: "def greet(*):"
```

Not nested: the total is printed once, after the loop, not every time round it.

```yaml
feedbackChecks:
  - type: code_structure
    operator: not_nested_in
    inner: "print(total)"
    outer: "for * in *:"
    mode: nudge
    hint: Move `print(total)` out of the loop so it prints once at the end.
```

**Operators:**

- `nested_in` passes when some line matching `inner` is inside a block opened by a line matching
  `outer`, at any depth.
- `directly_nested_in` passes when some `inner` line's **nearest** enclosing block is opened by an
  `outer` line (one level only).
- `not_nested_in` passes when an `inner` line exists and **no** `inner` line is inside an `outer`
  block, at any depth.
- Every operator fails when no line matches `inner`, so a missing line never passes. Combine with
  a `code` check if you also need to check the outer line exists.

**Matching:** `inner` and `outer` are compared with whole lines (not part of a line), ignoring
spacing outside strings and case, like `code` `equals`. A trailing `# comment` on the student's
line is ignored. `*` matches anything, e.g. `for * in range(*):`.

**How nesting is read:** a block opener is a line ending in `:` (`if`, `elif`, `else`, `for`,
`while`, `def`, `class`, `try`, `with`, …). A line is inside every opener above it with less
indentation, up to the left margin. Tabs count as 4 spaces. Blank lines and comment-only lines are
skipped; a statement split over several lines (open brackets, triple-quoted strings, a trailing
`\`) counts as one line.

- `elif` and `else` are their own blocks: a line under `elif x:` is inside `elif x:`, not inside the
  `if` above it. An `elif` lined up with the outer `if` is therefore **not** nested in it, which is
  how this check catches "elif instead of a nested if".
- A one-line block such as `if ok: print("hi")` has nothing nested under it; put the inner line on
  its own line.
- The check reads the source only. It doesn't run the code, so indentation Python would reject
  still gets checked; pair it with an output check when the program must also run.

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

Only one hint is shown per attempt: a matched feedback check's hint beats every completion-check hint, and otherwise the first *failed* completion check (in list order) with a `hint` wins. See [Which hint is shown](AUTHORING_GUIDE.md#which-hint-is-shown).

**When the code can't run** (a `SyntaxError` or runtime error), the task always fails but the checks still pick a hint: `code` / `code_structure` checks and `feedbackChecks` are evaluated against the source as typed (so a regex feedback check such as `matches_regex: '=\s*return'` catches a syntax slip), `code_no_error` and `variable_*` checks fail, and output checks are compared against the error message. Put the check whose hint you want for broken code first. See [When the code can't run (SyntaxError)](AUTHORING_GUIDE.md#when-the-code-cant-run-syntaxerror).

For a misconception-specific recovery path, add `priority` and `stageOffer` to a feedback check. The offer targets an existing `codeStages` index after two matching attempts by default; use `action: preview` to show the stage first, or `action: replace` to offer a confirmed replacement. See `docs/authoring/lesson-schema.md` for the full shape.

---

## Drag-and-Drop Runnable Code (`code_arrange`)

Instead of a free-typed editor, a Python task can be `taskType: code_arrange`:
each line is built from fixed text and blanks — a line that's just one blank
is dragged into place as a whole line, and a line mixing text and blanks
reads like `for i in range(___):`. Every blank draws from one shared tile
pool (the task's `distractors` plus every blank's own correct value). The
assembled program runs for real through this same Pyodide pipeline. Full
field reference: `docs/authoring/lesson-schema.md` ("Code Arrange Task
Fields").

```yaml
- title: Print the first five even numbers
  taskType: code_arrange
  moduleType: python
  explainer: Fill in the blank and drag the second line into place to print 0 2 4 6 8, one per line.
  lines:
    - id: L1
      parts:
        - type: text
          text: "for i in range("
        - type: slot
          id: S1
          code: "5"
        - type: text
          text: "):"
    - id: L2
      parts:
        - type: slot
          id: L2
          code: "    print(i * 2)"
  distractors:
    - id: S1d1
      code: "10"
    - id: D1
      code: "    print(i + 2)"
  check:
    type: output
    operator: equals
    value: |
      0
      2
      4
      6
      8
```

---

## Minimal JSON Example

```json
{
  "id": "python-minimal",
  "type": "composed",
  "title": "Python Minimal",
  "description": "A short Python lesson.",
  "tasks": [
    {
      "id": 1,
      "moduleType": "python",
      "title": "Hello",
      "explainer": "Print `Hello`.",
      "codeStages": [
        { "label": "Starter", "role": "starter", "code": "# Print Hello below\n" },
        { "label": "Complete", "role": "complete", "code": "print(\"Hello\")\n" }
      ],
      "check": { "type": "output", "operator": "contains", "value": "Hello" }
    }
  ]
}
```
