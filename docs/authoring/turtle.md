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
`starterCode`, `completeCode`, `codeStages`, `carryCodeFrom`, and `copyCode`.

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

## Coordinate system

Matches real Python `turtle` exactly: `(0, 0)` is the centre of a fixed
logical 400×400-unit world, y increases **upward**, and heading is in degrees
counter-clockwise from east (`0` = facing right, `90` = facing up). The
logical world size is fixed, not configurable per task.

The canvas element itself is fully responsive — its on-screen pixel size can
be anything — but the logical coordinate space is always mapped to fit it
("contain", centred), so `turtle.forward(100)` always covers the same
fraction of the drawing area regardless of device or screen size.

Drawing is instant, not animated: the whole script runs to completion, then
the canvas draws the finished result in one pass. There is no step-by-step
turtle animation.

A 🐢 marker shows where the turtle is and which way it is facing. Before any
run it sits at `(0, 0)` facing east; after a run it sits at the final position
and heading. Its head points along the heading, and it stays the right way up
when the turtle faces left. `hideturtle()` hides it, as in real Python turtle.

### Rendering order

The canvas renders in fixed layers — **fills, then lines, then stamps, then
text, then the 🐢 marker** — rather than strict chronological command order. A filled shape's own
pen outline always stays visible on top of its fill, which matters because
`end_fill()` only produces its polygon once the shape is closed, after the
outline's own line segments were already logged. This is a deliberate
simplification for the instant/final-draw model, not a limitation students
are likely to notice in normal use.

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
| `speed(...)` | | Accepted but has no effect — drawing is always instant. |

`turtle.done()`, `turtle.mainloop()`, `turtle.bye()`, and `turtle.Screen()`
(with no-op `exitonclick`/`title`/`setup`) are also accepted as harmless
no-ops, since they're near-universal turtle boilerplate that would otherwise
raise an error for no visual reason in this headless, instant-draw model.

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

### Turtle check types

| Type | Fields | Passes when |
|---|---|---|
| `turtle_position` | `x`, `y`, `tolerance` (default 2) | Final position is within `tolerance` units of `(x, y)`. |
| `turtle_heading` | `value`, `tolerance` (default 2) | Final heading is within `tolerance` degrees of `value` (wraps at 0/360). |
| `turtle_path_closed` | `tolerance` (default 2) | The drawn path's start and end points coincide within `tolerance`. |
| `turtle_segment_count` | `operator`, `value` | The number of drawn line segments compares to `value` (`operator` defaults to "at least"). |
| `turtle_path_length` | `operator`, `value` | The total length of all drawn segments compares to `value`. |
| `turtle_command_used` | `command` (one of: `forward`, `backward`, `turn`, `goto`, `setheading`, `home`, `reset`, `penup`, `pendown`, `pencolor`, `fillcolor`, `bgcolor`, `beginfill`, `endfill`, `circle`, `stamp`, `write`, `hideturtle`, `showturtle`), `minCount` (default 1) | That command was called at least `minCount` times. `color()` isn't a canonical name — it records as `pencolor`/`fillcolor`, whichever it actually changed. |
| `turtle_color_used` | `kind` (`"pen"` default, or `"fill"`), `color` | The final pen/fill colour (per `kind`), or any matching `pencolor(...)`/`fillcolor(...)` call, matches `color` as text, ignoring case and surrounding spaces. Colour formats are **not** converted: `"red"`, `"#ff0000"` and `(255, 0, 0)` (stored as `"rgb(255,0,0)"`) don't match each other, so use the same form the task asks students to write. |
| `turtle_stamp_count` | `operator`, `value` | The number of `stamp()` calls compares to `value` (`operator` defaults to "at least"). |

Feedback/incorrect checks use the same types.

### Validation

The Builder and `node cli/cli.mjs lessons validate` apply the same rules to
Turtle checks and feedback checks:

- The `type` must be one of the eight turtle types above, or a generic `code`
  check (including legacy aliases like `code_contains`).
- A `code` check needs a `value`.
- `turtle_position` needs both `x` and `y`.
- `turtle_heading`, `turtle_segment_count`, `turtle_path_length` and
  `turtle_stamp_count` need a `value`.
- `turtle_command_used` needs a `command` from the list above.
- `turtle_color_used` needs a `color`.

`test-checks` can't evaluate turtle checks, because they need a real run —
use the Builder preview to confirm a complete solution passes. Code checks
don't need a run.

## Runtime notes and limits

- No file I/O, no `pip install` — same as the Python module.
- The student's own canvas updates only after pressing **Run**; there is no
  live redraw while typing.
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
  see it via `displayTurtleResult` in `StudentWorkspace.jsx`.
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
