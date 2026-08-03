# Quiz Tasks Reference

All five quiz sub-types. Set `type: quiz` on the task; the converter sets `taskType: "quiz"` in JSON.

Do not include code fields, carry fields, or `interactionMode` on quiz tasks.

For a drag-and-drop code exercise that genuinely runs (rather than a tile-identity
match), use `taskType: code_arrange` instead of `quizType: fill_blank` — see
"Code Arrange Task Fields" in `docs/authoring/lesson-schema.md`. It is a separate
task type alongside `python`/`html` code tasks, not a quiz sub-type, precisely
because it needs the code/output check fields this page says quiz tasks must not
carry.

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
