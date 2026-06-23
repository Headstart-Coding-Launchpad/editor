# Lesson Authoring Guide

YAML-first reference for writing HSC lessons and topics. Use the CLI to convert YAML and publish to Firestore.

**Full JSON field reference:** `docs/authoring/lesson-schema.md`
**All check types:** `docs/authoring/checks.md`
**Quiz types in detail:** `docs/authoring/quiz-tasks.md`
**Scratch fields and opcodes:** `docs/authoring/scratch-reference.md`
**Markdown renderer:** `docs/authoring/markdown-renderer.md`

---

## Quick Start

```bash
node cli/cli.mjs lessons publish-yaml lesson.yaml          # one step: convert, validate, publish

# or step by step:
node cli/cli.mjs lessons yaml-to-json lesson.yaml          # validate + preview JSON
node cli/cli.mjs lessons yaml-to-json lesson.yaml --output lesson.json
node cli/cli.mjs lessons upsert lesson.yaml                 # accepts YAML or JSON; saves draft tasks

# fetch an existing lesson as YAML:
node cli/cli.mjs lessons get python-for-loops --format yaml
```

---

## Lesson Envelope

```yaml
id: python-for-loops         # required — lowercase slug, used in URLs
type: python                 # required — python | html | scratch | filesystem
title: Python For Loops      # required
description: Practise loops. # required — shown on the entry screen
level: 1                     # optional — difficulty badge in the TopBar

# Python / Scratch sandbox mode
sandboxStarter: |            # optional — pre-loaded code or Scratch state
  # Try anything here!

# HTML sandbox mode
sandboxStarterFiles:         # optional — pre-loaded files
  - name: index.html
    type: html
    content: |
      <!DOCTYPE html><html><body></body></html>

# Scratch sandbox mode
sandboxToolbox: "<xml>...</xml>"   # optional — Scratch XML toolbox
sandboxSprites: []                 # optional — sprite array
sandboxBackdrops: []               # optional — backdrop array

# Filesystem sandbox mode
sandboxStarterFs:            # optional — initial filesystem for sandbox
  "/":
    type: dir

# Assets
assetsPath: scratch-assets   # optional — base URL for image assets
assets:                      # optional — files shown in AssetBrowser
  - sprites/rocket.png
storageAssets:               # optional — Firebase Storage files
  - name: logo.png
    url: https://firebasestorage.googleapis.com/...
    showInEditor: true       # optional — show in web editor asset panel

tasks: []                    # required — ordered task list (see below)
```

---

## Common Task Fields

These apply to every task type.

```yaml
tasks:
  - id: 1                    # optional — auto-assigned if omitted
    title: Task title         # required
    explainer: |              # required — Markdown shown to students
      Instructions here.
    estimatedMinutes: 5       # optional — teacher countdown
    taskMode: both            # optional — both (default) | live | solo
    # taskType omitted = code task; use information or quiz for non-code tasks
```

---

## Code Tasks

### Python

```yaml
  - title: Print a message
    explainer: Use `print()` to show text.
    starterCode: |            # optional — loaded when no carry-through exists
      print('Hello')
    completeCode: |           # optional — reference solution (builder only)
      print('Hello Headstart')
    carryCodeFrom: 1          # optional — carry saved code from task ID
    interactionMode: run      # optional — run (default) | submit
    check:
      type: output_contains
      value: Hello Headstart
```

### HTML

```yaml
  - title: Add a heading
    explainer: Add an `<h1>` tag.
    entryFile: index.html     # optional — defaults to index.html
    starterFiles:
      - name: index.html
        type: html            # html | css | javascript
        content: |
          <!DOCTYPE html><html><body></body></html>
      - name: style.css
        type: css
        content: "body { font-family: sans-serif; }"
    completeFiles:            # optional — reference solution
      - name: index.html
        type: html
        content: |
          <!DOCTYPE html><html><body><h1>Hello</h1></body></html>
    carryCodeFrom: 1          # optional — carry files from task ID (matched by filename)
    interactionMode: run      # optional — run (default) | submit
    check:
      type: element_exists
      selector: h1
```

### Scratch

