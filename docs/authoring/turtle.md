# Python Turtle Module Code-Task Authoring

The Turtle module is a single-file Python workspace for teaching movement,
angles, and loops by drawing on a canvas. It provides a hand-built shim of the
real Python `turtle` module — `import turtle` / `from turtle import *` work as
written — running inside the same shared Pyodide Web Worker as the Python
module (see `src/modules/python/pyodide.worker.js`), not a separate runtime.

**Status:** Shipped. Not supported: multiple `Turtle()` instances, per-task
canvas size, and reference/expected-image comparison. There is no standalone
`/playground/turtle` route, and Turtle work can't be shared through shared
workspaces yet.

## Lesson and task shape

Use `type: composed` at lesson level and `moduleType: turtle` on each Turtle
task. Turtle tasks use the same source-stage fields as a Python code task:
`starterCode`, `completeCode`, `codeStages`, `carryCodeFrom`, and `copyCode`, plus
`showBlocks` (block brackets in the editor, see [python.md](python.md)).

```yaml
id: draw-a-square
type: composed
title: Draw a Square
description: Use a loop to draw a square with the turtle.
tasks:
  - title: Draw a square
    moduleType: turtle
    starterCode: |
      import turtle

      for _ in range(4):
          turtle.forward(100)
          turtle.left(90)
    check:
      - type: turtle_path_closed
        tolerance: 2
      - type: turtle_command_used
        command: turn
        minCount: 4
```

Turtle tasks are draw-and-check, like Arcade Kit — there is no `submit`
interaction mode and no `tests` support.

## Line hints

Turtle starter code takes the same `#>` line hints as Python: a line whose
trimmed text starts with `#>` is removed from the code and shown beside the
next line (a 💡 in the gutter and faded text after the line), so instructions
never sit in the student's code.

```yaml
    starterCode: |
      import turtle

      #> Try a different colour name here
      turtle.color("blue")
      for _ in range(4):
          #> Change 100 to make the square bigger
          turtle.forward(100)
          turtle.left(90)
```

