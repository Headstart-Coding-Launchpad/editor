# Live number and colour scrubbing in the code editor

- **Status:** shipped
- **Kind:** module
- **Requested by:** Lesson Gen agent (approved by Ryan, sent straight to LaunchPad Dev at Ryan's request, bypassing pipeline-ui), 2026-10-14
- **Lessons blocked:** none yet. This is build 4 of 6 in Lesson Gen's P6 Visual learning plan.

## Need

The plan's Modify step is "one change, one visible difference". Today a student edits a number, presses Run, and compares the result. Scrubbing makes that change instant: drag a number or pick a colour, and the drawing updates live. This is the Bret Victor / Khan Academy pattern, and the closest thing to Brilliant's "edit the picture" feel that Ryan liked.

**Closest existing capability:** the code editor shared by `python`, `turtle`, `arcade` and `html`. It has no inline value controls, and Turtle explicitly has "no live redraw while typing" (`turtle.md`).

## Example task

```yaml
- id: 40
  moduleType: turtle          # also: python with Stage, html (CSS values), arcade where feasible
  title: Change the size, watch the square
  scrub:
    enabled: true
    numbers: true             # drag/tap a number literal to get a slider
    colours: true             # click a colour string ("red", "#ff0000") for a picker
    ranges:                   # optional per-line hints; otherwise a sensible range around the value
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

**Behaviour**

- **On a desktop:**
  - Hovering a number literal shows that it can be dragged.
  - Dragging left or right changes it. The step size follows the value: whole numbers stay whole, decimals step by 0.1.
  - Clicking a colour literal opens a picker. The chosen value is written back into the code as a name or hex, matching the original style.
- **Re-running:** the program re-runs live, debounced, for draw-only programs (Turtle, Stage, HTML/CSS).
  - Programs that use `input()` don't re-run live. Show "Press Run to see it" instead.
  - For Arcade, live re-run only if hot reload is cheap. Otherwise skip Arcade.
- **The edit is a real code edit:** it's saved, counted in typing history, and visible to the teacher.

## Checks wanted

- **No new checks.** Existing checks run after the final value as normal.
- **Session report:** note scrub interactions, so Lesson Gen can see whether Modify tasks are used.

## Devices

- **Tablets:** tapping a number opens a slider beside it (dragging inline text isn't reliable on touch), and tapping a colour opens the picker. Touch targets are at least 44 px.
- **Chromebooks:** keep re-running light. Debounce, and skip a re-run if the last one is still going.

## Notes

- **Accessibility:**
  - The slider is usable from the keyboard (arrow keys), and the picker has named colours, not only a colour wheel.
  - The colour-blind-safe palette is offered first.
- **HTML:** scrubbing CSS values (`margin: 20px`, `color: red`) with a live preview is very valuable there. Include it if the editor makes it straightforward.
- **Order:** P6 build order is 1 name-tag panel, 2 Stage, 3 Python slow-mo, 4 this, 5 HTML Inspector, 6 Scratch slow-mo.

## Resolution

Shipped 2026-10-14 on `feature/editor-scrubbing` as the task field `scrub: { enabled, numbers,
colours, ranges: [{ line, min, max }] }` on Python, Turtle and HTML tasks (Arcade skipped: no cheap
hot reload).

- **Desktop:** hovering a number underlines it with an ew-resize cursor; dragging left / right
  changes it (whole numbers stay whole, decimals step by their last place, CSS units kept, per-line
  ranges clamp, otherwise 0 to twice the value). Clicking a colour opens the picker.
- **Tablets:** tapping a number opens a slider popover beside it (− / + and Done, all 44 px+);
  tapping a colour opens the picker. **Keyboard:** Alt+Enter opens either popover; arrow keys move
  the slider, Enter keeps, Escape puts the value back.
- **Picker:** the Okabe-Ito colour-blind-safe palette first (with text labels), then common colour
  names, then a hex box. A name stays a name when the choice has one; hex stays hex (case and
  3-digit form kept).
- **Re-running:** a debounced (200 ms) preview run for Turtle, Python programs that import
  `stage`, and HTML/CSS (the student's own preview iframe). No attempt log, checks, save,
  `currentCode` write or typing count during the drag, and a re-run never starts while the last is
  running. Programs calling `input()` (and Python without the Stage) show "Press Run to see it".
- **Real edit:** when the drag or popover ends, the preview is reverted and the final value applied
  as one edit (one Undo step): saved, sent to a watching tutor like typing, checked on the next Run.
  It counts as an edit, not typed characters.
- **Report:** `scrubs`, `scrubNumbers`, `scrubColours` per student task and `scrubUsedCount` per
  task, from a new counts-only RTDB node `students/{id}/scrubLog/{taskId}` (rules deploy needed).
- Builder: Task options → Live scrubbing. Docs: python.md, turtle.md, html.md, session-reports.md,
  validation-errors.md.