```yaml
  - title: Move the sprite
    explainer: Make the sprite move to the right.
    toolbox: "<xml>...</xml>" # optional — restricts available blocks
    sprites:                  # optional — defaults to one cat sprite
      - id: sprite1
        name: Rocket
        type: arrow           # cat | ball | star | arrow | bat | parrot
        x: -100
        y: 0
        size: 100
        direction: 90
        costumes:             # optional — image costumes
          - name: rocket
            image: sprites/rocket.png
    backdrops:                # optional — defaults to plain white
      - id: backdrop1
        name: Space
        image: backdrops/space.png
    variables:                # optional — defaults to a single 'score' variable
      - name: score
        showOnStage: true
    starterBlocks: null       # optional — Blockly workspace state
    completeBlocks: null      # optional — reference solution blocks
    carryBlocksFrom: null     # optional — carry blocks from task ID
    check:
      type: sprite_property
      evaluation: after_run
      spriteName: Rocket
      property: x
      operator: greater_than
      value: 50
```

For full Scratch fields (costumes, emoji sprites, prebuilt stacks, block opcodes, `blocks_in_order` etc.) see `docs/authoring/scratch-reference.md`.

### Filesystem

```yaml
  - title: Create a folder
    explainer: Create a folder called **Documents**.
    starterFs:                # optional — initial filesystem state
      "/":
        type: dir
    completeFs:               # optional — reference solution
      "/":
        type: dir
      "/Documents/":
        type: dir
    carryFsFrom: null         # optional — carry filesystem from task ID
    startsInDir: /            # optional — which dir the explorer opens in
    check:
      type: fs_dir_exists
      path: /Documents/
```

Filesystem checks evaluate automatically (no Run button). Check types: `fs_file_exists`, `fs_dir_exists`, `fs_not_exists`, `fs_content_contains`, `fs_content_equals`, `fs_file_in_dir`, `fs_dir_opened`, `fs_file_opened`.

---

## Information Tasks

```yaml
  - type: information         # sets taskType: "information" in JSON
    informationType: standard # standard (default) | recap | introduction
    title: How loops work
    explainer: A `for` loop repeats code a fixed number of times.
    # For recap (two-pane view):
    # leftContent: |          # purple left pane
    #   Key points here
    # explainer: |            # white right pane
    #   More detail here
    # introduction renders lesson title/level/description — no explainer needed
```

---

## Quiz Tasks

```yaml
  - type: quiz                # sets taskType: "quiz" in JSON

    # Multiple choice (default quizType)
    title: Loop quiz
    explainer: Which keyword starts a counted loop?
    options:
      - id: a
        text: for
      - id: b
        text: while
        feedback: This runs until a condition is false.
    answer: a                 # shorthand — expands to check: {type: answer_equals, value: a}

    # Match
    quizType: match
    pairs:
      - id: "1"
        prompt: CPU
        answer: Processes instructions

    # Fill blank (drag or type)
    quizType: fill_blank
    text: A ___ repeats code while a condition is true.
    mode: drag                # drag (default) | type
    blanks:
      - id: "1"
        answer: loop
    distractors:              # optional extra wrong tiles (drag mode only)
      - id: d1
        text: variable

    # Short answer
    quizType: short_answer
    explainer: What does CPU stand for?
    check:                    # omit check for open-ended (teacher review only)
      type: answer_contains
      value: Central Processing Unit

    # Confidence (1–5 rating; any rating completes the task)
    quizType: confidence
    taskMode: live
    explainer: How confident do you feel about for loops?
```

For full quiz detail and all answer check types see `docs/authoring/quiz-tasks.md`.

---

## Checks

### Single check

```yaml
check:
  type: output_contains
  value: Hello
  hint: Check that your print statement says `Hello`.   # optional
```

### Multiple checks (all must pass)

```yaml
checks:                       # plural — converter maps to check:
  - type: code_contains
    value: for
  - type: output_line_count
    value: 5
```

### Incorrect pattern hints

```yaml
check:
  type: output_contains
  value: Hello Headstart
incorrectChecks:
  - type: output_contains
    value: Hello World
    hint: Change `Hello World` to `Hello Headstart`.
```

### Common check types