The rules (stacking, trailing markers, stripping before run/check/carry,
re-anchoring on saved code) are the same as Python's — see
[python.md](python.md#line-hints).

## Side-quests

A Turtle task can carry up to three optional, unchecked `sideQuests` (`title`, `kind`,
`explainer`, `starter`) that a student opens in their own scratch Turtle workspace (editor and canvas) once they pass
the task. They never change the task's code or what `carryCodeFrom` copies. See
[Side-quests](AUTHORING_GUIDE.md#side-quests).

## Name-tag panel (`showVariables`)

A Turtle task can show students what is in their variables, exactly as a Python task does:
`showVariables: { mode: view | predict | target, at: end | marker, hide, predict, target, visuals }`,
the `#@peek` marker and the `variables_predicted` check. Lists and dicts get the same visuals as in
Python (colour swatches, bars, pictures, cards; `visuals: false` turns them off). The panel sits between the drawing and the
output. Names imported from `turtle` (`from turtle import forward`) and the turtle module itself
are never shown, so the panel holds only the student's own variables (a `Turtle()` object they
make shows as its type). See [python.md](python.md#name-tag-panel-showvariables) for the fields,
display rules and the forgiving comparison.

```yaml
  showVariables:
    mode: predict
    predict: [size, sides]
  codeStages:
    - role: starter
      code: |
        import turtle
        size = 50
        sides = 4
        #@peek
        for i in range(sides):
            turtle.forward(size)
            turtle.left(90)
  check:
    - type: variables_predicted
```

## Live scrubbing (`scrub`)

`scrub` lets students drag a number (or tap it for a slider) and pick a colour from a picker,
and the turtle redraws as the value changes. It's off unless set. Same field as Python:
see [Python → Live scrubbing](python.md#live-scrubbing-scrub) for the options, devices and
keyboard use.

```yaml
  - id: 40
    moduleType: turtle
    title: Change the size, watch the square
    scrub:
      enabled: true
      ranges:
        - line: 3
          min: 10
          max: 200
    codeStages:
      - role: starter
        code: |
          import turtle
          for _ in range(4):
              turtle.forward(100)
              turtle.left(90)
```

- Every Turtle program re-runs live while a value moves (a preview: no attempt, checks, save or
  tutor update), unless it calls `input()`: then the student sees "Press Run to see it".
- Colour strings use CSS names (`'red'`, `'cornflowerblue'`) or hex (`'#ff0000'`).
- When the drag ends the value is a normal edit, saved and sent to a watching tutor. The session
  report counts each student's scrubs (`scrubs`).

## Slow-mo

A Turtle task can use Python's [slow-mo](python.md#slow-mo-slowmo) (`slowMo: { enabled: true,
speed?, showVariables?, question? }`): Slow-mo, Pause, Step, Step back and Restart above the code.
The drawing builds up line by line and the 🐢 marker moves with it, so students see which line
drew which side. The current line, loop pass counter ("pass 2 of 4" for `range(4)`), name tags
and output work as in Python. The shim's own lines are never steps. The recorded run is the run
for the checks, and Go Live carries the presenter's playback.

```yaml
  slowMo:
    enabled: true
    speed: 2
    question: Which way is the turtle facing after pass 2?
```

## Coordinate system

Matches real Python `turtle` exactly: `(0, 0)` is the centre of a fixed
logical 400×400-unit world, y increases **upward**, and heading is in degrees
counter-clockwise from east (`0` = facing right, `90` = facing up). The
logical world size is fixed, not configurable per task.

The canvas element itself is fully responsive — its on-screen pixel size can
be anything — but the logical coordinate space is always mapped to fit it
("contain", centred), so `turtle.forward(100)` always covers the same
fraction of the drawing area regardless of device or screen size.

A 🐢 marker shows where the turtle is and which way it is facing. Before any
run it sits at `(0, 0)` facing east; after a run it sits at the final position
and heading. Its head points along the heading, and it stays the right way up
when the turtle faces left. `hideturtle()` hides it, as in real Python turtle.

## Speed and animation

On **Run** the script runs to completion first (so checks are worked out from
the finished run, as before), then the canvas **plays the drawing**: the 🐢
moves, turns visibly and draws each line as it goes, at the pace set by
`speed()`.

| The code | How it plays |
|---|---|
| No `speed()` call | At `speed(10)` ("fast") pace, with the whole drawing squeezed to finish within about **4 seconds**. Short drawings are not stretched. |
| `speed(1)`–`speed(10)`, or `"slowest"` (1), `"slow"` (3), `"normal"` (6), `"fast"` (10) | Real Python turtle pace for that speed, however long it takes. Moves before the first `speed()` call play at speed 10. `speed()` can change part way through. |
| `speed(0)` or `"fastest"` | Instant: the finished drawing appears at once. |

- Real turtle's pace: a move of `d` units takes `1 + floor(d / (3 × 1.1^s × s))`
  steps of 10 ms; a turn of `a` degrees takes `1 + floor(a / (3 × s))` steps.
  `circle()` turns between its small sides instantly, as in real turtle, and
  turns or pen-up moves while the turtle is hidden take no time.
- As in real turtle, numbers outside 0.5–10.5 mean instant, other numbers are
  rounded, and an unknown name raises an error. `speed()` with no argument
  returns the current speed (10 when the code never set one).
- A **Skip** button (bottom right of the picture) jumps to the finished
  drawing. The Output panel's check result appears once the drawing finishes
  or is skipped.
- **Reduced motion** (the device's "reduce motion" setting): the finished
  drawing appears at once, with a **Play** button to watch it drawn.
- [Slow-mo](#slow-mo) takes over when it's on: its slider and step buttons
  control the drawing, and `speed()` is ignored.
- [Live scrubbing](#live-scrubbing-scrub) always redraws instantly, whatever
  `speed()` says.
- **Go Live:** when the presenter runs, every student's screen plays the
  presenter's drawing. A tutor watching one student (the student card or
  StudentModal) sees the student's finished drawing, never an animation.
- The picture has a screen-reader description (what was drawn, in which
  colours, and where the turtle ended up).

### Drawing order

The canvas draws in the order the code ran, as real turtle does: later lines,
fills, dots, stamps and text cover earlier ones, and the 🐢 marker is always
on top. One exception, also as in real turtle: a filled shape's own outline
stays on top of its own fill, because the fill takes its place in the drawing
where `begin_fill()` ran (it appears when `end_fill()` closes the shape).

```python
turtle.fillcolor("gold")
turtle.begin_fill()
for _ in range(5):          # a gold star with a black outline on top
    turtle.forward(150)
    turtle.right(144)
turtle.end_fill()
turtle.penup()
turtle.goto(60, -20)
turtle.dot(40, "white")     # drawn later, so it covers the star
```

## Supported commands: movement and pen

Single default turtle only — `import turtle; turtle.forward(10)` or
`from turtle import forward, left, ...`. `turtle.Turtle()` is not available.

| Command | Aliases | Notes |
|---|---|---|
| `forward(distance)` | `fd` | |
| `backward(distance)` | `bk`, `back` | Recorded as its own `backward` command **and** as a `forward` call with a negative distance, so it counts towards both in `turtle_command_used`. |
| `left(angle)` | `lt` | |
| `right(angle)` | `rt` | |
| `penup()` | `pu`, `up` | |
| `pendown()` | `pd`, `down` | |
| `isdown()` | | |
| `pencolor(color=None)` | | Reads the current colour when called with no argument. |
| `goto(x, y)` / `goto((x, y))` | `setpos`, `setposition` | |
| `setx(x)` / `sety(y)` | | Recorded as `goto`. |
| `setheading(angle)` | `seth` | |
| `home()` | | |
| `reset()` | `clear` | Clears the drawing and returns to the origin. |
| `position()` | `pos` | Returns `(x, y)`. |
| `xcor()` / `ycor()` | | |
| `heading()` | | |
| `hideturtle()` | `ht` | Hides the 🐢 marker. Drawing is unaffected. |
| `showturtle()` | `st` | Shows the 🐢 marker again. `reset()` also shows it. |
| `isvisible()` | | Returns whether the marker is shown. |
| `pensize(width=None)` | `width` | Sets the line width for later lines, as in real turtle (`pensize(0)` draws no lines). With no argument, returns the current size (default `1`). Widths under 1.5 draw 1.5 units wide so thin lines stay visible. Both names record as `pensize` for `turtle_command_used`. |
| `speed(speed=None)` | | Sets how fast the drawing plays (see [Speed and animation](#speed-and-animation)). With no argument, returns the current speed. |

`turtle.done()`, `turtle.mainloop()`, `turtle.bye()`, and `turtle.Screen()`
(with no-op `exitonclick`/`title`/`setup`) are also accepted as harmless
no-ops, since they're near-universal turtle boilerplate that would otherwise
raise an error for no visual reason in this headless model.

`left()`/`right()` both record as the same internal `turn` event (signed
degrees) — a `turtle_command_used` check targeting `turn` can't currently
tell which direction was used. `circle()` is drawn from many small
`forward`/`turn` steps, so it also raises those counts — prefer
`command: circle` when a task is about circles.

## Supported commands: shapes, fill, stamps and text

| Command | Notes |
|---|---|
| `circle(radius, extent=360, steps=None)` | Positive `radius` curves left (counter-clockwise), negative curves right — matches real turtle. Built from `forward()`/`left()` steps under the hood, so it draws (and respects fill) exactly like hand-rolled movement; recorded separately in the command log so `turtle_command_used` can still target `circle` specifically. |
| `begin_fill()` / `end_fill()` | Marks the path drawn between them as a filled polygon (rendered with `fillcolor`) once closed. Needs at least 3 distinct points to produce a visible fill. |
| `fillcolor(color=None)` / `fillcolor(r, g, b)` | Reads or sets the fill colour, independently of `pencolor`. |
| `color(color=None)` / `color(pen, fill)` | Convenience for setting `pencolor` and `fillcolor` together (or reading both back as a tuple). |
| `dot(size=None, colour=None)` | A filled circle centred on the turtle, which doesn't move. `size` is the diameter (default: the larger of `pensize + 4` and `2 × pensize`); the colour defaults to the pen colour. `dot("red")` and `dot(20, 255, 0, 0)` work as in real turtle. |
| `stamp()` | Leaves a small triangular marker at the current position/heading in the current pen colour, without moving the turtle. Always returns `0` (stamp ids / `clearstamp()` are not supported). |
| `write(text, move=False, align="left", font=("Arial", 8, "normal"))` | Draws text at the current position in the current pen colour. Only the font *size* is respected (family/style are ignored); `move` is a no-op. |
| `bgcolor(color=None)` / `Screen().bgcolor(...)` | Sets the canvas background for the whole run — there's no per-command background history, just whatever it is by the time the script finishes. |
| `colormode(mode=None)` | `255` (default) or `1.0` — controls how an `(r, g, b)` tuple passed to `pencolor`/`fillcolor`/`color` is interpreted. Handled entirely inside the Python shim; plain colour strings/hex codes are unaffected. |

Real turtle colour arguments all work: a name (`"red"`), a hex string
(`"#ff8800"`), or an `(r, g, b)` tuple/3 positional numbers under the current
`colormode`.

## Checks

A Turtle task can mix two kinds of check in the same `check` (or
`feedbackChecks`) list. Every check in the list must pass.

- **Turtle checks** (below) evaluate the finished run's recorded state, so a
  run is always required.
- **Code checks** use the generic `code` type shared with Python, HTML and
  Arcade (`operator`: `contains`, `not_contains`, `equals`, `not_equals`,
  `matches_regex`, `not_matches_regex`, plus `value`). They look at what the
  student wrote, e.g. "uses a loop", and are evaluated on the same Run. See
  [python.md](python.md#output-and-code-checks-shared-with-html) for
  normalisation rules. `contains` trims surrounding spaces from `value`, so
  `"for "` also matches `forward`. Use a regex such as `for\s+\w+\s+in` to
  detect a loop.

```yaml
check:
  - type: turtle_path_closed
  - type: code
    operator: matches_regex
    value: 'for\s+\w+\s+in\s+range\('
    hint: Use a for loop to repeat the sides.
```

**Demo tasks** ("press Run and watch") use `run_attempted`: it passes once the student presses
**Run**, even if the program errors or they press Stop. Add `requireSuccess: true` to also require
a run that finishes without an error. It is a completion check only (not a feedback check). Full
reference and a worked example:
[python.md](python.md#run-attempted-check-run_attempted).

```yaml
check:
  type: run_attempted
  hint: Press **Run** and watch the turtle draw.
```

### Turtle check types

| Type | Fields | Passes when |
|---|---|---|
| `turtle_position` | `x`, `y`, `tolerance` (default 2) | Final position is within `tolerance` units of `(x, y)`. |
| `turtle_heading` | `value`, `tolerance` (default 2) | Final heading is within `tolerance` degrees of `value` (wraps at 0/360). |
| `turtle_path_closed` | `tolerance` (default 2) | The drawn path's start and end points coincide within `tolerance`. |
| `turtle_segment_count` | `operator`, `value` | The number of drawn line segments compares to `value` (`operator` defaults to "at least"). |
| `turtle_path_length` | `operator`, `value` | The total length of all drawn segments compares to `value`. |
| `turtle_command_used` | `command` (one of: `forward`, `backward`, `turn`, `goto`, `setheading`, `home`, `reset`, `penup`, `pendown`, `pencolor`, `fillcolor`, `bgcolor`, `beginfill`, `endfill`, `circle`, `stamp`, `write`, `hideturtle`, `showturtle`, `pensize`, `dot`), `minCount` (default 1) | That command was called at least `minCount` times. `color()` isn't a canonical name — it records as `pencolor`/`fillcolor`, whichever it actually changed. |
| `turtle_color_used` | `kind` (`"pen"` default, or `"fill"`), `color` | The final pen/fill colour (per `kind`), or any matching `pencolor(...)`/`fillcolor(...)` call, matches `color` as text, ignoring case and surrounding spaces. Colour formats are **not** converted: `"red"`, `"#ff0000"` and `(255, 0, 0)` (stored as `"rgb(255,0,0)"`) don't match each other, so use the same form the task asks students to write. |
| `turtle_stamp_count` | `operator`, `value` | The number of `stamp()` calls compares to `value` (`operator` defaults to "at least"). |

Feedback/incorrect checks use the same types.

### Validation

The Builder and `node cli/cli.mjs lessons validate` apply the same rules to
Turtle checks and feedback checks:

- The `type` must be one of the eight turtle types above, a generic `code`
  check (including legacy aliases like `code_contains`), `run_attempted`
  (completion checks only), or `variables_predicted` (with
  `showVariables.mode: predict`; see [Name-tag panel](#name-tag-panel-showvariables)).
- A `code` check needs a `value`.
- `turtle_position` needs both `x` and `y`.
- `turtle_heading`, `turtle_segment_count`, `turtle_path_length` and
  `turtle_stamp_count` need a `value`.
- `turtle_command_used` needs a `command` from the list above.
- `turtle_color_used` needs a `color`.

`test-checks` reports turtle checks as `skipped`, because they need a real run —
use the Builder preview to confirm a complete solution passes. Code checks
don't need a run.

## Runtime notes and limits

- No file I/O, no `pip install` — same as the Python module.
- The student's own canvas updates only after pressing **Run** (then plays the
  drawing; see [Speed and animation](#speed-and-animation)); there is no
  live redraw while typing. The exception is [live scrubbing](#live-scrubbing-scrub): dragging
  a number or picking a colour redraws as the value changes. [Slow-mo](#slow-mo) replays a run's
  drawing step by step.
- The turtle drawing itself is **not persisted** between sessions or page
  reloads — re-running the code regenerates the same drawing from the same
  script.
- `print()` output still works and appears in a collapsible Output panel
  under the canvas. It opens automatically on Run, and collapses to a slim
  bar.

## Teacher live view

The student's canvas syncs to the teacher after every run — not stroke by
stroke, just the finished drawing from the run that just completed:

- **Watching a student in the student grid / StudentModal:** the run result
  writes to `sessions/{lessonId}/students/{anonymousId}/currentTurtleResult`
  (`writeStudentTurtleResult` in `useSession.js`, called alongside
  `writeStudentRun`), and the module's `TeacherLiveView` renders it on its own
  canvas via the same `drawTurtleCommands` function the student's own
  workspace uses, next to a read-only view of their code.
- **"Go Live" broadcasting a turtle task to the whole class:** the run result
  also flows through the same channel that already carries live code/output
  (`currentTeacherLivePayload` in `useTeacherLivePublish.js`, mirroring how
  Arcade's `arcadeDesign` is synced) — other students watching the broadcast
  see it via `displayTurtleResult` in `StudentWorkspace.jsx`. Each Run's
  result carries a `runId`, so their screens play the presenter's new drawing
  (see [Speed and animation](#speed-and-animation)); the tutor views above
  always show the finished drawing.
- Both paths go through `compactTurtleResultForSync`
  (`src/modules/turtle/sync.js`): coordinates are rounded to 1 decimal place
  and the command log is capped to the most recent 4000 commands before
  syncing, since a drawing (especially one using `circle()`) has no natural
  upper bound and neither sync channel has a payload-size guard for any
  module. The raw command-call log used by checks is never synced — only the
  drawn path and final state are, since only the student's own run needs the
  call log.
- In the Builder's authoring/preview view (no specific student), the canvas
  is simply blank — there's no run result to show there.
