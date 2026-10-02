# Quiz Tasks Reference

All six quiz sub-types. Set `type: quiz` on the task; the converter sets `taskType: "quiz"` in JSON.

Do not include code fields, carry fields, or `interactionMode` on quiz tasks.

For a drag-and-drop code exercise that genuinely runs (rather than a tile-identity
match), use `taskType: code_arrange` instead of `quizType: fill_blank` — see
"Code Arrange Task Fields" in `docs/authoring/lesson-schema.md`. It is a separate
task type alongside `python`/`html` code tasks, not a quiz sub-type, precisely
because it needs the code/output check fields this page says quiz tasks must not
carry.

**Saved answers.** A student's quiz answer is saved on their device as they answer, so it is
still there after a page reload or when they come back to the task (live lessons and solo
study; Presentation View and Builder preview keep it in memory only). Only the answer comes
back: the right/wrong banner and "submitted" state start fresh, and the student can answer
again. Nothing changes in the lesson format. Quizzes run in the classroom as activities (see
`docs/architecture/activities.md`); the table there lists how each sub-type is marked.

---

## Multiple Choice

Default `quizType` — omit `quizType` for multiple choice.

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
    - id: c
      text: repeat
      feedback: "`repeat` is used in Scratch, not Python."
  answer: a             # shorthand — expands to check: {type: answer_equals, value: a}
```

Without the `answer:` shorthand:
```yaml
  check:
    type: answer_equals
    value: a
```

| Field | Required | Notes |
|---|:---:|---|
| `options` | Yes | At least two options. `id` is usually `a`, `b`, `c` etc. |
| `options[].id` | Yes | Stable identifier matched by the check. |
| `options[].text` | Yes | Shown to students. Markdown supported, including fenced code and Scratch stacks. |
| `options[].feedback` | No | Shown when this wrong option is selected. Markdown supported. |
| `answer` | No | Shorthand for `check: {type: answer_equals, value: <id>}` |

---

## Match

Student drags tiles to match each prompt with its answer. Each placed tile gets immediate red/green feedback. All pairs must be correct.

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
    - id: "3"
      prompt: SSD
      answer: Permanent storage
```

Tiles are shuffled on render. No `check` needed — completion is automatic when all pairs are correct (equivalent to `quiz_result`). Markdown supported in both `prompt` and `answer`.

---

## Fill Blank

Student fills blanks in a sentence or code snippet. Each filled blank gets immediate red/green feedback.

### Drag mode (default)

```yaml
- type: quiz
  quizType: fill_blank
  title: Fill the blank
  text: A ___ repeats code while a condition is true.
  mode: drag
  blanks:
    - id: "1"
      answer: loop
  distractors:          # optional — extra wrong tiles in the bank
    - id: d1
      text: variable
    - id: d2
      text: function
```

### Type mode

```yaml
- type: quiz
  quizType: fill_blank
  title: Complete the code
  text: Use ___ to print text in Python.
  mode: type
  blanks:
    - id: "1"
      answer: print
```

One `___` in `text` per entry in `blanks`, in order. No `check` needed. `distractors` are ignored in type mode.

### Code blocks in text

Use triple-backtick fences in `text` to display a block of code. Blanks can appear inside the code block — they render inline at the correct position within the pre-formatted code.

```yaml
- type: quiz
  quizType: fill_blank
  title: Complete the loop
  text: |
    What goes inside the brackets?
    ```python
    for i in range(___):
        print(i)
    ```
  mode: drag
  blanks:
    - id: "1"
      answer: "10"
  distractors:
    - id: d1
      text: "0"
    - id: d2
      text: i
```

Blanks inside the code block and blanks in surrounding text can be mixed freely — they are assigned to `blanks` entries in the order they appear top-to-bottom.

Optionally specify a language after the opening fence for a styled code block (`python`, `html`, `css`, `js`). The closing ` ``` ` must be on its own line.

### Line breaks in text

A single newline in `text` renders as a line break. Use a YAML block scalar (`|`) to write multi-line text naturally:

```yaml
  text: |
    First line of the question.
    Second line with a ___ here.
```

---

## Short Answer

Student types a free-text answer.

### With automatic check

```yaml
- type: quiz
  quizType: short_answer
  title: What does CPU stand for?
  explainer: Type the full name of the CPU.
  check:
    type: answer_contains
    value: Central Processing Unit