| Task type | Common checks |
|---|---|
| Python run | `output_contains`, `output_line_count`, `code_contains`, variable checks |
| Python variable | `variable_equals`, `variable_exists`, `variable_type` |
| Python submit | `code_contains`, `code_does_not_contain`, `code_matches_regex` |
| HTML run | `element_exists`, `element_value`, `element_attribute`, `output_contains` |
| Scratch | `sprite_property`, `block_used`, `variable_equals`, `blocks_in_order` |
| Quiz | `answer_equals`, `answer_contains`, `quiz_result` |

Python run-mode completion checks automatically fail if the code run ends with an error. Do not add a separate check for error-free execution; choose a check that describes the output, code, or variable state the task is intended to produce.

For the full list of every check type and its fields see `docs/authoring/checks.md`.

---

## Task Groups

```yaml
tasks:
  - title: Introduction
    explainer: Before we start...

  - group: Loop Basics         # generates a group object in JSON
    tasks:
      - title: Counted loops
        explainer: Use `range()` to repeat exactly N times.
        check:
          type: output_line_count
          value: 5

      - title: Loop variable
        explainer: Use the loop variable inside the loop body.
        check:
          type: code_contains
          value: "print(i)"
```

Groups cannot be nested. Group IDs are auto-generated.

---

## Automated Tests (Python only)

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

---

## YAML Shorthands

| YAML | Becomes in JSON |
|---|---|
| `id` omitted | Auto-assigned sequential integers (1, 2, 3 …) |
| `type: information` on a task | `taskType: "information"` |
| `type: quiz` on a task | `taskType: "quiz"` |
| `type: draft` on a task | `taskType: "draft"` |
| `group: "Title"` + `tasks:` | Group object with auto-generated ID |
| `checks:` (plural array) | `check:` (the JSON field name) |
| `answer: a` on a multiple_choice quiz | `check: { type: "answer_equals", value: "a" }` |

---

## Draft Tasks and Lesson Stage

The builder supports an authoring pipeline with `stage` on the lesson envelope and `type: draft` tasks.

Draft tasks serve two distinct levels of specification:

- At `ideas`, they are provisional structural plans using Tier 1 fields.
- At `details`, they remain `type: draft` but become complete execution-level specifications using Tier 2 fields.

Do not convert detailed drafts into executable information, quiz, or code tasks during the Details stage. That conversion is a separate implementation step after review and approval.

### Lesson stages

`ideas → details → review → approved → published`

Set via the Stage selector in Lesson Details (builder) or the CLI:

```bash
node cli/cli.mjs lessons set-stage python-for-loops review
```

### Draft tasks in YAML

At the Ideas stage, every draft task uses these Tier 1 fields:

- `title`: working name for the learning moment
- `kind`: one of the exact values below — this field is an enum, not free text
- `purpose`: why the task exists
- `expectedOutcome`: what the learner will achieve or produce
- `knownPitfalls`: likely mistakes or misconceptions
- `topicLinks`: likely Topic Library IDs used by this task; record these during Ideas

Allowed `kind` values:

| Value | Use for |
|---|---|
| `information slide` | Teaching or explanatory content |
| `code task` | Runnable, editable, debugging, prediction, or build activities using code |
| `quiz` | Any knowledge-check format, including prediction and debugging questions |
| `confidence check` | Low-pressure learner readiness ratings |
| `project step` | One stage of a larger build |
| `group heading` | A planned navigation or section marker |
| `recap` | Opening or final recap moments |
| `extension` | Optional stretch work |

Use `purpose` to describe the specific variation, such as a prediction quiz or code-edit task. Do not invent a more specific `kind` value.

Add `knownPitfalls` to every learner activity where a realistic mistake or misconception can be anticipated, especially code tasks, quizzes, confidence checks, project steps, and extensions. It may be omitted from structural tasks such as introductions, objectives, group headings, and simple recap slides when there is no meaningful pitfall.

