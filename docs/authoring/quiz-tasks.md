# Quiz Tasks Reference

All five quiz sub-types. Set `type: quiz` on the task; the converter sets `taskType: "quiz"` in JSON.

Do not include code fields, carry fields, or `interactionMode` on quiz tasks.

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
| `options[].text` | Yes | Shown to students. Markdown supported. |
| `options[].feedback` | No | Shown when this wrong option is selected. Markdown supported. |
| `answer` | No | Shorthand for `check: {type: answer_equals, value: <id>}` |

---

## Match

Student drags tiles to match each prompt with its answer. All pairs must be correct.

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

Student fills blanks in a sentence.

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
