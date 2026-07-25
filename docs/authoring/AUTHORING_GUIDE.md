# Lesson Authoring Guide

YAML-first reference for writing HSC lessons and topics. Use the CLI to convert YAML and publish to Firestore.

**Per-type authoring (task fields, checks, examples):**
- Python: `docs/authoring/python.md`
- Arcade Kit: `docs/authoring/arcade.md`
- HTML: `docs/authoring/html.md`
- Scratch: `docs/authoring/scratch.md`
- Filesystem: `docs/authoring/filesystem.md`
- Electronics: `docs/authoring/electronics.md`

**Other references:** `docs/authoring/quiz-tasks.md` · `docs/authoring/lesson-schema.md` · `docs/authoring/lesson-schema-yaml.md` · `docs/authoring/lesson-assets-cli.md` · `docs/authoring/markdown-renderer.md`

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

# fetch an existing lesson as YAML:
node cli/cli.mjs lessons get python-for-loops --format yaml
```

`test-checks` runs named source-code examples through the same code-check evaluator used by LaunchPad and reports any feedback checks that match. For example, `check-cases.yaml` can be:

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

```yaml
id: python-for-loops         # required — lowercase slug, used in URLs
type: python                 # required — python | html | scratch | filesystem | electronics
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

tasks: []                    # required — ordered task list (see below)
```

Sandbox-mode fields (`sandboxStarter`, `sandboxStarterFiles`, `sandboxToolbox`, `sandboxSprites`, `sandboxBackdrops`, `sandboxStarterFs`, `sandboxStarterCircuit`) are type-specific — see each per-type doc.

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
```

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

**Wildcards:** `*` matches any sequence (including newlines) in `value` for containment/equality checks.

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
| `group: "Title"` + `tasks:` | Group object with auto-generated ID |
| `checks:` (plural array) | `check:` (the JSON field name) |
| `answer: a` on a multiple_choice quiz | `check: { type: "answer_equals", value: "a" }` |

---

## Draft lessons

`draft` is a lesson-level boolean for CLI-first authoring. Draft tasks are always real tasks: omit task `type` for a code task, use `type: information` for information, or `type: quiz` for quizzes. There are no task-level draft records.

Every Draft task needs a `title`, its normal real task type, and a non-empty Markdown `intent`. `intent` is author-only: LaunchPad stores it but never renders it to students. Draft permits omitted learner-facing and task-specific fields so the task can be completed in Builder; it still rejects malformed field shapes and invalid type values.

```yaml
id: python-loops-draft
type: python
title: Python Loops (Draft)
description: A lesson in progress.
draft: true
tasks:
  - title: First counted loop
    intent: |
      Teach `range()` and have learners print the numbers 0–4.
```

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
node cli/cli.mjs topics get for-loop --format yaml # fetch a topic as YAML
```

For full topic field reference see `docs/authoring/TOPIC_LIBRARY_SCHEMA.md`.

---

## Full YAML Example (Python)

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
      - type: code
        operator: contains
        value: for
      - type: output_line_count
        operator: equals
        value: 5

  - group: Challenge
    tasks:
      - title: Sum a range
        explainer: Add up all numbers from 0 to 9 and print the total.
        check:
          type: output
          operator: contains
          value: "45"
```
