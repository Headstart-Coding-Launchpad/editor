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

## Locked lines, hidden setup and puzzles

Turtle tasks take the same `#@lock` markers, `setupCode` / `setupNote` and `puzzle` rules
(`onlyEdit`, `maxLines`, `par`) with the `max_lines` check as Python: see
[Python → Locked lines, hidden setup and puzzles](python.md#locked-lines-hidden-setup-and-puzzles).

```yaml
  - id: 33
    moduleType: turtle
    title: Draw the star in 4 lines
    puzzle:
      onlyEdit: [2]       # only the loop line can change
      maxLines: 4
      par: 1
    check:
      - type: max_lines
      - type: turtle_segment_count
        operator: equals
        value: '5'
    codeStages:
      - role: starter
        code: |
          import turtle
          for _ in range(4):
              turtle.forward(100)
              turtle.right(144)
```

- `setupCode` runs after the turtle module is ready and before the student's code, so it can
  set variables (sizes, colours, lists of points) or draw something first.
- Line numbers in errors, `#@peek` and slow-mo stay the student's own.

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

## Screen layout

As in [Python](python.md#screen-layout-layout): on a wide desktop the picture, the name tags and
the output sit beside the editor. On tablets, 1366 × 768 Chromebooks and small laptops the editor
has **one result pane** beside it with tabs **Picture · Tags · Console** (Tags only with
`showVariables`), and on portrait screens and phones the editor sits above the tabs.

- The pane opens on the **Picture** (on **Tags** in predict / target mode, so the empty tags show
  while the student types).
- After Run it switches to the **Picture** if the turtle drew (or the task has a `course`),
  otherwise to Tags in predict / target mode, otherwise to the Console. A run that fails before
  drawing shows the Console.
- During slow-mo, and in predict / target mode once there is a drawing, Picture and Tags share one
  tab, one above the other.
- The Console tab counts new lines (or shows **!** for an error) while it's hidden. Switching tabs
  never interrupts a drawing that is playing.

Pick the first tab with `layout: { firstPane: picture | tags | console }` (optional).

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

- The `type` must be one of the eight turtle types above, a course check
  ([Course mode](#course-mode-course)), a generic `code`
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

## Course mode (`course`)

A Turtle task with a `course` turns the turtle into a vehicle the student drives round a map:
walls, a goal, pickups to collect, and sensors to look ahead. It isn't a game: there's no game
loop and no keys. Students write instructions, press **Run**, and watch the vehicle follow them,
one visible move at a time. The student still writes ordinary Turtle Python (`import turtle`).

```yaml
- title: Get the rover to the flag
  moduleType: turtle
  course:
    type: grid              # grid | track
    vehicle: rover          # turtle (default) | car | rover | boat | drone
    map: |
      #########
      #>..#..G#
      #.#.#.#.#
      #...*...#
      #########
  codeStages:
    - role: starter
      code: |
        import turtle
        while not turtle.at_goal():
            if turtle.wall_ahead():
                turtle.right()
            else:
                turtle.forward()
  check:
    - type: course_goal_reached
      hint: Watch where the rover stops. Which move takes it off the route?
    - type: course_no_crash
```

### Grid maps (`type: grid`)

`map` is text, one line per row:

| Character | Means |
|---|---|
| `#` | Wall |
| `.` | Road |
| `G` | Goal (at least one) |
| `*` | Pickup |
| `>` `<` `^` `v` | The start, facing east, west, north or south (exactly one) |
| space | Off the map (a wall) |

Rows may differ in length (short rows are padded with off-map squares). The most is 30 × 30.
The map is scaled to fit the picture, so a small map has big squares.

- `forward()` with no number moves one square; `forward(3)` moves three; `backward()` works too.
  Part squares (`forward(1.5)`) stop with a plain message.
- `left()` and `right()` with no number turn 90°. Any angle that isn't a whole number of quarter
  turns stops with "On a grid, the rover turns in quarter turns: use left() or left(90), not
  left(45)." `setheading()` takes 0, 90, 180 or 270.
- `goto()`, `setpos()`, `home()`, `reset()`, `clear()` and `circle()` can't be used on a grid
  (a plain message says so).

### Tracks (`type: track`)

Free movement in ordinary turtle coordinates: the centre is (0, 0), `y` goes up, and the picture
runs from -200 to 200 both ways. `forward()` needs a distance (`forward(50)`); turns take any
angle (`left()` alone is 90°). `goto()` drives in a straight line.

```yaml
course:
  type: track
  vehicle: car
  map:
    start: { x: -160, y: -160, heading: 90 }   # default (0, 0) facing east
    goal: { x: 160, y: 160, r: 25 }             # a circle; or goal: { rect: [x1, y1, x2, y2] }
    walls:
      - [-100, -200, -100, 100]                 # a line wall from (x1, y1) to (x2, y2)
      - { rect: [0, -100, 60, 200] }            # a solid box between two corners
    pickups:
      - [-160, 0]
      - [-40, 150]
    trackCode: |                                # optional: lines this Turtle code draws are walls
      turtle.penup()
      turtle.goto(100, -200)
      turtle.pendown()
      turtle.left(90)
      turtle.forward(150)
```

- The vehicle is a circle 10 units from centre to edge. It crashes when its edge touches a wall
  or the edge of the picture.
- `wall_ahead()`, `wall_left()` and `wall_right()` look **30 units** ahead, left or right.
- A pickup is collected when the vehicle's centre passes within 12 units of it.
- A goal circle's `r` defaults to 20.
- The track's fields can also sit straight on `course` (without `map:`).
- `trackCode` is read, not run: it may use `forward`/`fd`, `backward`/`bk`/`back`,
  `left`/`lt`, `right`/`rt`, `goto`/`setpos`/`setposition`, `setheading`/`seth`, `home`,
  `penup`/`pu`/`up`, `pendown`/`pd`/`down` and `circle(radius, extent)` with plain numbers,
  `for i in range(n):` loops, `import turtle`, and comments. Its turtle starts at (0, 0) facing
  east with the pen down; every line it draws is a wall. Anything else is a validation error
  naming the line. This keeps the track drawable before the first Run, in the Builder and by
  `lessons validate`.

### Sensors and the vehicle

All on `turtle`, so one `import turtle` is enough:

| Function | Returns |
|---|---|
| `turtle.wall_ahead()` | `True` if a wall is straight ahead (grid: the next square; track: within 30) |
| `turtle.wall_left()`, `turtle.wall_right()` | The same, to the left or right of the heading |
| `turtle.at_goal()` | `True` on the goal |
| `turtle.on_pickup()` | `True` on a pickup's square or spot (it's collected as the vehicle arrives) |
| `turtle.collected()` | How many pickups so far (a name-tag panel can show it if the code stores it) |

- **Pickups** are collected by driving over them.
- **Crashing:** driving into a wall stops the vehicle with a small bump and a crash mark, and the
  program stops there with a plain message, not a traceback: "The rover hit a wall at row 2,
  column 5." (grid: the wall's square, rows and columns counted from 1 at the top left) or "The
  car hit a wall at x 120, y -40." (track: where the car is). A crash isn't an error: the run
  counts as finished, and the checks decide.
- **Loops that never end:** a run stops after 1,000 moves on one map ("Is a loop going round
  forever?") or 20,000 sensor checks, with a plain message. Stop still works.
- **Trail:** the pen is down by default with a faint blue line, so students see the route.
  `penup()`, `pencolor()` and `pensize()` work as usual.
- **Vehicles:** `turtle` (default), `car`, `rover`, `boat`, `drone`: clean top-down drawings
  that turn with the heading.
- **Speed:** with no `speed()` call a course plays at real turtle's speed 1, so each move can be
  followed (a very long run is squeezed into 30 seconds). Skip jumps to the end of the map.
- **Slow-mo** steps line by line (one step per line run; `forward(3)` is one step). Slow-mo and
  the name-tag panel follow map 1.

### Several maps (`maps`)

```yaml
course:
  type: grid
  vehicle: rover
  maps:
    - |
      #######
      #>...G#
      #######
    - |
      #####
      #>..#
      ###.#
      #G..#
      #####
```

The student's code runs once per map (up to 6), each with a fresh vehicle at that map's start.
Run plays the maps one after another; a tab per map shows a tick or a cross once it has played,
and pressing a tab shows that map again. The output starts each map with "── Map 2 of 3 ──". If
the code raises a real Python error on one map, the later maps aren't run (and count as not
reached). Use several maps to ask for a general solution with sensors rather than a fixed list of
moves. In track mode, `maps` is a list of track definitions.

### Students make their own map (`studentMap`)

For a Make It Your Own task, `studentMap: true` lets the student design their own maze and then
write the code that drives it. Grid courses only.

```yaml
- title: Make your own maze
  moduleType: turtle
  course:
    type: grid
    vehicle: rover
    studentMap: true          # the student's code may set the map
    map: |                    # shown until the student sets one (still required)
      #######
      #>...G#
      #######
  codeStages:
    - role: starter
      code: |
        import turtle
        #> Draw your own maze: # for walls, . for road, G for the goal, * for stars, ^ for the start
        turtle.course_map("""
        #########
        #.......#
        #^#####.#
        #G......#
        #########
        """)
        #> Now write code that gets the rover to the goal
  check:
    - type: course_goal_reached
    - { type: code, operator: contains, value: "course_map(" }
```

- **`turtle.course_map(text)`** replaces the task's map for this run. It uses the same legend and
  limits as an authored grid map (`#` `.` `G` `*` and one of `>` `<` `^` `v`; one start, at least
  one goal, at most 30 × 30). Blank lines at either end and indentation every line shares are
  fine, so a triple-quoted string can sit inside a function.
- It must come **before the vehicle's first move or turn** (put it straight after
  `import turtle`). Calling it again before moving replaces the map again. Pen settings chosen
  before it (`pencolor()`, `speed()`, …) are kept.
- **Mistakes stop the run with a plain message**, not the authored map: "Your map needs a G for
  the goal.", "Your map has two starts (>): keep just one.", "Your map needs a start: put > where
  the rover begins (or < ^ v to face another way).", "Your map uses "x": use # for walls, . for
  road, G for the goal, * for stars and > for the start.", "Your map is 32 squares wide; the most
  is 30.", "Your map is empty: …", and "Call course_map() before the rover moves: put it near the
  top, straight after import turtle." On a task without `studentMap`, `course_map()` stops with
  "This task's map is set for you, so course_map() can't change it."
- **The map shows straight away.** Before the first Run (and during slow-mo) the picture shows
  the usable map in the student's code, so they see their maze as they make it (the task's `map`
  while the code's map has a mistake). After a Run it shows the map that run used, even if the
  code only drew the map and has no driving code yet.
- **Checks read the student's map**: `course_goal_reached`, `course_no_crash`, `course_pickups`
  (default: all of the student's stars) and `course_max_moves` judge the run on the map it used.
  Add a `code` check for `course_map(` if the student must make their own.
- **With `maps`** (several authored maps): code that sets its own map runs **once, on that map**
  (no "Map 1 of 3" headings; the checks see one map). Code that doesn't call `course_map()` drives
  every authored map as usual.
- **Map editor:** a **Map editor** button (🧱) beside Run opens a tap-to-paint grid with Wall,
  Road, Goal, Star and Start tools. Squares are at least 44 px, so it works on a tablet, where
  typing a maze is fiddly. It opens on the map in the student's code (or the task's map), keeps
  exactly one start (tapping the start again turns it), and has Rows and Columns buttons (3 to
  30). **Use this map** writes the map into the code as `turtle.course_map("""…""")`, replacing
  the map already there, or adding the call straight after `import turtle`. It is offered on
  every device, only on `studentMap` tasks.
- **Map rows are never line hints:** a row such as `#>....G#` inside the `"""…"""` string stays
  in the code; [line hints](#line-hints) are only read outside triple-quoted strings.
- Tutor views, Go Live and the session report work as for any course: every screen draws the
  student's map from the run.

### Course checks

| Type | Fields | Passes when |
|---|---|---|
| `course_goal_reached` | none | The vehicle ends on the goal, on every map. |
| `course_no_crash` | none | It never hits a wall, on every map. |
| `course_pickups` | `min` (optional; default all) | It collects at least `min` pickups (or all of them) on every map. |
| `course_max_moves` | `max` (required) | It uses at most `max` moves on every map. Every `forward`, `backward`, `goto`, turn and `circle` call is one move. |

Use `code` and `turtle_command_used` checks for the method, e.g. "used `while`" or "used
`wall_ahead`" (`{ type: code, operator: contains, value: "wall_ahead(" }`). Course checks need a
run, like every Turtle check (`lessons test-checks` reports them as needing one). The Builder
offers them on a task with a course and fills in a kid-friendly hint. The usual Turtle checks
(`turtle_position` and so on) read map 1's run.

### Course validation

The Builder and `lessons validate` check that `course.type` is `grid` or `track`, the vehicle is
one of the five, there is `map` or `maps` (not both, at most 6), every grid map uses only the
legend with exactly one start and at least one goal, every track has a goal and well-formed walls,
pickups and `trackCode`, and course checks sit on a Turtle task with a course
(`course_max_moves` needs a whole-number `max`). `studentMap` must be `true` or `false` and only
works on a grid course (which still needs its `map`). A track whose start touches a wall or sits
in the goal gets a warning, and so does a `studentMap` starter whose `course_map()` map has a row
starting with `#>`. They can't run the code, so they don't check that a solution reaches the
goal: run it in the Builder preview, which runs every map. See
[validation-errors.md](validation-errors.md).

### Tutor and report

- The tutor's student card shows the last run: "Reached goal", "Crashed" or "2/3 maps". The
  student modal shows the maps, finished; Go Live plays the presenter's run on every screen.
- The session report adds, per student per task, `course: { runs, goalReached, goalRuns,
  crashes, pickups, lastGoalReached }`, and per task `courseGoalReachedCount` and
  `courseCrashedCount` (see [session-reports.md](session-reports.md)).

### Accessibility

Walls are dark and hatched, road pale with grid lines, the goal a chequered flag, pickups gold
stars (a dashed ring once collected) and a crash a red burst, so they differ by shape and pattern
as well as colour. The picture's words for screen readers say where the vehicle is, which way it
faces, the pickups and the goal ("Rover at row 2, column 3, facing east. 1 of 2 pickups
collected. Goal at row 1, column 7."). What happened on each map is announced in a polite live
region. Map tabs, Skip and Play are at least 44 px.

## Code Arrange (`code_arrange`)

`type: code_arrange` with `moduleType: turtle` is the "no typing yet" step: students drag code
tiles into the blanks of a Turtle program, then Run it. The board sits where the editor would, in
the Turtle workspace, so the run looks exactly like a code task's: the canvas with its animation
and Skip, [slow-mo](#slow-mo) if the task turns it on, the
[name-tag panel](#name-tag-panel-showvariables), and [course mode](#course-mode-course) (maps,
sensors, crashes and map tabs), with the Picture · Tags · Console tabs on smaller screens. Run is
enabled once every blank is filled.

- Any Turtle check works: `turtle_*` and `course_*` checks beside `output` / `code` checks, as on
  a code task.
- `course`, `slowMo`, `showVariables`, `layout` and `setupCode` work as on a code task.
- Tiles, blanks, distractors, tile feedback, indent mode (`arrangeMode: indent`), the tutor's
  board (with the student's last picture or course map under it) and the report's attempts are
  those of every arrange task: see `docs/authoring/lesson-schema.md` ("Code Arrange Task Fields").
- Write each line with its own leading spaces (4 per level); validation warns when a solution
  line after a `…:` line isn't indented.

```yaml
- title: Get the rover to the flag
  type: code_arrange
  moduleType: turtle
  explainer: Drag the lines into place so the rover turns at walls and reaches the flag on both maps.
  course:
    type: grid
    vehicle: rover
    maps:
      - |
        ########
        #>....G#
        ########
      - |
        #####
        #>..#
        ###.#
        ###G#
        #####
  lines:
    - id: L1
      parts: [{ type: text, text: "import turtle" }]
    - id: L2
      parts: [{ type: text, text: "while not turtle.at_goal():" }]
    - id: L3
      parts:
        - { type: text, text: "    if turtle." }
        - { type: slot, id: S1, code: "wall_ahead" }
        - { type: text, text: "():" }
    - id: L4
      parts: [{ type: slot, id: L4, code: "        turtle.right()" }]
    - id: L5
      parts: [{ type: text, text: "    else:" }]
    - id: L6
      parts: [{ type: slot, id: L6, code: "        turtle.forward()" }]
  distractors:
    - { id: D1, code: "at_goal" }
    - { id: D2, code: "        turtle.left()" }
  checks:
    - type: course_goal_reached
      hint: Watch where the rover stops. Which way should it turn at a wall?
    - type: course_no_crash
      hint: Look before every move.
```

In the Builder, choose **Arrange** and then **Python Turtle** under Language; the preview draws
the run (every map of a course). The Arrange form doesn't edit `course`, `slowMo` or
`showVariables` yet: author those in YAML.

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
