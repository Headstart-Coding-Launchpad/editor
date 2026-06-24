# Check Types Reference

All check types for all lesson types. See `docs/authoring/AUTHORING_GUIDE.md` for syntax and the `check` / `checks` / `incorrectChecks` fields.

---

## Choosing Your Check

Three tiers, in order of preference:

| Tier | When to use | How |
|---|---|---|
| **Exact value** | The exact value is itself the learning objective (running supplied code, looking up a required key) | No wildcards — just the literal string |
| **Wildcard pattern** | Verify structure/shape while accepting any harmless learner choice (name, colour, number, custom string) | Use `*` in the value |
| **Regex** | A structural constraint wildcards cannot express (two related values, lookaheads, backreferences) | `*_matches_regex` check type |

**Start at exact, move up only when needed.** If a wildcard check expresses the requirement, do not use regex.

---

## Wildcard `*`

`*` matches any sequence of characters (including newlines) in `value` for containment and equality checks.

**Shape checking examples:**

```yaml
# Any one-parameter function — wildcard accepts any name
- type: code_contains
  value: "def *(*):"

# Any for-loop over any iterable
- type: code_contains
  value: "for * in *:"

# Output that starts with a greeting and ends with an exclamation mark
- type: output_contains
  value: "Hello, *!"

# Any if/else structure, regardless of condition
- type: code_contains
  value: "if *:*else:"
```

For Scratch, shape checks are even simpler — omit `fieldValues` from `block_used` to accept any value:

```yaml
# Any repeat block, regardless of how many times
check:
  type: block_used
  opcode: control_repeat
```

For Python variables, use `variable_type` or `variable_exists` as shape checks:

```yaml
# Score exists and is a number — don't care about the specific value
- type: variable_exists
  name: score
- type: variable_type
  name: score
  value: int
```

---

## Operator Matrix

Standard operator set across text-comparable domains:

| Domain | `contains` | `equals` | `not_contains` | `not_equals` | `matches_regex` |
|---|:---:|:---:|:---:|:---:|:---:|
| `output_*` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `code_*` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `element_value_*` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `variable_*` | — | ✓ | — | ✓ | — |
| `fs_content_*` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `answer_*` (quiz) | ✓ | ✓ | ✓ | — | ✓ |

**Case sensitivity:** Regex checks (`*_matches_regex`) are case-sensitive. All other string comparisons are case-insensitive.

**Wildcards:** `*` is supported in contains and equals checks for output, code, element value, and answer domains. Scratch `fieldValues` also support `*` wildcards.

---

## Check Shape

```yaml
# Single check
check:
  type: output_contains
  value: Hello
  hint: Make sure your output says `Hello`.   # optional

# Multiple checks — all must pass
checks:
  - type: code_contains
    value: for
  - type: output_line_count
    value: 5

# incorrectChecks — diagnose specific wrong patterns
# Evaluated only when the main check fails; first matching hint is shown
incorrectChecks:
  - type: output_contains
    value: Hello World
    hint: Change `Hello World` to `Hello Headstart`.
```

**Multi-option values:** `"option1","option2"` format — passes if the actual value matches any option. Works for `output_contains`, `code_contains`, `element_value_contains`, `answer_contains`.

---

## Python / HTML Output and Code Checks

| Type | Fields | Run | Submit | Python | HTML | Notes |
|---|---|:---:|:---:|:---:|:---:|---|
| `output_contains` | `type`, `value` | Y | N | Y | Y | stdout / iframe body contains value; wildcard `*` supported |
| `output_equals` | `type`, `value` | Y | N | Y | Y | Exact match (trailing newlines trimmed); wildcard `*` supported |
| `output_not_contains` | `type`, `value` | Y | N | Y | Y | Does not contain value |
| `output_not_equals` | `type`, `value` | Y | N | Y | Y | Does not equal value |
| `output_matches_regex` | `type`, `value` | Y | N | Y | Y | Matches regex (case-sensitive) |
| `output_line_count` | `type`, `value` | Y | N | Y | Y | Exactly N lines |
| `output_line_count_at_least` | `type`, `value` | Y | N | Y | Y | At least N lines (creative tasks) |
| `output_not_empty` | `type` | Y | N | Y | Y | Output is not empty |
| `output_empty` | `type` | Y | N | Y | Y | Output is empty / whitespace-only |
| `code_contains` | `type`, `value` | Y | Y | Y | Y | Source contains value (whitespace ignored outside quotes); wildcard `*` supported |
| `code_not_contains` | `type`, `value` | Y | Y | Y | Y | Source does not contain value |
| `code_equals` | `type`, `value` | Y | Y | Y | Y | Source equals value; wildcard `*` supported |
| `code_not_equals` | `type`, `value` | Y | Y | Y | Y | Source does not equal value |
| `code_matches_regex` | `type`, `value` | Y | Y | Y | Y | Source matches regex (whitespace normalised, case-sensitive) |

