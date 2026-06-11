# YAML Lesson Format

A concise YAML shorthand for writing HSC Repl lessons. Converts to full lesson JSON via the CLI or the `yaml_to_lesson` MCP tool.

**Full field reference:** see `LESSON_SCHEMA.md`.

---

## What the converter handles for you

| YAML shorthand | Becomes in JSON |
|---|---|
| Task `id` omitted | Auto-assigned sequential integers (1, 2, 3 …) |
| `type: information` on a task | `taskType: "information"` (field removed) |
| `type: quiz` on a task | `taskType: "quiz"` (field removed) |
| `type: python` / `html` / etc. on a task | Ignored — treated as a plain code task |
| `group: "Title"` + `tasks:` | `{ id: "g-…", type: "group", title: "…", subtasks: […] }` |
| `checks:` (plural array) | `check:` (the JSON field name) |
| `answer: a` on a multiple_choice quiz | `check: { type: "answer_equals", value: "a" }` |

All other fields are passed through to the JSON unchanged.

---

## Lesson Envelope

Same fields as the JSON schema. `id`, `type`, `title`, and `description` are required.

```yaml
id: python-for-loops
type: python              # python | html | scratch | filesystem
title: Python For Loops
description: Practise loops in Python.
level: 1                  # optional difficulty badge
sandboxStarter: |         # optional Python sandbox starter code
  # Try anything here!
```

---

## Task Types

### Code tasks (default)

Omit `type` (or set it to the lesson type — it will be ignored):

```yaml
tasks:
  - title: Try it
    explainer: Print three numbers.
    starterCode: |
      for i in range(3):
          print(i)
    check:
      type: output_line_count
      value: 3
```

### Information tasks

```yaml
  - type: information
    title: How loops work
    explainer: A `for` loop repeats code a fixed number of times.
```

### Quiz tasks

Multiple choice with `answer:` shorthand:

```yaml
  - type: quiz
    title: Loop quiz
    explainer: Which keyword starts a counted loop?
    options:
      - id: a
        text: for
      - id: b
        text: while
        feedback: This runs until a condition is false, not a fixed number of times.
    answer: a
```

Without the shorthand (explicit check):

```yaml
  - type: quiz
    title: Loop quiz
    explainer: Which keyword starts a counted loop?
    options:
      - id: a
        text: for
      - id: b
        text: while
    check:
      type: answer_equals
      value: a
```

Other quiz types — pass `quizType` and the matching fields from the JSON schema:

```yaml
  - type: quiz
    quizType: match
    title: Hardware match
    explainer: Match each component to its role.
    pairs:
      - id: "1"
        prompt: CPU
        answer: Processes instructions
      - id: "2"
        prompt: RAM
        answer: Temporary memory

  - type: quiz
    quizType: fill_blank
    title: Fill the blank
    text: A ___ repeats code while a condition is true.
    blanks:
      - id: "1"
        answer: loop

  - type: quiz
    quizType: short_answer
    title: What did you find hardest?
    explainer: Write one thing you found difficult today.

  - type: quiz
    quizType: confidence
    taskMode: live
    title: Confidence check
    explainer: How confident do you feel about **for loops**?
```

---

## Groups

Wrap tasks in a group with `group: "Title"` and a nested `tasks:` list:

```yaml
tasks:
  - title: Introduction
    explainer: Before we start...

  - group: Loop Basics
    tasks:
      - title: Counted loops
        explainer: Use `range()` to repeat exactly N times.
        starterCode: |
          for i in range(5):
              print(i)
        check:
          type: output_line_count
          value: 5

      - title: Loop variable
        explainer: Use the loop variable inside the loop body.
        check:
          type: code_contains
          value: "print(i)"
```

Group IDs are generated automatically. Groups cannot be nested.

---

## Checks

### Single check

```yaml
check:
  type: output_contains
  value: Hello
```

### Multiple checks (all must pass)

Use `checks:` (plural) for an array — the converter maps it to `check:`:

```yaml
checks:
  - type: code_contains
    value: for
  - type: output_line_count
    value: 5
```

