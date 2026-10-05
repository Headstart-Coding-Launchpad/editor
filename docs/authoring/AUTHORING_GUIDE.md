# Lesson Authoring Guide

YAML-first reference for writing HSC lessons and topics. Use the CLI to convert YAML and publish to Firestore.

**Workspace module code-task authoring (task fields, checks, examples):**
- Python: `docs/authoring/python.md`
- Arcade Kit: `docs/authoring/arcade.md`
- Python Turtle: `docs/authoring/turtle.md`
- HTML: `docs/authoring/html.md`
- Scratch: `docs/authoring/scratch.md`
- Filesystem: `docs/authoring/filesystem.md`
- Electronics: `docs/authoring/electronics.md`

**Other references:** `docs/authoring/CHANGELOG.md` · `docs/authoring/validation-errors.md` · `docs/authoring/feedback-cli.md` · `docs/authoring/quiz-tasks.md` · `docs/authoring/lesson-schema.md` · `docs/authoring/lesson-schema-yaml.md` · `docs/authoring/lesson-assets-cli.md` · `docs/authoring/markdown-renderer.md`

---

## Quick Start

```bash
node cli/cli.mjs lessons publish-yaml lesson.yaml          # one step: convert, validate, publish

# or step by step:
node cli/cli.mjs lessons yaml-to-json lesson.yaml          # validate + preview JSON
node cli/cli.mjs lessons yaml-to-json lesson.yaml --output lesson.json
node cli/cli.mjs lessons upsert lesson.yaml                 # accepts YAML or JSON

# verify code checks against named student-code examples (JSON or YAML cases file):
node cli/cli.mjs lessons test-checks lesson.yaml --cases check-cases.yaml

# verify Scratch block checks against each task's complete, starter and Complete stages (no cases file):
node cli/cli.mjs lessons test-checks lesson.yaml

# fetch an existing lesson as YAML:
node cli/cli.mjs lessons get python-for-loops --format yaml
```