`code_does_not_contain` is a permanent alias for `code_not_contains` — both work.

Python completion checks never pass when the code run ends with an error, even if the configured output, code, or variable criteria would otherwise match. A separate "code has no error" check is therefore not available or required.

**Submit mode** only accepts: `code_contains`, `code_not_contains`, `code_equals`, `code_not_equals`, `code_matches_regex`.

---

## HTML Element Checks (run mode only)

All element checks require a `selector` (CSS selector).

| Type | Extra fields | Notes |
|---|---|---|
| `element_exists` | `selector` | At least one element matches |
| `element_count` | `selector`, `value` | Exactly N matching elements |
| `element_value_contains` | `selector`, `value` | Element text/value contains value; wildcard `*` supported |
| `element_value_equals` | `selector`, `value` | Element text/value equals value; wildcard `*` supported |
| `element_value_not_contains` | `selector`, `value` | Does not contain value |
| `element_value_not_equals` | `selector`, `value` | Does not equal value |
| `element_value_matches_regex` | `selector`, `value` | Matches regex (case-sensitive) |
| `element_attribute` | `selector`, `attribute`, `value`? | Attribute exists; if `value` provided, must match |
| `element_style_property` | `selector`, `property`, `value`? | Computed CSS property exists; if `value` provided, must match (URL normalised to filename) |

`element_value` is a permanent alias for `element_value_contains` — both work.

---

## Python Variable Checks

Evaluated after the Python run completes. `value` accepts a JSON-encoded string (`"42"`, `"[1,2,3]"`) or plain string. Python literals `True`, `False`, `None` are also recognised.

| Type | Extra fields | Notes |
|---|---|---|
| `variable_exists` | `name` | Variable exists in scope — use as a shape check |
| `variable_type` | `name`, `value` | Type matches — use as a shape check. Aliases: `str`/`string`, `int`/`float`/`number`, `bool`/`boolean`, `list`/`tuple`/`array`, `dict`/`dictionary` |
| `variable_equals` | `name`, `value` | Variable equals value |
| `variable_not_equals` | `name`, `value` | Variable does not equal value |
| `variable_dict_contains` | `name`, `value` | Dict contains value (any key) |
| `variable_dict_equals` | `name`, `value` | Dict deep-equals value |
| `variable_dict_key_value` | `name`, `key`, `value` | Dict key `key` equals value |
| `variable_array_contains` | `name`, `value` | List contains value |
| `variable_array_equals` | `name`, `value` | List deep-equals value |
| `variable_array_nth_item` | `name`, `index`, `value` | List item at zero-based index equals value |

---

## Quiz Check Types

| Type | Fields | Notes |
|---|---|---|
| `answer_equals` | `type`, `value` | Selected option ID or text equals value; wildcard `*` supported |
| `answer_contains` | `type`, `value` | Free-text answer contains value; wildcard `*` and multi-option supported |
| `answer_not_contains` | `type`, `value` | Free-text answer does not contain value |
| `answer_matches_regex` | `type`, `value` | Free-text answer matches regex (case-sensitive) |
| `quiz_result` | `type` | All pairs/blanks correct (match, fill_blank). No `value` needed. |

The `answer:` shorthand on multiple choice tasks auto-generates `check: { type: answer_equals, value: <id> }`.

---

## Filesystem Check Types

Evaluated automatically after each student operation.

All `path` and `dir` fields are matched **case-insensitively**, so `Documents` and `documents` are treated the same.

`path` also supports glob wildcards:

| Pattern | Matches |
|---|---|
| `*` | Any sequence of characters except `/` |
| `**` | Any sequence of characters including `/` |
| `?` | Exactly one character (not `/`) |

Examples: `/Documents/*.txt`, `/Pro*/`, `/**/*.py`

