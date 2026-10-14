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
    showBlocks: false         # optional — hide the editor's block brackets (default true)
    slowMo: { enabled: true } # optional — step through the run line by line; see Slow-mo
    check:
      type: output
      operator: contains
      value: Hello Headstart
```

**`interactionMode` combinations:**
- `run` or omitted: Run executes Python; checks run against output/code/variables/status.
- `submit`: Submit checks code text only; use only submit-compatible checks (`type: code`).
- `tests` present: **Run Tests** button appears. Only **Run Tests** sets task completion. Plain **Run** stays interactive.

**Block brackets (`showBlocks`):** the Python editor draws a coloured bracket beside the lines each `:` line (`if`, `elif`, `else`, `for`, `while`, `def`, …) controls, and colours that colon to match. The colour follows the header's depth, so an `elif`/`else` shares its `if`'s colour. A header whose next line isn't indented gets no bracket, which is itself the clue. Students and tutors can hide the brackets with the editor's **Blocks** button (remembered on that device). Set `showBlocks: false` on a task to hide both the brackets and the button, for example once a level should read indentation unaided. The Builder's **Block brackets** checkbox sets the same field. The same field works on Turtle, Arcade Kit and Electronics (MicroPython) tasks.

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

## Side-quests

A Python code task can carry up to three optional, unchecked `sideQuests` (`title`, `kind`,
`explainer`, `starter`) that a student opens in their own scratch Python editor once they pass
the task. They never change the task's code or what `carryCodeFrom` copies. See
[Side-quests](AUTHORING_GUIDE.md#side-quests).

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

Variables are read from the program's top level when it ends, **including when it stops with an
error** (since 2026-10-14; before that an erroring run had no variables). A run that errors still
fails completion, so this only matters to feedback checks.

---

## Name-Tag Panel (`showVariables`)

Shows students what their program is **holding**, not just what it printed: one name tag per
variable, with its name, a small type label and its value. Off unless a task sets
`showVariables`. Works on Python and [Turtle](turtle.md#name-tag-panel-showvariables) tasks.

```yaml
# View: show the variables after Run (or at the #@peek line)
- id: 12
  moduleType: python
  title: What did input() store?
  showVariables:
    mode: view          # view (default) | predict | target
    at: end             # end (default) | marker — stop at the #@peek line
    hide: [answer2]     # optional: names never shown
  codeStages:
    - role: starter
      code: |
        name = input("Name? ")
        shout = name.upper()
        print("Hi " + shout)

# Predict: students fill empty tags BEFORE running; Run marks each one ✓ or ✗
- id: 13
  moduleType: python
  title: What's in the variables?
  showVariables:
    mode: predict
    predict: [score, lives]   # the tags students fill in
  codeStages:
    - role: starter
      code: |
        score = 5
        lives = 3
        score = score + 5
        lives = lives - 1
  check:
    - type: variables_predicted   # every listed prediction was right
      names: [score, lives]

# Target: target tags; each turns green (✓ On target) when the variable matches after Run
- id: 14
  moduleType: python
  title: Hit the target
  showVariables:
    mode: target
    target:
      score: 10
      lives: 2
      bag: ["key", "map"]
  check:
    - { type: variable_equals, name: score, value: 10 }
    - { type: variable_equals, name: lives, value: 2 }
    - { type: variable_array_equals, name: bag, value: ["key", "map"] }
```

| Field | Notes |
|---|---|
| `mode` | `view` (default): show the variables after Run. `predict`: the student types what each `predict` variable will hold, then Run reveals ✓ / ✗ per tag. `target`: the panel shows each `target` value; a tag turns green with ✓ when the variable matches after Run, and an unmade variable reads "not made yet". |
| `at` | `end` (default): the values when the program finishes, or when it stops with an error. `marker`: the values the **first time** the program is about to run the line after a `#@peek` line (below). |
| `hide` | Names never shown (on top of the ones always hidden). |
| `predict` | Predict mode: the variable names students predict, in order. Required in predict mode. |
| `target` | Target mode: `{ name: value }`. Values are YAML: numbers, text, `true`/`false`/`null`, lists and dicts. Required in target mode. The green tags are **display only** — the `variable_*` checks decide completion, so add them. |

