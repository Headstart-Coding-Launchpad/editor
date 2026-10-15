# Turtle course mode: drive a vehicle round a maze or track

- **Status:** shipped
- **Kind:** activity mode
- **Requested by:** Lesson Gen agent (approved by Ryan, filed straight to LaunchPad Dev at Ryan's request, bypassing pipeline-ui, as with builds 1–6), 2026-10-15
- **Lessons blocked:** none yet. Wave 1b of Lesson Gen's LG-P6 Visual learning plan (v5). Used by pilot lesson C (an `if`/`while` lesson). Depends on animated Turtle drawing (`2026-10-15-p6-10-…`). Build this on top of `integrate/requests-2026-10-14` (builds 1–6) rather than waiting for them to merge, and merge when ready (Ryan, 2026-10-15).

## Need

Ryan: "controlling vehicles with code". Each line of code is one visible move, so sequence, loops, `if`, `while` and functions can be seen working. Logo's first turtle was a floor robot, so this is Turtle's original idea. It also leads towards a future Robotics or Electronics track.

It is **not** a game: no game loop, no keys, no events. Students write instructions, press Run, and watch the vehicle follow them. That keeps it apart from Arcade Kit.

**Closest existing capability:** the `turtle` module (`docs/authoring/turtle.md`). It has movement, headings and drawing, but no walls, goals, sensors or way to fail by crashing. Lesson Gen thinks this is a mode of `turtle` rather than a new module: the student writes real Turtle Python. Apply your module-vs-activity test, and relabel it if needed.

## Example task

```yaml
# Grid maze: forward() moves one square, turns are 90°
- id: 51
  moduleType: turtle
  title: Get the rover to the flag
  course:
    type: grid                # grid | track
    vehicle: rover            # turtle (default) | car | rover | boat | drone
    map: |
      #########
      #>..#..G#
      #.#.#.#.#
      #...*...#
      #########
    # legend: # wall, . road, G goal, * pickup, > < ^ v start and heading
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
    - type: course_no_crash

# Same code, several maps: forces a general solution using sensors
- id: 52
  moduleType: turtle
  title: One program, three mazes
  course:
    type: grid
    maps: [ "…map 1…", "…map 2…", "…map 3…" ]
  check:
    - type: course_goal_reached   # on every map
```

**Track** (`type: track`): free movement with real Turtle distances and angles. Walls are line segments or shapes (e.g. drawn by a `trackCode` Turtle or Stage snippet), with a start position and heading, a goal zone and pickup points. The format is yours to design.

## Behaviour wanted

- **Movement (grid):** `forward()` with no argument moves one square; `forward(3)` moves three. `left()` and `right()` with no argument turn 90°. Other angles are an error in grid mode, explained plainly.
- **Movement (track):** normal Turtle commands; the vehicle is the turtle.
- **Sensors** (functions on `turtle`, so it stays one import): `wall_ahead()`, `wall_left()`, `wall_right()`, `at_goal()`, `on_pickup()`. In track mode, "ahead" looks a short fixed distance forward.
- **Pickups:** collected by driving over them. `turtle.collected()` returns how many so far, so the name-tag panel can show it.
- **Crashing:** driving into a wall stops the vehicle with a small bump and a plain message: "The rover hit a wall at row 2, column 4." The program stops there.
- **Trail:** the vehicle leaves a faint track (the pen, down by default), so students see the route it took.
- **Several maps:** with `maps`, Run plays each map in turn (or side by side; your call), with a tick or cross per map.
- **Vehicles:** clean top-down sprites that turn with the heading. Grown-up enough for ages 11–16, not cartoonish.
- **Works with:** animated drawing, slow-mo (one step per move), the name-tag panel, locked lines and puzzle rules (`2026-10-15-p6-8-…`), e.g. "reach the goal in 6 lines".

## Checks wanted

- **Outcome:** `course_goal_reached` (on every map when `maps` is used); `course_no_crash`; `course_pickups` with `min` (default: all).
- **Method:** optional `course_max_moves`; `code` and `turtle_command_used` checks for the method (e.g. used `while`, used `wall_ahead`).
- `lessons test-checks` can report these as needing a run.

## Devices

- The map scales to fit; the vehicle and walls stay readable on a phone-sized tablet.
- Skip, Play and per-map ticks are 44 px+.

## Notes

- **Accessibility:**
  - Walls, road, goal and pickups differ by shape or pattern as well as colour.
  - A text description a screen reader can read: "Rover at row 2, column 3, facing east. 1 of 2 pickups collected. Goal at row 1, column 7."
  - The crash message is a live region.
- **Teacher:** the student card shows "Reached goal", "Crashed" or "2/3 maps"; Go Live shows the presenter's run.
- **Report:** per student per task, `goalReached`, `crashes` and `pickups` at each run, so Lesson Gen can measure the pilot.
- **Plan:** `Lesson Gen Agent/Plans/LG-P6 Visual learning.md`, v5 decisions: grid or track per task; goals and walls, sensors, pickups, vehicle choice.

## Resolution

Shipped 2026-10-15 on branch `feature/turtle-course-mode` (89a424a), merged into `integrate/requests-2026-10-14`. It is not on `main` yet: that waits for Ryan's browser pass.

It shipped as a mode of the `turtle` module, the `course` task field, with `type: grid | track`:
  - five vehicles;
  - sensors on `turtle`;
  - pickups, crashes and several `maps` played in turn;
  - checks `course_goal_reached`, `course_no_crash`, `course_pickups` and `course_max_moves`;
  - a card chip and a `courseLog` report.

  A track's `trackCode` is read as a fixed Turtle subset, not run. **Needs a database rules deploy** for `students/{id}/courseLog`. Docs: [turtle.md](../turtle.md) "Course mode".
