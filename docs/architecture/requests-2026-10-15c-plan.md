# Platform requests 2026-10-15 (wave 1c): build plan

Agreed with Ryan on 2026-10-15. It covers the five LG-P6 wave 1c requests from Ryan's click-through of the sandbox lesson (`ocgq3appv6`): `docs/authoring/authoring-requests/2026-10-15-p6-13…p6-17-*.md`. They build on wave 1b (`requests-2026-10-15-plan.md`).

## How it's built

- Same as wave 1b: one branch per package, cut from `integrate/requests-2026-10-14` and merged back there. Agents work in their own worktrees and never run tests. The lead merges and runs the full suite once.
- **Finish line:** everything is merged on the integration branch, the suite is green, the requests are marked shipped, and `preview/requests-2026-10-14` is moved up. Nothing is pushed or merged to `main`, and no rules are deployed, until Ryan's browser pass.

## Decisions (Ryan, 2026-10-15)

- **P6-16:** build the optional **tap-to-paint map editor** too (wall, road, goal, star, start; 44 px squares), writing the `course_map("""…""")` text into the student's code.
- **P6-15:** Indent Arrange on Turtle and Stage **only if it falls out** of the shared arrange code; otherwise it's logged as a follow-up.
- **Lead's calls (not asked):**
  - P6-16's function is `turtle.course_map(text)`, as the request suggests, gated by `course.studentMap: true`. Grid maps only.
  - P6-13 and P6-14 are one package, since both change how the name-tag panel shows the lists `grid()` drew.

## Packages (all in parallel)

**W1c-a: flat pixel grids and palette numbers (P6-13, P6-14)** (`feature/stage-flat-grid-panel-numbers`)
- `grid(values, width=n)` draws a flat list as rows; plain-English errors for a missing or bad `width`, or `width` with rows.
- `stage_pixel` gains `index`; the docs say `row`, `col` and `index` count from 0.
- The panel wraps a flat list that `grid(…, width=…)` drew at the same width, with the indexes running on.
- Palette numbers always show as numbers (a table for 2D, wrapped tiles for flat), never as a picture or bars. Colour names are unchanged.

**W1c-b: `#@peek` stopped-here band (P6-17)** (`feature/peek-stopped-here-band`)
- A dashed ⏸ band above the marked line in the editor ("The tags show the values here"), shown from when the task opens, unlike slow-mo's amber band. "The program never reached this line" when it didn't run.
- Panel header: "Values just before line N", in every mode. Tutor views and Go Live show both.

**W1c-c: runnable Code Arrange on Turtle and Stage (P6-15)** (`feature/code-arrange-turtle-stage`)
- `taskType: code_arrange` with `moduleType: turtle` runs in the Turtle workspace (canvas, animation, slow-mo, panel, course mode), with Turtle and course checks.
- A Python arrange that imports `stage` gets the Stage pane, `stageTarget` and the `stage_*` checks.

**W1c-d: student-made mazes (P6-16)** (`feature/course-student-maps`)
- `turtle.course_map(text)` when `course.studentMap: true`: same legend and limits as authored grid maps, plain-English errors, drawn at the start of the run, read by the course checks.
- Tap-to-paint map editor writing the map text into the code.