**What a tag shows.** One tag per variable, in the order the code first names them. Type labels:
`text`, `number`, `true/false`, `list`, `dict`, `None` (and `tuple`, `set`, or the Python type name
for anything else). Text keeps its quotes, so `"5"` and `5` look different. Lists show a row of
tiles with the index under each; dicts show key → value rows. Long text, long lists and nested
values are cut short with a **Show all** button. If the student runs again, tags whose value
changed are marked "changed". Always hidden: imported modules, functions, classes, `__dunder__`
names and anything imported from the `turtle` module.

**The `#@peek` marker.** With `at: marker`, put a line reading `#@peek` in the starter code just
above the line to stop at. Like a [`#>` line hint](#line-hints) it is stripped before the student
sees the code, and it follows that line if the student moves code about (it is lost if the line is
deleted or duplicated, and the panel then shows the end of the run). The panel shows the variables
when the program is **about to run** the marked line for the first time — so a peek above
`shout = name.upper()` shows `name` but not yet `shout`. Inside a function the tag set includes
that function's own variables. If the program never reaches the line (a branch that didn't run),
the panel says so and shows the end of the run. Only the first `#@peek` in the code counts; it
attaches to the next line of code, skipping blank and comment lines.

**`variables_predicted` check** (`names` optional — default: every `predict` name). Passes when
every listed prediction matches the value the panel shows after Run, using a forgiving
comparison decided by the real value's type:

- **text**: quotes optional (`Sam`, `"Sam"` and `'Sam'` all match `"Sam"`); spaces around it don't
  matter, capitals do.
- **number**: `5`, `5.0` and `5.00` all match `5`; `"5"` in quotes is text, so it does **not** match
  the number `5` — that's the point.
- **True / False / None**: any capitals.
- **list, tuple, set, dict**: written as Python (`[1, 2]`, `("a", 2)`, `{"a": 1}`), each item by the
  same rules; set order is ignored.

Use it only with `mode: predict`; validation rejects it otherwise, and names it lists must be in
`predict`. It needs a real run, so `lessons test-checks` reports it as needing a run. Each Run in
predict mode (with changed predictions) is recorded for the session report's `predictions`.