`test-checks` runs named source-code examples through the same code-check evaluator used by LaunchPad and reports any feedback checks that match. Without `--cases` it verifies Scratch tasks instead, per check and per stage — see [Verifying Scratch checks](scratch.md#verifying-scratch-checks). For example, `check-cases.yaml` can be:

**Limitation:** `test-checks` only evaluates source-code checks. A task carrying an `output`, `output_not_empty`, `output_line_count`, `code_no_error`, or `variable_*` check has no run behind it here, so it reports a false `completion: fail` against its own correct complete code — indistinguishable from a genuinely broken check. To verify the source-code half of a lesson that mixes families, run `test-checks` against a stripped copy of the YAML with the runtime checks removed, and verify the runtime checks by reasoning against the task's complete code instead. The cases format has no field for stdin or expected output.

```yaml
tasks:
  - id: 4
    cases:
      - name: alternate variable name
        code: |
          for number in range(3):
            print("Hello world")
        completion: pass
```

---

## Lesson Envelope

<!-- example:template -->
```yaml
id: python-for-loops         # required — lowercase slug, used in URLs
type: composed               # required for every new lesson
title: Python For Loops      # required
description: Practise loops. # required — shown on the entry screen
draft: false                 # optional; true enables incomplete real tasks while authoring
version: 3                   # LaunchPad-managed save version; do not set it in source YAML
level: 1                     # optional — difficulty badge in the TopBar

# Assets
assetsPath: scratch-assets   # optional — base URL for image assets
assets:                      # optional — files shown in AssetBrowser
  - sprites/rocket.png
storageAssets:               # optional — Firebase Storage files
  - name: logo.png
    url: https://firebasestorage.googleapis.com/...
    showInEditor: true       # optional — show in web editor asset panel

modules: []                  # optional named workspace instances; see lesson-schema-yaml.md

tasks: []                    # required — ordered task list (see below)
```

Each code task in a composed lesson needs `moduleType`: `python`, `arcade`, `turtle`, `html`, `scratch`, `filesystem`, or `electronics`. Add `modules` plus task `moduleId` when a lesson needs named or repeated workspace instances. Put module-specific sandbox configuration in `modules[].sandbox`; see `lesson-schema-yaml.md` for the full model.

---

## Common Task Fields

These apply to every task type.

```yaml
tasks:
  - id: 1                    # optional — auto-assigned if omitted
    title: Task title         # required (also in Draft)
    explainer: |              # required in a final lesson — Markdown shown to students
      Instructions here.
    estimatedMinutes: 5       # optional — teacher countdown
    priority: core            # optional — core (default) | optional; teacher-facing only
    taskMode: both            # optional — both (default) | live | solo
    intent: |                 # authoring-only Markdown; never shown to students
      Describe the complete authoring brief for this task.
    # taskType omitted = code task; use information or quiz for non-code tasks
    moduleType: python        # required on every code task in a new composed lesson
```

**Line hints in starter code.** Instead of instructions in code comments, Python, Turtle and HTML starter code (and code stages) can carry marker lines that are shown beside the next line and never become part of the student's code: `#> Change the colour here` (Python, Turtle) or `<!--> Add a heading here -->` (HTML). See [python.md](python.md#line-hints) and [html.md](html.md#line-hints).

---

## Information Tasks

```yaml
  - type: information         # sets taskType: "information" in JSON
    informationType: standard # standard (default) | recap | introduction | badges
    title: How loops work
    explainer: A `for` loop repeats code a fixed number of times.
    # For recap (two-pane view):
    # leftContent: |          # purple left pane
    #   Key points here
    # explainer: |            # white right pane
    #   More detail here
    # introduction renders lesson title/level/description — no explainer needed
```

**Badge Summary ("Today's Coding Moments").** `informationType: badges` shows the live session's
coding moments: each student sees their own badges as stickers, then the class wall grouped by
badge ("🐛 Bug Hunter: Alex, Sam"); the teacher sees a projector-friendly wall with **Copy class
summary**. The title is shown exactly as written (no emoji is added), so start it with one if you
want one; with no title it defaults to "🎖️ Today's Coding Moments". The explainer is optional
(shown above the wall). Put it last. Solo learners skip it, as if it were `taskMode: live`. See
[badges.md](badges.md#badge-summary-task).

```yaml
  - type: information
    informationType: badges
    title: "🎖️ Today's Coding Moments"   # shown exactly as written
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

## Activity Tasks

An activity is a bounded exercise that can sit anywhere in a lesson, between code tasks of any
module: no Run button, sandbox, sharing or carry-through. Progress is saved on the device, shown
on the teacher's student card and marked when the student checks their answers.

```yaml
  - type: binary              # sets taskType: "activity", activityType: "binary" in JSON
    title: Make the numbers
    description: Click the bits to turn them on.
    mode: make_number
    bits: 4
    items:
      - id: a
        target: 5
```

| Activity | YAML `type:` | Authoring page |
|---|---|---|
| Binary (bits, conversions, addition, overflow, hex, ASCII, pixels) | `binary` | [activities/binary.md](activities/binary.md) |
| Keyboard skills (typing, Shift capitals, UK symbols, shortcuts) | `keyboard` | [activities/keyboard.md](activities/keyboard.md) |
| Mouse skills (click, double-click, right-click, drag, scroll, hover) | `mouse` | [activities/mouse.md](activities/mouse.md) |

- The explicit JSON form `taskType: activity` + `activityType: <id>` also works in YAML;
  `lessons export` writes the `type:` shorthand. Quizzes stay `type: quiz` + `quizType`.
- `node cli/cli.mjs lessons capabilities` lists every activity with its modes and fields
  (`fields`, `fieldsByMode`, and `authoredFields` for the content paths such as
  `items[].text`), each module's own task fields, the common task fields (`taskFields`), every
  check type, and the open authoring requests (`requests`).
- In the **Builder**, choose the **Activity** task format and pick from the gallery. Each
  activity has its own editor (modes, items, options) with validation shown next to the field it
  is about, and a student preview you can play. Switching format keeps the title and
  description and drops the fields the new format doesn't use.
- An `activityType` this version doesn't know is a validation error; students would see a
  "not available" notice.

---

## Checks

### Check shape

```yaml
check:
  type: output
  operator: contains
  value: Hello
  hint: Check that your print statement says `Hello`.   # optional
```

### Multiple checks (all must pass)

```yaml
checks:                       # plural — converter maps to check:
  - type: code
    operator: contains
    value: for
  - type: output_line_count
    operator: equals
    value: 5
```

### Feedback checks

```yaml
check:
  type: output
  operator: contains
  value: Hello Headstart
feedbackChecks:
  - type: output
    operator: contains
    value: Hello World
    mode: blocking
    show: after_attempt
    hint: Change `Hello World` to `Hello Headstart`.
```

`feedbackChecks` are supported by Python, HTML, Filesystem, Electronics, and Scratch tasks and require a completion `check`. Blocking feedback fails the task if it matches, even when the completion check passes. `mode: nudge` shows guidance without blocking completion. `show` defaults to `after_attempt`; use `on_idle` to show feedback after the learner pauses editing. For HTML, `on_idle` is limited to code-safe checks; DOM/output feedback should run `after_attempt`. `incorrectChecks` is a legacy alias for blocking feedback, and legacy `show: on_pause` is treated as `on_idle`.

### Which hint is shown

A learner only ever sees **one** hint per attempt. Every module (Python, HTML, Turtle, Arcade, Filesystem, Desktop, Electronics, Scratch) picks it with the same rule, in this order:

1. **A blocking feedback check matched** → the task fails (even if the completion checks passed) and the hint of the highest-priority matched feedback check is shown. With no hint, the learner sees "Not quite."
2. **The completion checks failed and any feedback check matched** (blocking or nudge) → the highest-priority matched feedback check's hint. Feedback hints always beat completion-check hints.
3. **Otherwise** → the hint of the **first** entry in the `check` list (top to bottom) that **failed** and has a non-empty `hint`. A check that passed never supplies the hint, and later failed checks are not shown.
4. **No failed check has a hint** → the generic banner: "Not quite, try again!" ("Not quite right, try again." on quiz-like tasks).

When the completion checks pass, only a matched `mode: nudge` feedback check's hint is shown, next to "Correct!".

**Priority:** among matched feedback checks, the lowest `priority` number wins (1 beats 2). A feedback check without `priority` takes its position in the list (first = 1), so list order decides ties.

Writing hints that reach learners:

- Order completion checks **most specific first**, or give every completion check its own `hint`. A specific check placed after a general one only shows its hint when the general one passes.
- For a known misconception (wrong text, `=` instead of `==`, a missing indent), write a `feedbackChecks` entry that detects the mistake and give it a `priority`. It beats every completion hint.
- Don't write several hints expecting them to add up: only one is shown.

#### When the code can't run (SyntaxError)

When a Python run ends in an error — a `SyntaxError` such as `def area(w, h) =return w * h`, or a runtime error such as `NameError` — the task **always fails**, whatever the checks say. The checks are still evaluated, though, so the learner still gets a targeted hint chosen by the same four rules above:

- **`feedbackChecks` are evaluated as normal**, against the source as typed and against the error text in the output. A `code` regex feedback check that detects the slip (for example `matches_regex: '=\s*return'`) **does match**, and its hint wins over every completion-check hint (rule 2).
- **If no feedback check matches**, the hint comes from the **first failed completion check that has a `hint`** (rule 3). On an errored run, each completion check type behaves like this:

| Completion check type | On an errored run | Can it supply the hint? |
|---|---|---|
| `code` (and `code_contains`, `code_matches_regex`, … aliases), `code_structure` | Evaluated normally against the source text — the code does not need to parse | Yes, when it fails; a passing source check is skipped over |
| `code_no_error` | Always fails (the run status is `error`) | Yes — if it is first in the list with a `hint`, that hint is shown |
| `variable_*` (`variable_equals`, `variable_exists`, …) | Always fails on a `SyntaxError` (nothing ran, so no variables were captured). On a runtime error, only variables assigned before the crash exist | Yes |
| `output`, `output_line_count`, `output_not_empty`, `output_empty` | Compared against the output, which is the **error message** (plus anything printed before a runtime error). So `contains` normally fails, while `not_contains`, `not_equals` and `output_not_empty` usually **pass** | Only when the comparison fails |

The practical consequences:

- **Order completion checks so the hint you want for broken code comes first.** If `code_no_error` with `hint: "Your code has an error — read the red message."` is first, every broken run shows that hint. If a `code` check that the broken code still satisfies is first, the next failing check supplies the hint instead.
- **Catch a predictable syntax slip with a `feedbackChecks` regex** on the source. It fires even though the code could not run, and it beats the completion-check hints.
- A task with `tests` skips this check-and-hint path entirely; the per-test results are shown instead.

**Wildcards and option lists:** `*` matches any sequence (including newlines) in `value` for containment/equality checks. `"opt1","opt2"` passes `contains` if any option is present and `not_contains` only if none are. These operators mean the same thing in every module (output, answers, file content, HTML elements, Scratch block inputs), because all of them use one shared implementation (`compareText` in `src/shared/checkHelpers.js`).

**Multi-option values:** `"option1","option2"` format — passes if the actual value matches any option. Works for `output_contains`, `code_contains`, `element_value`, `answer_contains`.

**Case sensitivity:** Regex checks use JavaScript `RegExp`; add `flags: i` for case-insensitive regex. All other string comparisons are case-insensitive.

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
          operator: equals
          value: 5

      - title: Loop variable
        explainer: Use the loop variable inside the loop body.
        check:
          type: code
          operator: contains
          value: "print(i)"
```

Groups cannot be nested. Group IDs are auto-generated.

---

## YAML Shorthands

| YAML | Becomes in JSON |
|---|---|
| `id` omitted | Auto-assigned sequential integers (1, 2, 3 …) |
| `type: information` on a task | `taskType: "information"` |
| `type: quiz` on a task | `taskType: "quiz"` |
| `type: binary` (any activity) on a task | `taskType: "activity"`, `activityType: "binary"` |
| `group: "Title"` + `tasks:` | Group object with auto-generated ID |
| `checks:` (plural array) | `check:` (the JSON field name) |
| `answer: a` on a multiple_choice quiz | `check: { type: "answer_equals", value: "a" }` |

---

## Draft lessons

`draft` is a lesson-level boolean for CLI-first authoring. Draft tasks are always real tasks: omit task `type` for a code task, use `type: information` for information, or `type: quiz` for quizzes. There are no task-level draft records.

Every Draft task needs a `title`, its normal real task type, and a non-empty Markdown `intent`. `intent` is author-only: LaunchPad stores it but never renders it to students. Draft permits omitted learner-facing and task-specific fields so the task can be completed in Builder; it still rejects malformed field shapes and invalid type values.

Quote a task (or lesson) `title` written as a plain YAML scalar if it contains a colon followed by a space (e.g. `📋 Recap: Lists and Indexing`), or if it pairs a leading emoji with enough following text to make the line long — either can make js-yaml (used by `lessons upsert`/`validate` and `list-lesson-tasks.mjs`) throw `YAMLException: bad indentation of a mapping entry`, with the error pointing at a different line than the actual offending title. Quoting the title (`title: "📋 Recap: Lists and Indexing"`) fixes it with no other change needed.

```yaml
id: python-loops-draft
type: composed
title: Python Loops (Draft)
description: A lesson in progress.
draft: true
tasks:
  - title: First counted loop
    moduleType: python
    intent: |
      Teach `range()` and have learners print the numbers 0–4.
```

#### Multi-group Draft example

A fuller skeleton: an introduction, two groups (`group:` + `tasks:`; groups can't nest), code tasks
with intent, a quiz and an activity, and a recap. Every task has a `title` and an `intent`, and a
`taskActivity` naming its [Glossary pattern](badges.md#task-activity-patterns) (badges and reports
read it; an unrecognised pattern is a warning, not an error).

```yaml
id: python-loops-skeleton
type: composed
title: Python Loops
description: Repeat code with for loops and range().
level: 2
draft: true
tasks:
  - type: information
    informationType: introduction
    title: Python Loops
    taskActivity: Information
    intent: |
      Lesson opener. Renders the lesson title, level and description only.

  - group: Counting with range()
    tasks:
      - type: information
        title: What a loop does
        taskActivity: "Information: Brief Description"
        intent: |
          Explain that a `for` loop repeats the indented lines once per number in `range()`.
      - title: Run a counted loop
        moduleType: python
        taskActivity: Code Task, Complete Example
        intent: |
          Complete example: `for i in range(5): print(i)`. Learners run it and see 0–4.
      - title: Count to ten
        moduleType: python
        taskActivity: Code Task, Meaningful Change
        intent: |
          Starter is the previous loop; learners change `range(5)` so it prints 0–9.
          Check: output has 10 lines.
      - title: Copy the times table
        moduleType: python
        taskActivity: Code Task, Copy the Code
        intent: |
          Learners type out a 3-times-table loop shown in the explainer. Check: output contains 30.
      - type: quiz
        quizType: multiple_choice
        title: How many times?
        taskActivity: "Quiz: What Do You Expect the Code to Do"
        intent: |
          Show `for i in range(3): print("hi")` and ask how many times "hi" prints (answer: 3).

  - group: Loops that go wrong
    tasks:
      - title: Fix the broken loop
        moduleType: python
        taskActivity: Code Task, Debug Code Task
        intent: |
          Starter is missing the colon after `range(4)`. Learners fix it so 0–3 print.
      - type: quiz
        quizType: multiple_choice
        title: Spot the error
        taskActivity: "Quiz: What Is the Error?"
        intent: |
          A loop body that isn't indented; ask which line causes the IndentationError.
      - type: binary
        mode: to_decimal
        title: Count in binary
        taskActivity: "Activity, Binary: to_decimal"
        intent: |
          Warm-down: three 4-bit numbers (0011, 0101, 1000) to convert to decimal.
      - title: Your own pattern
        moduleType: python
        taskActivity: Code Task, Challenge (Open-Ended)
        intent: |
          Open-ended: learners use a loop to print any repeating pattern they like.
          Check: code contains `for` and output has at least 3 lines.

  - type: information
    informationType: recap
    title: Recap
    taskActivity: Information
    leftContent: "## What we covered"
    explainer: |
      - `for i in range(5):` repeats the indented lines 5 times.
      - `i` counts up from 0.
      - Every loop line ends with a colon, and the body is indented.
    intent: |
      Recap the three loop rules from both groups.
```

- **Introduction** (`informationType: introduction`) renders the lesson's `title`, `level` and
  `description` only: it never shows `explainer` or `leftContent`, so leave both out.
- **Recap** (`informationType: recap`) uses `leftContent` for the purple left pane. The canonical
  style is a **single `## ` heading and nothing else** (`leftContent: "## What we covered"`); put
  the recap body in `explainer` (the right pane).
- A Draft task may leave out its learner-facing fields (`explainer`, `starterCode`, `check`, quiz
  `options`, activity `items`), but any field it does include must have the right shape.

`lessons validate` validates Draft structure. `lessons upsert` creates or replaces Draft lessons, and `lessons get <id> --format yaml` retrieves the current authoritative YAML. Builder permits incomplete tasks while `draft: true`, preserves recognised task fields, task IDs, task order, and intent when it saves, and runs full final validation when Draft is cleared. It refuses to clear Draft if final validation fails. `publish-yaml` refuses lessons that remain drafts.

Do not use lesson stages, `taskType: draft` or `type: draft`, intended-type fields, or review-note metadata.

### Draft, final, and metadata command behaviour

| Command | Draft lesson (`draft: true`) | Final lesson (`draft: false` or omitted) |
|---|---|---|
| `lessons validate <file>` | Validates the lesson envelope, real task types, titles, non-empty intents, and field shapes. | Runs all ordinary lesson validation requirements. |
| `lessons upsert <file>` | Creates or replaces a validated Draft lesson. | Creates or replaces a fully validated lesson. |
| `lessons preflight <file>` | Validates Draft structure and checks Topic Library references against LaunchPad. | Validates the lesson and checks Topic Library references against LaunchPad. |
| `lessons publish-yaml <file>` | Refuses to publish. Clear Draft first. | Validates, checks Topic Library references, and publishes. |
| `lessons get <id> --format yaml` | Returns the current authoritative Draft YAML. | Returns the current authoritative final YAML. |

`version`, `intentLastChangedAt`, and `taskLastChangedAt` are LaunchPad-managed. Callers must not set them. The CLI and Builder use last-writer-wins writes: the latest accepted save replaces the previous lesson state. A material save increments `version`; a no-op save leaves `version` and all timestamps unchanged. `intentLastChangedAt` changes only when `intent` changes, while `taskLastChangedAt` changes only when learner-facing task content or configuration changes.

### Topic planning

Use task-level `topicLinks` as plain IDs while authoring. If an ID does not exist in the current Firestore Topic Library, describe it once at lesson level:

```yaml
topicProposals:
  - id: range-function
    title: The range() function
    description: Produces a sequence of numbers commonly used by loops.
    status: proposed
```

Use `status: deferred` when the missing topic is intentionally postponed. Do not put task usage in proposals; the builder derives that from every task's `topicLinks` and embedded `[[topic-id]]`, `[[topic-id|label]]`, or `#topic/topic-id` links.

Saving is blocked until every referenced topic exists in Firestore. Unused proposals warn but do not block.

```bash
node cli/cli.mjs lessons topics python-loops-draft
node cli/cli.mjs lessons topics python-loops-draft --format yaml
```

When preparing the final lesson, embed topic links in the student-facing prose where they should appear to learners. Recreation, from-memory, and independent tasks should normally include a learner-facing topic link in the prompt or hint; `topicLinks` metadata alone does not provide learner support.

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
node cli/cli.mjs topics upsert topic.yaml          # save a single bare topic object (no `topics:` wrapper)
node cli/cli.mjs topics get for-loop --format yaml # fetch a topic as YAML
```

For full topic field reference see `docs/authoring/TOPIC_LIBRARY_SCHEMA.md`.

---

## Full YAML Example (Composed)

One lesson that mixes an information task, a quiz, a Scratch task, a Python task with starter and
complete stages, and a group holding a Turtle challenge. It passes `lessons validate`; a test runs
every complete lesson example in these docs through the validator.

```yaml
id: loops-three-ways
type: composed
title: Loops Three Ways
description: Repeat actions with Scratch blocks, Python and a turtle.
modules:
  - id: python-practice
    type: python
    title: Python practice
    sandbox:
      sandboxStarter: "print('Try a loop here')"
tasks:
  - type: information
    title: Read first
    explainer: |
      A loop repeats the same steps. Scratch uses a **repeat** block; Python uses `for`.

  - type: quiz
    title: Quick check
    explainer: Which Python function generates a range of numbers?
    options:
      - id: a
        text: "`range()`"
      - id: b
        text: "`repeat()`"
        feedback: "`repeat()` is a Scratch block, not a Python function."
    answer: a

  - title: Repeat a move
    moduleType: scratch
    explainer: Make the cat move ten times using a **repeat** block.
    sprites:
      - id: sprite1
        name: Cat
        type: cat
        x: 0
        y: 0
        size: 100
        direction: 90
    starterBlocks:
      sprite1:
        blocks:
          languageVersion: 0
          blocks:
            - type: event_whenflagclicked
              x: 40
              y: 40
    check:
      type: block_used
      opcode: control_repeat

  - title: Print numbers
    moduleType: python
    moduleId: python-practice
    explainer: Print the numbers 0 to 4, one per line.
    codeStages:
      - label: Starter
        role: starter
        code: |
          # Print 0 to 4 with a for loop
      - label: Complete
        role: complete
        code: |
          for i in range(5):
              print(i)
    checks:
      - type: code
        operator: contains
        value: for
      - type: output_line_count
        operator: equals
        value: 5

  - group: Challenge
    tasks:
      - title: Draw a square
        moduleType: turtle
        explainer: Use a loop to draw a square with sides of 100.
        codeStages:
          - label: Starter
            role: starter
            code: |
              import turtle
        checks:
          - type: turtle_path_closed
            tolerance: 2
          - type: turtle_segment_count
            operator: equals
            value: 4
```