| Type | Fields | Notes |
|---|---|---|
| `fs_file_exists` | `path` | File at path exists (wildcards supported) |
| `fs_dir_exists` | `path` | Directory at path exists (wildcards supported) |
| `fs_not_exists` | `path` | Path (file or dir) does not exist (wildcards supported) |
| `fs_content_contains` | `path`, `value` | File content contains value (case-insensitive) |
| `fs_content_not_contains` | `path`, `value` | File content does not contain value (case-insensitive) |
| `fs_content_equals` | `path`, `value` | File content equals value (trimmed, case-insensitive) |
| `fs_content_not_equals` | `path`, `value` | File content does not equal value (trimmed, case-insensitive) |
| `fs_content_matches_regex` | `path`, `value` | File content matches regex (case-sensitive) |
| `fs_file_in_dir` | `path`, `dir` | File exists and its direct parent equals dir |
| `fs_dir_opened` | `path` | Student navigated to the folder (wildcards supported) |
| `fs_file_opened` | `path` | Student opened the file (wildcards supported) |

---

## Scratch Check Types

Scratch checks can be a single object or an array. `evaluation` accepts `manual`, `after_run`, or `continuous` (defaults to `manual`).

**Shape checking for Scratch:** Omit `fieldValues` from `block_used` to check that a block exists without caring about its value. `fieldValues` supports `*` wildcards for text inputs (e.g. `MESSAGE: "Hello*"` accepts any say text starting with Hello).

### `block_used`
```yaml
check:
  type: block_used
  evaluation: manual
  opcode: control_repeat
  fieldValues:          # optional — require specific input values; * wildcard supported
    TIMES: "10"
```
`fieldValues` keys are the Blockly input names (e.g. `STEPS`, `DEGREES`, `MESSAGE`). Omit to match any value.

### `sprite_property`
```yaml
check:
  type: sprite_property
  evaluation: after_run
  spriteName: Rocket
  property: x          # x | y | size | direction | visible
  operator: greater_than   # equals | greater_than | less_than
  value: 50
```

### `variable_equals`
```yaml
check:
  type: variable_equals
  evaluation: after_run
  variableName: score
  value: 5
```

### `variable_compare`
```yaml
check:
  type: variable_compare
  evaluation: after_run
  variableName: score
  operator: greater_than   # equals | greater_than | less_than
  value: 5
```
Use `variable_compare` for non-equality operators; `variable_equals` is legacy but still supported.

### `blocks_in_order`
```yaml
check:
  type: blocks_in_order
  evaluation: manual
  spriteName: Sprite 1   # optional — if omitted, any sprite satisfying it passes
  sequence:
    - event_whenflagclicked
    - opcode: motion_movesteps   # object form — allows fieldValues with * wildcard
      fieldValues:
        STEPS: "50"
    - motion_turnright           # plain string — any value accepted
```
Passes if any connected stack contains the opcodes **consecutively** (no gaps). Each sequence item can be a plain opcode string or an object with `opcode` and optional `fieldValues`.

### `block_count`
```yaml
check:
  type: block_count
  evaluation: manual
  spriteName: Sprite 1   # optional
  opcode: motion_movesteps
  operator: equals
  value: 3
```

### `costume_is`
```yaml
check:
  type: costume_is
  evaluation: after_run
  spriteName: Sprite 1   # optional — falls back to first sprite
  value: costume2        # exact costume name, case-sensitive
```

### `block_run`
```yaml
check:
  type: block_run
  evaluation: after_run
  opcode: motion_movesteps
  fieldValues:          # optional — also require the block to have specific values in the workspace
    STEPS: "50"
```
Note: event hat blocks (`event_whenflagclicked` etc.) are not tracked by `block_run` — use `block_used` to check for a hat's presence instead. When `fieldValues` is set, the block must both have executed and currently have those input values in the workspace.

---

## When to Use Regex

`*_matches_regex` checks are case-sensitive and operate on whitespace-normalised code. Use only when a wildcard cannot express the structural constraint:

- Two values must be the same (backreference): `(\w+).*\1`
- Must not contain something in a specific position (lookahead): `^(?!.*eval)`
- Precise character class: `\d{4}` (exactly four digits)

For ordinary beginner syntax checks — function definitions, loops, print statements — a wildcard `code_contains` is always simpler and more readable.