**Tutor view.** The student card shows a 🏷️ chip ("Predicted 2/3", then "2/3 right"; "1/3 on
target" in target mode), and StudentModal shows the student's panel with their predictions as
they type them. In **Go Live** the presenter's panel, predictions included, shows on every
screen.

**Devices.** The panel sits under the output (Python) or between the drawing and the output
(Turtle). On narrow screens it stacks under the code and stays usable with the on-screen keyboard;
inputs and buttons are at least 44 px on touch screens. Every tag has a screen-reader text such as
"score: number 10", and ✓ / ✗ always come with words.

---

## Slow-mo (`slowMo`)

`slowMo` lets students watch their program run one line at a time: which line ran, what each
variable holds after it, which pass a loop is on, and the output and drawing building up. Step-
through alone doesn't teach, so pair it with a prediction or one question (the name-tag panel's
predict mode, or `slowMo.question`). It is off unless `enabled: true`. Works the same on
[Turtle](turtle.md#slow-mo) tasks, and draws the [Stage](#stage-drawing-beside-the-console) step
by step.

```yaml
  - id: 31
    moduleType: python
    title: Watch the loop
    slowMo:
      enabled: true
      speed: 1.0                # optional — starting lines a second (default 1; slider 0.25–4)
      showVariables: true       # optional — name tags step by step (default false)
      question: After pass 3, what is total?   # optional — shown while paused
    codeStages:
      - role: starter
        code: |
          total = 0
          for n in [4, 7, 2, 5]:
              total = total + n
          print(total)
```

**Controls** (above the editor; 44 px+ buttons, an icon and a word each):

| Button | What it does |
|---|---|
| 🐢 **Slow-mo** | Runs the program, then plays it back at the slider's speed. Pressed while paused, it carries on; once finished, it plays again from the start |
| ⏸ **Pause** | Stops on the current line |
| 👣 **Step** | One line forward (the first press runs the program and shows line 1) |
| ↩ **Step back** | One line back, with the variables, output and drawing as they were |
| ⏮ **Restart** | Back to before the first line |

**Run** still runs the program normally.

**While stepping:**

- The line that just ran has an amber band and a ▶. Its effects are already shown.
- A **loop pass counter** sits at the end of each loop's header line: "pass 3 of 4" when the code
  says how many (`range(4)` with plain numbers, or a written-out list, tuple, set, dict or text),
  "pass 3" otherwise (`range(n)`, `while`), and "finished: 4 passes" on the step where the loop
  ends.
- **Name tags** (when `showVariables: true`, or when the task has a [name-tag
  panel](#name-tag-panel-showvariables)) show the variables after each line. A tag that changed
  pulses once and shows up to three earlier values struck through, newest first. Inside a
  function the tags add its local variables. A predict-mode panel shows plain tags while stepping;
  its ✓ / ✗ come from the finished run. A target-mode panel keeps its targets.
- The **output** grows line by line, `input()` prompts and answers included. The **Stage** and
  the **Turtle** drawing build up step by step.
- The task's `question` shows while paused (after the first step).

**How it works (record, then replay).** A browser can't pause Python mid-run here, so Slow-mo
runs the whole program first, recording every line, and then plays the recording. `input()` is
asked while it records, before playback starts; the answers appear at the right step. Editing the
code ends slow-mo (the recording no longer matches), and so does pressing Run.

**Checks.** There are no slow-mo checks. The recorded run *is* the run: output, checks, the
attempt log and the tutor's card update exactly as for Run, once. The check result appears when
playback reaches the last line.

**Runaway programs.** A recording stops at 2,000 lines run. The program is ended there, the
student sees "Slow-mo stops after 2,000 steps. Is there a loop that never ends?", and the run is
treated like one the student stopped (no check result, no attempt; `run_attempted` still passes).
Keep slow-mo programs short.

**Tutors.** In **Go Live** and presentation, the presenter's recording goes to every screen
once and their Slow-mo, Pause, Step and Restart drive the line, tags, output and drawing the class
sees. Viewers see "🐢 Slow-mo · Step 4 of 12 · line 3", the question when paused, and no
controls. A very large recording is slimmed to fit (shorter values first, then no variables,
then no drawing). The session report records slow-mo use per student per task (`slowMoUsed`,
`slowMoRuns`, `slowMoSteps`; see [Session reports](session-reports.md)).

**Accessibility.** Under reduced motion nothing pulses; the line band is always still. The pulse
also stops above 2 lines a second, so nothing flashes 3 or more times a second. A live region
reads each step ("Step 5 of 11: line 3 ran. total is now 11 (was 4). Loop on line 2: pass 2 of
4.") while paused or playing at 1 line a second or slower.

**Builder:** the task editor's **Slow-mo** field (on/off, starting speed, name tags, question).
Validation flags a `slowMo` that isn't an object and an `enabled`, `showVariables` or `question`
of the wrong type or a speed that isn't a positive number; it warns about a speed outside
0.25–4, a question over 200 characters, unknown keys, and a `slowMo` with no `enabled`.

---

## Stage (drawing beside the console)

A Python task can also draw. Code that imports the `stage` module gets a **Stage** pane: a fixed
400 × 400 drawing that appears once the code draws (or from the start when the task has a
`stageTarget`). `print()` still goes to the console. On desktop the Stage sits beside the console
when the output side is wide enough, and above it otherwise; on narrow screens it stacks above the
console. Drawing is instant, like Turtle.

```yaml
  - id: 20
    moduleType: python
    title: A list is a picture
    codeStages:
      - role: starter
        code: |
          from stage import *

          heart = [
              [0, 1, 0, 1, 0],
              [1, 1, 1, 1, 1],
              [0, 1, 1, 1, 0],
              [0, 0, 1, 0, 0],
          ]
          grid(heart, palette=["white", "red"])
          print("Rows:", len(heart))
    stageTarget:              # optional: the picture to aim for
      code: |
        from stage import *
        grid([[0,1,0,1,0],[1,1,1,1,1],[0,1,1,1,0],[0,0,1,0,0]], palette=["white","red"])
      ghost: true             # optional: the faint target starts shown (default true)
    check:
      - type: stage_matches_target
        tolerance: 0.02       # fraction of the stage allowed to differ
        hint: Compare your picture with the faint target. Which red squares are missing?
      - type: output
        operator: contains
        value: "Rows: 4"
```

**The library.** `from stage import *` (or `import stage` and `stage.rect(...)`). Every call draws
straight away; later calls draw on top.

| Call | Draws |
|---|---|
| `background(colour)` | fills the whole stage |
| `rect(x, y, w, h, colour)` | a rectangle; `(x, y)` is its top-left corner |
| `circle(x, y, r, colour)` | a circle centred on `(x, y)` with radius `r` |
| `line(x1, y1, x2, y2, colour, width=2)` | a line |
| `text(x, y, words, colour, size=16)` | text; `(x, y)` is its top-left corner. `words` may be any value (a number is drawn as text) |
| `stamp(emoji, x, y, size=32)` | one emoji centred on `(x, y)` |
| `grid(rows, palette=None, cell=None, x=0, y=0)` | a 2D list as a pixel grid (see below) |
| `clear()` | wipes the stage back to white |

`WIDTH` and `HEIGHT` are both `400`.

**Coordinates.** Top-left origin: `x` goes right, `y` goes **down**, on a fixed 400 × 400 stage that
scales to fit the screen. (This is the screen convention of Arcade Kit and most graphics
libraries; Turtle's centred, y-up world is different on purpose.)

**Colours.** A colour is text: a CSS colour name (`"red"`, `"cornflowerblue"`), a PICO-8 name from
Arcade Kit (`"dark_blue"`, `"peach"`, also written with a space), or a hex code (`"#f00"`,
`"#ff0000"`). Where a name is both, the CSS colour wins (`"white"` is `#ffffff`, `"red"` is
`#ff0000`); the PICO-8-only names are `dark_blue`, `dark_purple`, `dark_green`, `dark_gray`,
`light_gray` and `peach` (`grey` spellings work too).

**Grids.** `rows` is a list of rows; each value is drawn as one square cell:
- with a `palette` (a list of colours), a whole number picks that palette colour (`0` is the first);
- without one, whole numbers are the 16 PICO-8 colours (`0` black, `7` white, `8` red …), as in
  Arcade Kit;
- a colour name or hex code is drawn as that colour;
- `None`, `"none"` or `"transparent"` draws nothing there.

`cell` is the cell size (default: the biggest that fits the stage), `x`/`y` the top-left corner.
Rows may be different lengths. A grid is at most 100 × 100.

**Mistakes students make** stop the run with a plain-English error on the student's own line,
naming the argument: `rect(): y should be a number, like 50, not the text '20'`,
`circle(): 'redd' isn't a colour I know. Try a name like 'red' or a hex code like '#ff0000'`,
`grid(): rows[0][1] is 2, but the palette only has 2 colours (numbers 0 to 1)`. A run that draws
more than 20,000 commands (or more than 200,000 grid cells) stops with "The stage stopped after
20,000 drawing commands — is a loop drawing forever?".

### Target picture (`stageTarget`)

`stageTarget: { code, ghost }` is Python that draws the picture to aim for. It runs once, silently
(no output; `input()` answers nothing), when the task opens or on the first Run. With a target:
- the Stage shows from the start, with a faint **ghost** of the target to draw over. The
  **Target** toggle shows or hides it (`ghost: false` starts it hidden);
- after a Run, the **Differences** toggle highlights where the drawing differs and says it in
  words: "About 12% of the stage is different from the target. For example, near x 42, y 18 the
  target is red but yours is white.";
- `stage_matches_target` can check it.

Both toggles are at least 44 px.

### Stage checks

All stage checks read the run's drawing, so they need a Run (`lessons test-checks` reports them as
needing a run). They look at what is on the stage after the last `clear()`.

| Type | Fields | Passes when |
|---|---|---|
| `stage_matches_target` | `tolerance` (0–1, default `0.01`) | the shapes differ from the `stageTarget` drawing in at most that fraction of the stage, and every target text and emoji is drawn (same words or emoji within 12 px) with no extra ones. Needs `stageTarget` |
| `stage_shape_count` | `kind` (`rect`, `circle`, `line`, `text`, `stamp`, `grid`, or `any` = default), `min`, `max` | the number of those calls is between `min` and `max` (neither given: at least 1) |
| `stage_colour_used` | `colour` | something on the stage is that colour: a shape, text, the background or a grid cell |
| `stage_pixel` | `x` and `y` (0–399), **or** `row` and `col`, plus `colour` | that point, or the centre of that cell of the last grid, is that colour |
| `stage_text_shown` | `text`, `operator` (`contains` = default, `equals`, `matches_regex`) | some drawn text matches (like output checks: `contains` ignores capitals) |

Colours match when each red, green and blue part is within 8 of the expected colour. Shapes are
compared on a 100 × 100 grid (each cell 4 × 4 stage pixels), so a 1 px difference doesn't fail a
target; text and emoji are compared by what they say and where, not by pixels, because fonts differ
between devices. Use `code` checks for the method (for example `code` contains `grid(`).

**Hints name colours in words.** Write hints that never rely on colour alone: "Colour the top
middle square red", not "make it this colour". The Builder's check row and the CLI describe a
stage check in words too ("Something dark blue is on the stage").

**Tutor view and Go Live.** After each Run the drawing goes to the student card (a small
thumbnail beside the output lines) and to StudentModal (between the code and the console). In
**Go Live** the presenter's drawing shows on every screen. The Stage has a screen-reader
description listing the shapes, text and grid size with colours in words.

**Persistence.** None beyond the code: the drawing is redrawn by the next Run.

---

## Output and Code Checks (shared with HTML)

Prefer the canonical `type` + `operator` form:

| Type | Operators | Run | Submit | Fields |
|---|---|:---:|:---:|---|
| `output` | `contains`, `not_contains`, `equals`, `not_equals`, `matches_regex`, `not_matches_regex` | Y | N | `value`, optional `flags` for regex |
| `output_line_count` | `equals`, `not_equals`, `greater_than`, `greater_than_or_equal`, `less_than`, `less_than_or_equal` | Y | N | `value` |
| `code` | `contains`, `not_contains`, `equals`, `not_equals`, `matches_regex`, `not_matches_regex` | Y | Y | `value`, optional `flags` for regex |
| `code_no_error` | none | Y | N | Python run status is `success` |
| `run_attempted` | none | Y | N | The student pressed Run (see [Run Attempted](#run-attempted-check-run_attempted)); optional `requireSuccess` |
| `output_not_empty` / `output_empty` | none | Y | N | Legacy convenience checks |

`operator` is required on `output`, `code` (and the other text checks): validation rejects a check that leaves it out. Lessons published before that rule compare with `contains`.

Legacy aliases such as `output_contains`, `output_equals`, `output_matches_regex`, `code_contains`, `code_does_not_contain`, and `code_matches_regex` still load, but new lessons should use the canonical form above.

**Submit mode** only accepts `type: code` and `type: code_structure` checks. Output, variable and `run_attempted` checks require a run.

**Regex:** `matches_regex` and `not_matches_regex` use JavaScript `RegExp(pattern, flags)`. Put the regex pattern in `value`; put flags such as `i`, `m`, or `s` in `flags`. Regex is case-sensitive unless `flags: i` is set. Anchors (`^`, `$`), groups, alternation, lookarounds, and backreferences follow the browser JavaScript regex engine.

**Normalisation:** output checks normalise `\r\n` to `\n` and compare case-insensitively except regex. Exact output checks trim trailing newline characters only, not other leading/trailing spaces. Code checks normalise whitespace outside quoted strings before contains/equality checks; regex checks see that same normalised source. Because indentation is removed too, use [`code_structure`](#code-structure-checks-code_structure) to check nesting.

**Wildcards and option lists:** for non-regex contains/equality checks, `*` matches any sequence including newlines. A value written as `"opt1","opt2"` passes `contains` if any option is present, and passes `not_contains` only if none of them are. An invalid regex fails both `matches_regex` and `not_matches_regex`, so a typo in a pattern never lets every student pass.

## Run Attempted Check (`run_attempted`)

For **demo tasks** (Complete Example, Visual Fun Application, "press Run and watch"): the student
has nothing to edit, so every `code` / `output` check already passes on the unedited starter and
certifies nothing. `run_attempted` passes once the student has pressed **Run** on the task.

| Field | Required | Meaning |
|---|---|---|
| `requireSuccess` | N | `true`: the run must also finish without an error. Default `false`: any run counts |

- **Default:** pressing Run is enough — even if the program raises an error, and even if the
  student presses **Stop** (a program that loops forever can only end that way). The task completes
  on that run and stays complete, like any passed task.
- **`requireSuccess: true`:** the run must finish with status `success`; an error or a stopped run
  does not count. Honoured in Python, Turtle and Electronics. Arcade, HTML and Scratch runs never
  report an error status, so it is ignored there (the validator warns).
- **Composes** with other completion checks in a check array (all must pass). Mixed with any other
  check, an erroring run fails the task as it always has — the "any run counts" rule only applies
  when `run_attempted` is the whole completion check.
- **Completion checks only.** It is rejected as a feedback check (it would match on every run) and
  in `interactionMode: submit` (it needs a run).
- **Never passes without a run:** submit-mode grading, idle feedback, the auto-check when the
  teacher moves the class on (reported as **not run**) and `lessons test-checks` (reported as
  `fail`, since the CLI never runs code) all leave it unpassed.
- A run the teacher starts from the student's card (remote Run) counts like the student's own.
- A task with `tests` is completed by its tests, so a `run_attempted` check there is never used
  (the validator warns).
- Modules: Python, Turtle, Arcade (**Run game**), Electronics, HTML (**Run**) and Scratch (green
  flag only — see `docs/authoring/scratch.md`). Filesystem and Desktop have no Run button and
  reject it.

Worked example — a required-path demo task:

```yaml
- title: 🎮 Watch It Move
  taskActivity: Code Task, Complete Example
  explainer: |
    Press **Run** and watch the turtle draw a square. Nothing to change this time!
  starterCode: |
    import turtle
    for side in range(4):
        turtle.forward(100)
        turtle.left(90)
  check:
    type: run_attempted
    hint: Press **Run** to see the program work.
```

Requiring a clean run, together with another check:

```yaml
check:
  - type: run_attempted
    requireSuccess: true
  - type: code
    operator: contains
    value: "for side in range(4):"
```

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

Catching a misconception: `print(total)` inside the loop prints every time round it. A feedback
check **matches when its check passes**, so it describes the *mistake*: use `nested_in` (passes
when the print is inside the loop), not `not_nested_in` (which would fire on the correct code).

```yaml
feedbackChecks:
  - type: code_structure
    operator: nested_in
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

Python tasks support `feedbackChecks`. They use the same check shapes as completion checks and require a completion `check`. **A feedback check matches when its check passes**, so write it to detect the mistake, not the correct code: for "the print is still inside the loop" use `code_structure` `nested_in`, not `not_nested_in`. `test-checks` reports which feedback checks matched (`matchedFeedback`). `show: after_attempt` runs after Run/Submit; `show: on_idle` runs after the learner pauses editing and is most useful with code checks. `incorrectChecks` is a legacy alias for blocking feedback.

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
