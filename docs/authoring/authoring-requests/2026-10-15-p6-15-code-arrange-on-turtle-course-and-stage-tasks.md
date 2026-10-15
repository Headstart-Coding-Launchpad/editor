# Code Arrange that runs on Turtle (including course mode) and Stage tasks

- **Status:** open
- **Kind:** activity mode
- **Requested by:** Lesson Gen agent (approved by Ryan, filed straight to LaunchPad Dev at Ryan's request, bypassing pipeline-ui, as with builds 1–12), 2026-10-15
- **Lessons blocked:** none yet. Wave 1c of Lesson Gen's LG-P6 Visual learning plan, from Ryan's click-through of the sandbox (`ocgq3appv6`, task 13). Build on top of `integrate/requests-2026-10-14`.

## Need

Ryan, on the rover task: the visual tools are good, but "we're missing a few things for the ability to use without writing — maybe we need an arrange for Turtle and Stage?" Our lessons use Code Arrange (drag tiles into place, then Run) as the step between reading code and writing it. Students build the right structure without typing, which matters for slow typists in a lockstep class.

**Closest existing capability:** `taskType: code_arrange` (`docs/authoring/python.md`, Drag-and-Drop Runnable Code; `lesson-schema.md`, Code Arrange Task Fields). It only hosts Python console and HTML. Turtle tasks fall back to `fill_blank` quizzes, which don't run, so the student never sees the rover drive or the drawing appear.

## Example task

```yaml
- id: 72
  title: Get the rover to the flag
  taskType: code_arrange
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
  check:
    - type: course_goal_reached
      hint: Watch where the rover stops. Which way should it turn at a wall?
    - type: course_no_crash
      hint: Look before every move.
```

A Stage example would be the same shape with `moduleType: python`, `from stage import *` in the lines, an optional `stageTarget`, and `stage_*` checks.

## Behaviour wanted

- **Turtle `code_arrange`:**
  - The assembled program runs in the Turtle workspace: the canvas, animation and Skip, slow-mo if the task turns it on, the name-tag panel, and **course mode** (maps, sensors, crashes, map tabs).
  - Turtle checks and course checks work as on a code task.
- **Stage `code_arrange`:**
  - A Python `code_arrange` whose code imports `stage` gets the Stage pane, `stageTarget` (ghost, Differences) and the `stage_*` checks, as a code task does.
- **Indent mode** (Indent Arrange) should work for both too, if it's cheap.
- **Everything else as today:** tiles, slots, distractors, tile feedback, the tutor's view, and the report's attempts.

## Checks wanted

- **Outcome:** the existing Turtle, course and Stage checks, unchanged.
- **Method:** none new.

## Devices

- As Code Arrange today: drag on laptops and tablets, 44 px tiles. The canvas or Stage sits where the code task's result pane would (the p6-12 layout).

## Notes

- **Ages:** 11–16, mixed ability. Arranging is the "no typing yet" rung for slow typists.
- **Plan:** `Lesson Gen Agent/Plans/LG-P6 Visual learning.md`, wave 1c. Our `Quiz Writing Guide.md` will drop "Turtle uses fill_blank" once this ships.

## Resolution

<!-- Filled in by whoever builds it: PR link, activity/module id, docs link. -->
