# Platform requests 2026-10-15: build plan

Agreed with Ryan on 2026-10-15. It covers the six LG-P6 wave 1b requests in `docs/authoring/authoring-requests/2026-10-15-p6-*.md` (P6-7 to P6-12). They build on the 2026-10-14 round (`requests-2026-10-14-plan.md`).

## How it's built

- Each package gets one branch, cut from `integrate/requests-2026-10-14`, and is merged back there. Integration happens in the main checkout.
- Agents work in their own worktrees, and parallel agents never run tests. The lead merges each wave and runs the full suite once.
- **Finish line:** everything is merged on the integration branch, the suite is green and the requests are marked shipped. Nothing is pushed or merged to `main` until Ryan has done his browser pass.

## Facts checked before planning

- None of the 90 lessons in Firestore uses Turtle or the Stage (scan on 2026-10-15). It is safe to change Turtle's drawing order and the Stage's argument order outright.
- Builds 1–6 (name tags, Stage, slow-mo, scrubbing, carry) are all on the integration branch.

## Decisions (Ryan, 2026-10-15)

- **Turtle speed:**
  - With no `speed()` call, a run plays like `speed(10)` ("fast"), and the whole drawing is squeezed to finish within about 4 s.
  - An explicit `speed(1–10)` plays at real-turtle pace, with **Skip**.
  - `speed(0)` / `"fastest"` draws instantly.
- **Course mode:** both **grid and track** in this round.
- **Small-screen layout:** the editor plus a **tabbed result pane** (Picture · Tags · Console).
  - After Run, the pane switches to whatever the task is about.
  - Slow-mo stacks the Picture and Tags.
  - Portrait screens put the editor above the tabs.
  - Wide desktops keep everything side by side.
- **Lead's calls (not asked):**
  - The marker and field names are as the requests suggest: `#@lock`, `setupCode`, `setupNote`, `puzzle.{onlyEdit,maxLines,par}`.
  - With `maps`, the maps play one after another, each with a tick or cross.
  - Vehicle sprites are hand-made SVG, so no new dependency.

## Packages and waves

### Wave 1 (4 agents, in parallel)

**W1-a: Name-tag visuals (P6-7)** (`feature/name-tag-visuals`)
- New `showVariables` fields:
  - `visuals` (default true)
  - `stageLists` (`picture | tiles | size`, default `size`)
- The visual for each value is chosen automatically:
  - colour swatches
  - number bars
  - 2D picture or table
  - dict cards or bars
  - tiles as the fallback
- The exact value is one tap away.
- Changed items are marked one by one.
- Works in predict and target modes, in slow-mo, and on the card, the StudentModal and Go Live.
- Raise the capture limits enough for 2D lists up to `grid()`'s limits. Record which variables were passed to `grid()` during the run.
- Accessibility: the Okabe-Ito palette and screen-reader text.

**W1-b: Locked lines, hidden setup, puzzles (P6-8)** (`feature/locked-lines-setup-puzzles`)
- `#@lock` uses a CodeMirror StateField plus a transactionFilter, modelled on `lineHintsField`. Locked lines get a 🔒 "Locked" mark and can't be indented.
- Students can still add lines around a locked line.
- Reset restores the locks, and tutor views show them.
- `setupCode` runs first, in the same namespace. Line offsets stay correct, and its variables are visible. `setupNote` is shown with it.
- `puzzle.onlyEdit`, `maxLines` (live counter) and `par` (shown only after a pass).
- New `max_lines` check.
- Validation:
  - setup runs cleanly
  - the complete code meets `maxLines` and `par`
  - warn when a locked line would need re-indenting
- Report fields `linesUsed` and `changesFromStarter`.
- Works for Python and Turtle.

**W1-c: Stage shapes (P6-9)** (`feature/stage-shapes`)
- Size-first calls with centre anchors, which replace the position-first order.
- New `square` and `polygon` shapes.
- New keywords `angle`, `opacity`, `outline`, `width` and `colour=None`.
- New `hue(n, light=)` function, and a default colour.
- Plain-English errors when the old argument order is used.
- Updates for `stage_shape_count` (`square`/`polygon`/`sides`), the raster comparison, the description, the SVG export and scrubbing.
- Update the docs and examples.

**W1-d: Animated turtle (P6-10)** (`feature/turtle-animation`)
- The playback engine follows the speed decision above, with Skip and Play buttons (44 px).
- Under reduced motion, draw instantly and offer Play.
- Slow-mo takes over playback; scrubbing always draws instantly.
- In Go Live, the presenter's run animates on students' screens; a watching tutor sees the finished drawing.
- Draw in real code order: a fill's own outline stays on top of its fill.
- `pensize`/`width` can also be read back; `dot()` is added.
- `turtle_command_used` accepts both.
- New: a text description of the drawing, modelled on Stage's `describe.js`.

### Wave 2 (2 agents, in parallel, after wave 1 is merged)

**W2-a: Turtle course mode (P6-11)** (`feature/turtle-course-mode`)
- A `course` task field with `type: grid | track` and a vehicle sprite (turtle, car, rover, boat, drone).
  - **Grid:** a text map.
  - **Track:** a start, a goal zone, wall segments and rectangles, pickups, and optionally walls from a `trackCode` snippet.
- Sensors: `wall_ahead()`, `wall_left()`, `wall_right()`, `at_goal()`, `on_pickup()` and `collected()`.
- Crashes stop the run with a live-region message, and the vehicle leaves a trail.
- `maps` runs several maps in turn.
- New checks: `course_goal_reached`, `course_no_crash`, `course_pickups`, `course_max_moves`. They are run-only context keys.
- Shown on the student card. Report fields `goalReached`, `crashes` and `pickups`.
- Accessibility: shape and pattern as well as colour, plus a text description.
- The course UI stays inside the picture pane's own component, so it doesn't fight W2-b over the workspace layout.

**W2-b: Python/Turtle screen space (P6-12)** (`feature/python-screen-space`)
- The tabbed result pane from the decision above, for Python and Turtle.
- An optional author hint, `layout.firstPane`.
- Panes are labelled regions you can switch with the keyboard, and updates are announced.
- The presenter layout must be readable on a projector.
- Check it at 1366×768, on tablets in portrait and landscape (keyboard open and closed), and on desktop.

## Follow-ups after the merge

- Mark the requests shipped and fill in each Resolution.
- Add CHANGELOG entries, one per request, each with its `Resolves:` line.
- Run `npm run docs:check` and the full `npm test`.
- Update the Hub status file.
