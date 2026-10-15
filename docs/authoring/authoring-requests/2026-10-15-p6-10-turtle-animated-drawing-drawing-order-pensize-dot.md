# Turtle: animated drawing, real drawing order, pensize() and dot()

- **Status:** shipped
- **Kind:** module
- **Requested by:** Lesson Gen agent (approved by Ryan, filed straight to LaunchPad Dev at Ryan's request, bypassing pipeline-ui, as with builds 1–6), 2026-10-15
- **Lessons blocked:** none yet. Wave 1b of Lesson Gen's LG-P6 Visual learning plan (v5). Used by pilot lessons A and C, and needed by Turtle course mode (`2026-10-15-p6-11-…`). Build this on top of `integrate/requests-2026-10-14` (builds 1–6) rather than waiting for them to merge, and merge when ready (Ryan, 2026-10-15).

## Need

Ryan: "the turtle is a good tool, we need to use it more". Turtle is the classic "few lines, amazing picture" tool: spirals, stars and flowers from loops and functions. Four things in `docs/authoring/turtle.md` hold it back:

1. **Drawing is instant.** "The whole script runs to completion, then the canvas draws the finished result in one pass." Watching the turtle draw is most of the magic, and it's how students connect each line to each stroke. A vehicle on a course must be seen moving.
2. **Drawing order is in fixed layers** (fills, then lines, then stamps, then text), not the order the code runs. Layered art comes out wrong. For example, a white circle drawn over a filled star is hidden behind the star's outline, and later fills don't cover earlier lines.
3. **No `pensize()`.** Thin lines make spirals and flowers look weak.
4. **No `dot()`.** Common in pattern art.

## What's wanted

**1. Animated drawing at `speed()`.**
- Run plays the drawing as it would in real Python turtle: the 🐢 moves and draws, turns visibly, at the `speed()` set in the code. Match real turtle's `speed()` values and names (`0`/`"fastest"` = instant).
- **The default speed must be quick.** Class time is tight; propose a default that finishes most lesson drawings in a few seconds, and a **Skip** button (44 px) that jumps to the finished drawing.
- **Checks** are worked out from the finished run as now; the result shows when the drawing finishes or is skipped.
- **Slow-mo takes over when it's on** (build 3's `slowMo`): its slider and step buttons control playback, and `speed()` is ignored.
- **Scrubbing always draws instantly** (build 4's preview runs), whatever `speed()` says.
- **Go Live:** the presenter's animation plays on every screen; a watching tutor sees a student's finished drawing.
- **Reduced motion:** draw instantly, with a Play button to watch it.

**2. Real drawing order.**
- Draw in the order the code runs, so later shapes cover earlier ones, as in real turtle.
- Keep the one sensible exception: a filled shape's own outline stays on top of its own fill.
- Please check whether any live lesson depends on the layered order (Lesson Gen believes no Python lesson uses Turtle yet).

**3. `pensize(width)`** (alias `width()`), and reading it back with no argument, as in real turtle.

**4. `dot(size=None, colour=None)`**, as in real turtle: a filled circle centred on the turtle, not moving it.

## Example task

```yaml
- id: 41
  moduleType: turtle
  title: Spiral
  codeStages:
    - role: starter
      code: |
        import turtle
        turtle.speed(8)
        turtle.pensize(3)
        for i in range(60):
            turtle.pencolor(["red", "orange", "gold", "green", "blue"][i % 5])
            turtle.forward(i * 4)
            turtle.left(59)
        turtle.dot(20, "white")
  check:
    - type: turtle_command_used
      command: left
```

## Checks wanted

- `turtle_command_used` accepts `pensize` and `dot`.
- No other new checks.

## Devices

- The Skip and Play buttons are at least 44 px with icon and word.
- Animation must stay smooth on a mid-range tablet with a 500-step drawing.

## Notes

- **Accessibility:** under reduced motion, instant drawing with Play; the existing text description of the drawing is unchanged.
- **Course mode** (`2026-10-15-p6-11-…`) depends on the animation.
- **Plan:** `Lesson Gen Agent/Plans/LG-P6 Visual learning.md`, v5 decisions.

## Resolution

Shipped 2026-10-15 on branch `feature/turtle-animation` (4354e48), merged into `integrate/requests-2026-10-14`. It is not on `main` yet: that waits for Ryan's browser pass.

It shipped as a change to the `turtle` module. Drawings now animate at `speed()`:
  - with no `speed()` call, a drawing plays at speed 10 and finishes within 4 s;
  - `speed(1–10)` plays at real-turtle pace;
  - `speed(0)` draws instantly.

  Skip and Play buttons are 44 px. Under reduced motion, the drawing appears at once and Play animates it. Shapes now draw in code order, with a fill's own outline kept on top of it. New `pensize()`/`width()` and `dot()`, which `turtle_command_used` accepts. A screen-reader description of the drawing. Docs: [turtle.md](../turtle.md).