Or use `check:` directly with a YAML list:

```yaml
check:
  - type: code_contains
    value: for
  - type: output_line_count
    value: 5
```

### Check with a hint

```yaml
check:
  type: output_contains
  value: Hello Headstart
  hint: Check your spelling — the output should say `Hello Headstart`.
```

### `incorrectChecks`

```yaml
check:
  type: output_contains
  value: Hello Headstart
incorrectChecks:
  - type: output_contains
    value: Hello World
    hint: You printed `Hello World` — change it to `Hello Headstart`.
```

---

## HTML Lessons

```yaml
id: html-headings
type: html
title: HTML Headings
description: Add headings to a web page.
tasks:
  - title: Add a heading
    explainer: Add an `<h1>` tag to the page.
    entryFile: index.html
    starterFiles:
      - name: index.html
        type: html
        content: |
          <!DOCTYPE html>
          <html>
          <body>
          </body>
          </html>
    check:
      type: element_exists
      selector: h1
```

---

## Scratch Lessons

```yaml
id: scratch-motion
type: scratch
title: Scratch Motion
description: Make a sprite move.
tasks:
  - title: Move right
    explainer: Make the sprite move to the right.
    sprites:
      - id: sprite1
        name: Rocket
        type: arrow
        x: -100
        y: 0
    check:
      type: sprite_property
      evaluation: after_run
      spriteName: Rocket
      property: x
      operator: greater_than
      value: 50
```

---

## Filesystem Lessons

```yaml
id: files-basics
type: filesystem
title: Files and Folders
description: Organise files and folders.
tasks:
  - title: Create a Documents folder
    explainer: Create a folder called **Documents** in the root folder.
    starterFs:
      "/":
        type: dir
    check:
      type: fs_dir_exists
      path: /Documents/
```

---

## Full Python Example

```yaml
id: python-for-loops
type: python
title: Python For Loops
description: Practise loops in Python.
tasks:
  - type: information
    title: Read first
    explainer: |
      A `for` loop repeats code a fixed number of times.

      ```python
      for i in range(3):
          print(i)
      ```

  - type: quiz
    title: Quick check
    explainer: Which function generates a range of numbers?
    options:
      - id: a
        text: "`range()`"
      - id: b
        text: "`repeat()`"
        feedback: "`repeat()` does not exist in Python."
    answer: a

  - title: Print numbers
    explainer: Print the numbers 0 to 4.
    starterCode: |
      for i in range(5):
          print(i)
    check:
      type: output_line_count
      value: 5

  - group: Challenge
    tasks:
      - title: Sum a range
        explainer: Add up all numbers from 0 to 9 and print the total.
        starterCode: |
          total = 0
          for i in range(10):
              total = total + i
          print(total)
        check:
          type: output_contains
          value: "45"
```

---

## CLI Usage

```bash
# Convert to stdout
node cli/cli.mjs lessons yaml-to-json lesson.yaml

# Write converted JSON to a file
node cli/cli.mjs lessons yaml-to-json lesson.yaml --output lesson.json

# Convert lesson JSON back to concise authoring YAML
node cli/cli.mjs lessons json-to-yaml lesson.json lesson.yaml

# Fetch a live lesson as authoring YAML
node cli/cli.mjs lessons get python-for-loops --format yaml

# Convert, validate, and publish in one step
node cli/cli.mjs lessons publish-yaml lesson.yaml
```

Validation errors cause a non-zero exit. Commands that read data from Firestore print JSON by default; pass `--format yaml` or `--yaml` to print YAML instead.

---

## MCP Tool

```
yaml_to_lesson(yaml)
```

Pass the YAML text. The tool returns `{ lesson, valid, errors, warnings }`. Review the converted JSON, then call `upsert_lesson(lesson)` to publish it.

Also available as a resource: `yaml://format` — serves this document.

---

## Keeping this file up to date

Update this file whenever the YAML-to-JSON conversion rules change (new shorthands, new YAML-only syntax). Update `LESSON_SCHEMA.md` when the underlying JSON schema changes — this file only documents YAML-specific syntax on top of that schema.
