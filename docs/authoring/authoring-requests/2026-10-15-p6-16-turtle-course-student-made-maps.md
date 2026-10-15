# Turtle course mode: students make their own maze

- **Status:** shipped
- **Kind:** activity mode
- **Requested by:** Lesson Gen agent (approved by Ryan, filed straight to LaunchPad Dev at Ryan's request, bypassing pipeline-ui, as with builds 1–12), 2026-10-15
- **Lessons blocked:** none yet. Wave 1c of Lesson Gen's LG-P6 Visual learning plan, from Ryan's click-through of the sandbox (`ocgq3appv6`). Build on top of `integrate/requests-2026-10-14`.

## Need

After the sandbox, Ryan said students need to build their own things, not only hit targets ("independence"). For course mode, that means designing **their own maze** and then writing code that drives it, as a Make It Your Own task. Today the map is fixed in the task's `course` field, so students can only drive maps an author made.

**Closest existing capability:** course mode (`docs/authoring/turtle.md`, Course mode), with grid maps as text using the `#`, `.`, `G`, `*`, `>` legend.

## Example task

```yaml
- id: 73
  moduleType: turtle
  title: Make your own maze
  course:
    type: grid
    vehicle: rover
    studentMap: true          # new: the student's code may set the map
    map: |                    # the map shown until the student sets one
      #######
      #>...G#
      #######
  codeStages:
    - role: starter
      code: |
        import turtle
        #> Draw your own maze: # for walls, . for road, G for the goal, * for stars, > for the start
        turtle.course_map("""
        #########
        #>......#
        #######.#
        #G......#
        #########
        """)
        #> Now write code that gets the rover to the goal
```

## Behaviour wanted

- **`turtle.course_map(text)`** (name is your call), allowed only when the task has `studentMap: true`. It replaces the task's map for this run, before the first move.
  - It uses the same legend and limits as authored grid maps: one start, at least one goal, at most 30 × 30.
  - Mistakes get plain messages: "Your map needs a G for the goal", "Your map has two starts (>)".
- **The map draws** as soon as the run starts, so students see their maze even if their driving code is empty.
- **Checks** (`course_goal_reached` and the rest) read the student's map when one is set, so a Make It Your Own task can check "your rover reaches your goal" if the author wants.
- **Tracks:** grid only for now.
- **Nice to have, your call:** a click-to-paint map editor (wall / road / goal / star / start) on tablets, writing the map text for them. Typing a maze is fine on a laptop and fiddly on a tablet.

## Checks wanted

- **Outcome:** the existing course checks, read on the student's map.
- **Method:** a `code` check for `course_map(` if the author wants one.

## Devices

- As course mode. If the map editor is built, its squares are at least 44 px.

## Notes

- **Ages:** 11–16. A maze someone else's code must solve is a natural "try my maze" moment in class. Sharing mazes between students isn't asked for here.
- **Accessibility:** the map's screen-reader text describes the student's map the same way as an authored one.
- **Plan:** `Lesson Gen Agent/Plans/LG-P6 Visual learning.md`, wave 1c.

## Resolution

Shipped 2026-10-15 on branch `feature/course-student-maps`, for merging into `integrate/requests-2026-10-14`. It is not on `main` yet: that waits for Ryan's browser pass.

It shipped as part of the `turtle` module's course mode:
  - a new course field, `studentMap: true` (grid courses only; it errors on a track). The authored `map` is still required and shows until the student sets one;
  - `turtle.course_map(text)`, allowed only on a `studentMap` task and before the first move or turn. It uses the same legend and limits as authored grid maps, and mistakes get plain messages ("Your map needs a G for the goal.", "Your map has two starts (>): keep just one.");
  - the student's map shows as soon as it's in the code, and the course checks, tutor views, Go Live, slow-mo and screen-reader words use the map the run drove;
  - with `maps`, code that sets its own map runs once, on that map; code that doesn't drives every authored map;
  - the tap-to-paint **Map editor** (Wall, Road, Goal, Star and Start tools, 44 px squares, 3 to 30 rows and columns), which writes `turtle.course_map("""…""")` into the student's code.

  Validation also warns when a starter map row starts with `#>`, because the line-hint marker would take it out of the code. Docs: [turtle.md](../turtle.md) "Students make their own map (`studentMap`)".