```yaml
id: python-loops-draft
type: python
title: Python Loops (Draft)
stage: ideas
tasks:
  - type: draft
    title: Introduce for loops
    kind: information slide
    purpose: Set context before the first code task.
    expectedOutcome: Students can describe what a for loop repeats.
    knownPitfalls: Students may assume a loop always runs forever.
    topicLinks:
      - for-loop
      - range-function

  - type: draft
    title: Write a basic for loop
    kind: code task
    purpose: Students write their first loop.
    expectedOutcome: Students produce five lines of numbered output.
    knownPitfalls: Students may forget the colon or indentation.
    # Tier 2 fields (unlocked at 'details' stage and later).
    # The task remains type: draft:
    studentFacingContent: |
      Use `range()` to print the numbers 0–4.
    checksAndSuccessSignals: "output_line_count: 5"
    hintsAndSupport: "Remind students that range(5) gives 0, 1, 2, 3, 4."
```

`type: draft` tasks produce a validation **warning** (not an error) — `lessons upsert` saves them, `lessons publish-yaml` blocks them.

At Details, complete the Tier 2 fields rather than replacing the draft task:

- `studentFacingContent`: final learner-facing copy
- `studentAction`: exact learner action where applicable
- `starterState`: exact starter code/files/blocks/carry state
- `expectedOutcome`: final output, answer, structure, or artefact
- `checksAndSuccessSignals`: proposed checks with exact types and values
- `hintsAndSupport`: hints, feedback, incorrect checks, and code stages
- `yamlHandoffNotes`: intended real task type and all implementation configuration

Real task fields are written only during the later implementation handoff.

### Topic planning and stage validation

Use task-level `topicLinks` as plain IDs from the Ideas stage onward. If an ID does not exist in the current Firestore Topic Library, describe it once at lesson level:

```yaml
topicProposals:
  - id: range-function
    title: The range() function
    description: Produces a sequence of numbers commonly used by loops.
    status: proposed
```

Use `status: deferred` when the missing topic is intentionally postponed. Do not put task usage in proposals; the builder derives that from every task's `topicLinks` and embedded `[[topic-id]]`, `[[topic-id|label]]`, or `#topic/topic-id` links.

Missing topics warn during Ideas and Details. Moving to Review requires a matching proposed/deferred entry. Approval keeps missing topics visible. Publishing is blocked until every referenced topic exists in Firestore. Unused proposals warn but do not block.

```bash
node cli/cli.mjs lessons topics python-loops-draft
node cli/cli.mjs lessons topics python-loops-draft --format yaml
```

At Details, embed topic links in the student-facing prose where they should appear to learners. Recreation, from-memory, and independent tasks should normally include a learner-facing topic link in the prompt or hint; `topicLinks` metadata alone does not provide learner support.

### Review notes via CLI

```bash
# View all tasks with review notes (output includes taskId values to use with --task)
node cli/cli.mjs lessons review python-loops-draft

# Set a review note using the task's id field shown in the list output
node cli/cli.mjs lessons review python-loops-draft --task 2 --decision rejected --note "Needs a second example"
node cli/cli.mjs lessons review python-loops-draft --task 2 --decision accepted
```

---

## Topic Library (YAML)

Topics can also be authored and published in YAML:

```yaml
topics:
  - id: for-loop
    title: For loops
    types: [python]            # optional — omit to show in all lesson types
    category: Loop
    summary: Repeats indented code once for each item in a sequence.
    description: |
      Use `python:range()` when you want to repeat code a particular number of times.

      > :info The loop variable `i` counts up automatically.
    syntax: |
      ```python
      for i in range(5):
          print(i)
      ```
    aliases:
      - for loop
      - for loops
    related:
      - range
      - variables
```

```bash
node cli/cli.mjs topics publish-yaml topics.yaml   # upsert all topics to Firestore
node cli/cli.mjs topics yaml-to-json topics.yaml   # validate without Firebase
node cli/cli.mjs topics upsert-library topics.yaml # save a YAML or JSON topic library
node cli/cli.mjs topics get for-loop --format yaml # fetch a topic as YAML
```

For full topic field reference see `docs/authoring/TOPIC_LIBRARY_SCHEMA.md`.

---

## Full YAML Example

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
    checks:
      - type: code_contains
        value: for
      - type: output_line_count
        value: 5

  - group: Challenge
    tasks:
      - title: Sum a range
        explainer: Add up all numbers from 0 to 9 and print the total.
        check:
          type: output_contains
          value: "45"
```
