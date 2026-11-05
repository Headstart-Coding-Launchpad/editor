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
      text: while
      feedback: This runs until a condition is false, not a fixed number of times.
    - id: b
      text: repeat
      feedback: "`repeat` is used in Scratch, not Python."
    - id: c
      text: for
  answer: c             # the correct option's id — expands to check: {type: answer_equals, value: c}
```

Without the `answer:` shorthand:
```yaml
  check:
    type: answer_equals
    value: c
```

**Options show in the order you write them; they are never shuffled.** Vary where the right
answer sits from question to question, or students learn that it's always the first one.

**`answer` is the option's `id`** (e.g. `c`), not its text. If you write the option's text
instead, the converter swaps it for the matching option's id; a value that matches no option's
id or text fails validation.

A multiple-choice quiz takes exactly one `answer_equals` check (or the `answer:` shorthand): no
`checks:` list, no other check type, no `operator` form.

| Field | Required | Notes |
|---|:---:|---|
| `options` | Yes | At least two options. `id` is usually `a`, `b`, `c` etc. |
| `options[].id` | Yes | Stable identifier matched by the check. |
| `options[].text` | Yes* | Shown to students. Markdown supported, including fenced code and Scratch stacks. *On a [picture option](#picture-options) it is an optional caption. |
| `options[].image` | No | [Picture option](#picture-options): an `https://` URL, normally a lesson asset. Needs `alt`. Not with `emoji`. |
| `options[].emoji` | No | [Picture option](#picture-options): one emoji (one character as you see it) as the picture. Needs `alt`. Not with `image`. |
| `options[].alt` | With `image`/`emoji` | What the picture shows, in words, up to 200 characters. Names the card for screen readers (with the caption: "Fox: A fox in snow") and labels it in the tutor card, reports and print. |
| `options[].feedback` | No | Shown when this wrong option is selected. Markdown supported. |
| `options[].hint` | No | Older name for `feedback`, still read when `feedback` is missing. Use `feedback`. |
| `answer` | No | Shorthand for `check: {type: answer_equals, value: <id>}`. Option text is mapped to its id. |

### Picture options

Students pick a **picture** as the answer ("Which picture will this code draw?"). Give each
option an `image` (or an `emoji`) plus `alt`, and optionally a short `text` caption:

```yaml
- type: quiz
  title: Which Is on Top?
  explainer: 'This code runs: `circle(50, "red")` then `background("blue")`. What do you see?'
  options:
    - { id: a, image: "https://firebasestorage.googleapis.com/.../top-circle.png", alt: "Red circle above a blue background" }
    - { id: b, image: "https://firebasestorage.googleapis.com/.../blue-only.png", alt: "Only a blue background" }
    - { id: c, emoji: "🦊", alt: "A fox", text: "Fox" }   # text = optional caption under the picture
    - { id: d, image: "https://firebasestorage.googleapis.com/.../red-only.png", alt: "Only a red circle" }
  answer: b
```

- **Where pictures come from:** upload each PNG with `node cli/cli.mjs assets upload <lessonId> <file>`
  ([lesson-assets-cli.md](lesson-assets-cli.md)) and paste the URL it prints. Stage pictures: make
  them with the [`lessons screenshot`](lesson-screenshot-cli.md) command or a Stage export. Only
  `https://` URLs are accepted, by validation and again when the quiz draws the card: an image
  that is not `https://` is never loaded (the card shows the emoji instead, else the alt text in
  words), and an image that fails to load shows the same fallback, never an empty box. With no
  alt text (a validation error) the caption, else the option id, stands in for it. Images load
  lazily and send no referrer.
- **Layout:** 2 or 3 pictures sit side by side, 4 make a 2x2 grid, and the cards stack in one
  column when the options area is under 480px wide, going back to side by side only above 520px
  (measured on the quiz itself, so it also works in the tutor's student window and modal; the gap
  stops the layout flipping). Every card is the same size, with the caption under the picture.
  The picture is scaled to fit, never cropped: its height has a cap tied to the screen height
  (about a fifth of it, 96px to 200px; lower when the cards stack in one column), and its width
  follows its shape. The cards hug their pictures and the grid sits centred, so four squarish
  Stage pictures make a tidy 2x2 block, and a 2x2 grid plus a short question (code and a line)
  fits a 1366x768 or 1024x768 screen without scrolling. Export Stage pictures about 2:1 or
  square, cropped to the Stage only (no editor or window around it), about 400px wide. Cards are
  at least 120px tall at full size, easy to tap on an iPad; in a short pane they shrink with the
  rest of the quiz (down to 78px) so four stacked cards still fit above Next, and the options
  scroll only when even that does not fit.
- **Mixed options:** an option with no picture is drawn as a normal word card in the same grid
  (Markdown and code work as usual). It works, but validation warns, because the cards look
  uneven. A lesson stored with more than 4 options (a validation error) still shows all of them,
  in more rows.
- **Choosing:** one tap chooses and submits, exactly as with word options. The chosen card gets
  a tick badge and a thick outline. Keyboard: Tab to a card, Enter or Space (as for word options;
  no quiz in the app uses arrow keys). After submitting, screen readers also hear the verdict in
  words on the card ("Your answer", "Your answer, incorrect", "Correct answer").
- **Rules (validation):** `alt` is required on every picture (200 characters at most); `image`
  must be `https://`; an option has `image` or `emoji`, not both; `emoji` is exactly one emoji
  (a letter, digit or `?` is not); `image`, `emoji` and `alt` must be text; 2 to 4 options when
  any option has a picture; `text` may be empty on a picture option. An empty `image: ""` or
  `emoji: ""` counts as no picture (a placeholder is fine). Mixing picture and word-only options
  is a warning. Pictures work only on single-answer multiple-choice quizzes: on a poll (including
  a pick-several poll), match, fill-in or short-answer quiz they are an error. Quizzes with no
  pictures read exactly as before, everywhere.
- **Order:** as everywhere, options show in the order written. Shuffle them once when you write
  the lesson, so the tutor can say "picture B" to the whole room.
- **Tutor view:** the student card shows a small thumbnail of the chosen picture with its id and
  caption (or alt text); the student window shows the same grid with the chosen card ticked, and
  after a wrong answer the right picture under "Correct answer". Reports and print label an option
  by its caption, else its alt text, else its id; print shows the pictures (https only) beside an
  Alt text column.
- **Builder:** each picture option shows its picture, an alt text box (a missing alt is flagged in
  red) and a remove-picture button; the option text box is the caption. `image` and `emoji` are
  kept on every other edit. Adding a picture, or changing which picture, is done in the lesson
  YAML for now. A picture quiz stops at 4 options (Add option is disabled, with a note). Switching
  the quiz to another type (a poll, say) turns each picture into words (its caption, else its alt
  text), so the saved poll has no pictures and validates. This cannot be undone, so on a quiz with
  pictures the Builder asks first, inline under the quiz types: "Keep Multiple choice" changes
  nothing, "Continue" converts. Switching back to multiple choice gives word options; add the
  pictures again in YAML.

**A picture in the question** ("Which code drew this?") needs nothing new: put the picture in
the `explainer` as Markdown (`![Red circle in the middle](https://...)`) and keep code or word
options. The question panel shows it up to 240px tall (less on a short screen).

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

Tiles are shuffled on render. No `check` needed — completion is automatic when all pairs are correct, and any `check` is ignored. Markdown supported in both `prompt` and `answer`.

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

One `___` (three underscores) in `text` per entry in `blanks`, in order. No `check` needed; any `check` is ignored. `distractors` are ignored in type mode.

In a live lesson the tutor sees what a student has typed into the gaps before they press
Submit, as an unsubmitted draft (see [Live drafts](#live-drafts-what-the-tutor-sees-before-submit)).

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

Supported check types: `answer_equals`, `answer_not_equals`, `answer_contains`, `answer_not_contains`, `answer_matches_regex`, `answer_not_matches_regex`.

Give **one** check object, not a `checks:` list and not the general `type` + `operator` form. Anything else fails validation with "a check enabled but no check value", which is misleading: the value is fine, the shape isn't.

### Open-ended (teacher review only)

Omit `check` — any submitted text completes the task. The teacher sees each student's answer in the student grid.

#### Live drafts: what the tutor sees before Submit

In a live lesson the tutor sees what a student is typing before they submit, on both kinds of
short answer (and on typed fill-in-the-gaps). The student card shows a dashed **✏️ Typing, not
submitted:** line with the start of the draft; the student's StudentModal shows it in full
under **Still typing, not submitted yet**. Nothing changes on the student's screen.

A draft is never an answer: it is not checked, not counted as an attempt, never shown on the
presentation window, and does not trigger badges. Pressing Submit replaces it with the answer.
The draft is sent after the student stops typing for about 1.5 seconds, and live (about four
times a second) only while the tutor has that student open. The session report records a
student's last draft as `lastDraft` when they never submitted (see
[session-reports.md](session-reports.md)). Nothing to author.

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

Students rate confidence on a 1–10 scale: ten buttons from red (1, 👎) to green (10, 👍), and
one tap submits. Any rating completes the task, and a student can change their rating. The ten
buttons sit in one row on a tablet (each at least 44px) and wrap to two rows of five on a narrow
phone.

The tutor sees each student's rating on their card as **N/10**, and a **Class confidence** strip
above the student grid with how many students chose each number (click a number to outline those
students' cards). The session report records each rating with `ratingScale: 10`.

Every confidence check uses 1–10, including lessons written before 2026-10-09, which used 1–5;
there is nothing to change in them. There is no `scale` field: validation warns that one is
ignored.

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
| `multiple` | No | `true` makes it "Pick all that apply": students tick any number of options and can untick. The class split shows how many students picked each option ("7 of 12 picked this"), so the bars can add up to more than 100%. Default `false` (pick one). |
| `showResults` | No | `false` keeps the class split teacher-only. Default `true`. |

```yaml
- type: quiz
  quizType: poll
  title: Favourite tools
  explainer: Which of these have you used? Pick all that apply.
  multiple: true
  options:
    - id: a
      text: Scratch
    - id: b
      text: Python
    - id: c
      text: HTML
```

With `multiple: true` a student's answer (and each attempt's `submission` in the report) is a JSON
array string of the sorted ids, e.g. `["a","c"]`; `""` means nothing ticked.

No `check`, `answer:`, option `feedback` or task `feedback`: a poll is never marked (a `check`
is a validation error). For a quick question the teacher thinks of during a live lesson, use the
**📊 Poll** button in the teacher's top bar instead — no lesson change needed (see
`docs/FEATURES.md`).

---

## Quiz Check Types

These check types apply to quiz tasks regardless of which composed-lesson workspace module appears elsewhere in the lesson.

| Type | Fields | Notes |
|---|---|---|
| `answer_equals` | `type`, `value` | Multiple choice: the selected option's id equals `value`. Short answer: the answer equals `value` |
| `answer_not_equals` | `type`, `value` | Short answer: the answer is not `value` |
| `answer_contains` | `type`, `value` | Free-text answer contains value |
| `answer_not_contains` | `type`, `value` | Free-text answer does not contain value |
| `answer_matches_regex` | `type`, `value`, optional `flags` | Free-text answer matches regex |
| `answer_not_matches_regex` | `type`, `value`, optional `flags` | Free-text answer doesn't match regex |

Match and fill-in-the-blank quizzes take no check: they complete when every pair or blank is
right. (The Builder's preview calls this "quiz result"; it isn't a check type to write.)

The `answer:` shorthand on multiple choice tasks auto-generates `check: { type: answer_equals, value: <id> }`.

**Wildcard:** `*` in a non-regex `value` matches anything, so `value: "**"` passes every answer. To look for a real star, use `answer_matches_regex` with `\*`.

**Multi-option:** `"option1","option2"` format for `answer_contains` / `answer_not_contains` only — passes if the answer contains any option. **Regex:** `answer_matches_regex` uses JavaScript `RegExp(pattern, flags)` with optional `flags`; it is case-sensitive unless `flags: i` is set. All other answer comparisons are case-insensitive.
