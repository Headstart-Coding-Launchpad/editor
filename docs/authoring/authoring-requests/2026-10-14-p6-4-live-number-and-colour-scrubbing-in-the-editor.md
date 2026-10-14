# Live number and colour scrubbing in the code editor

- **Status:** open
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