```

Supported check types: `answer_equals`, `answer_contains`, `answer_not_contains`, `answer_matches_regex`.

### Open-ended (teacher review only)

Omit `check` — any submitted text completes the task. The teacher sees each student's answer in the student grid.

```yaml
- type: quiz
  quizType: short_answer
  title: What did you find hardest?
  explainer: Write one thing you found difficult in today's lesson.
```

#### Showing answers on the presentation window

For a discussion task (an opening "Show and tell", a closing "Where could you use this?"), add
`showResponses: teacher_picks`. In a live lesson each student card then gets a **📺 Show**
button once that student has answered: the teacher picks the answers to put on the
presentation window, where they replace the answer box under the question. Answers are shown
without names; the card's **👤** toggle turns a name on for one answer, and
`anonymiseResponses: false` makes names the default. **📺 On screen** takes an answer off
again. Students' own screens don't change. The session report lists every answer shown on the
task summary (`shownResponses`).

| Field | Values | Default |
|---|---|---|
| `showResponses` | `teacher_picks` | omitted: answers stay teacher-only |
| `anonymiseResponses` | `true` / `false` | `true` (no names) |

Only an open short answer (no `check`) can show answers: a graded quiz never broadcasts a
student's answer, and validation rejects `showResponses` alongside a `check`. In the Builder:
untick **Require a correct answer**, then tick **Teacher can show answers on the presentation
window**.

```yaml
- type: quiz
  quizType: short_answer
  taskMode: live
  priority: optional
  title: Show and tell
  explainer: What have you made, tried or played with since last lesson?
  showResponses: teacher_picks
```

---

## Confidence

Students rate confidence on a 1–5 scale (red to green). Any rating completes the task. Teacher sees each student's level in the student grid.

```yaml
- type: quiz
  quizType: confidence
  taskMode: live          # recommended — usually only useful in live sessions
  title: Confidence check
  explainer: How confident do you feel about **for loops** after today's task?
```

No `check`, `options`, `pairs`, `blanks`, or `text` fields.

---

## Poll

Students pick the option they prefer: an opinion, never right or wrong ("What would you like to
do next?", "Which project should we build?"). Any choice completes the task, and a student can
change their choice at any time. In a live lesson, once a student has chosen they see how the
class voted (a percentage bar per option, never who chose what), and the presentation window
shows the split live; set `showResults: false` to keep it to the teacher. Solo study and the
Builder preview never show a split. The teacher sees each student's choice on their card in the
student grid, and the session report
counts each option (`optionDistribution` in `taskSummary`, see
[session-reports.md](session-reports.md)).

```yaml
- type: quiz
  quizType: poll
  taskMode: live          # optional — most useful in live sessions, but works in solo study
  title: What next?
  explainer: Which would you like to try **next week**?
  options:
    - id: a
      text: Make a game
    - id: b
      text: Draw with code
    - id: c
      text: Build a website
```

| Field | Required | Notes |
|---|:---:|---|
| `options` | Yes | 2 to 6 options, shown in the order written (not shuffled). |
| `options[].id` | Yes | Stable identifier, usually `a`, `b`, `c`. Reported in `distinctAttempts[].submission`. |
| `options[].text` | Yes | Shown to students. Markdown supported. |

No `check`, `answer:`, option `feedback` or task `feedback`: a poll is never marked (a `check`
is a validation error). For a quick question the teacher thinks of during a live lesson, use the
**📊 Poll** button in the teacher's top bar instead — no lesson change needed (see
`docs/FEATURES.md`).

---

## Quiz Check Types

These check types apply to quiz tasks regardless of which composed-lesson workspace module appears elsewhere in the lesson.

| Type | Fields | Notes |
|---|---|---|
| `answer_equals` | `type`, `value` | Selected option ID or text equals value |
| `answer_contains` | `type`, `value` | Free-text answer contains value |
| `answer_not_contains` | `type`, `value` | Free-text answer does not contain value |
| `answer_matches_regex` | `type`, `value` | Free-text answer matches regex |
| `quiz_result` | `type` | All pairs/blanks correct (match, fill_blank). No `value` needed. |

The `answer:` shorthand on multiple choice tasks auto-generates `check: { type: answer_equals, value: <id> }`.

**Multi-option:** `"option1","option2"` format for `answer_contains` — passes if the answer contains any option. **Regex:** `answer_matches_regex` uses JavaScript `RegExp(pattern, flags)` with optional `flags`; it is case-sensitive unless `flags: i` is set. All other answer comparisons are case-insensitive.
