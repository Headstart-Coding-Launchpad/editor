# Stage guides: grid, rulers, live coordinates and labelled marks

- **Status:** open
- **Kind:** module
- **Requested by:** Ryan (via HSC Hub handoff #50), 2026-10-22
- **Lessons blocked:** none yet (the Lesson Gen "Make It Real" plan must account for it)

## Need

Ryan, 2026-10-22: 'We need some proper guides for the Stage, and when we do the LG Make It Real plan that needs to be factored in.' Students place things on a fixed 400 x 400 Stage with a top-left origin and y pointing down, which is the opposite of Turtle and of school maths. Nothing on the Stage shows where x=200, y=100 is, so they guess and re-run.

## Proposal (from LaunchPad Dev, for Ryan to approve)

Guides are a read-only overlay drawn above the picture. They are never part of the drawing, so `stage_pixel` / `stage_matches_target` checks, lesson screenshots, exports and the synced `currentStageResult` are unchanged.

1. **Grid lines** every 50 (or 25) units with the numbers on the top and left edges. Student toggle ("Guides") on the Stage pane, default off.
2. **Live coordinates**: hover (mouse) or press-and-hold (touch) shows a crosshair and `x, y` for that point, so a student can read off where to put a shape.
3. **Centre and edge marks**: a faint cross at (200, 200) and tick marks, so 'centre anchors' make sense.
4. **Labelled marks** a lesson can pin: `stageGuides: { grid: 50, marks: [{ x: 120, y: 80, label: 'nose' }] }` on a Python task. `grid` shows the guides at the start of that task; `marks` appear with their label whenever guides are on. Both optional. Marks are for instructions ('put the nose at the mark').
5. **Tutor visibility**: the tutor's Stage in the student modal has the same toggle, and a pinned mark appears for them too. Whether a student has guides on is a small synced flag (`guidesOn`) shown as a chip, so the tutor knows why a student is or is not using them. A tutor can switch guides on for one student or the class (like highlight/force panes). Not built yet.

Out of scope: guides on Turtle or Scratch stages (different coordinate systems).

## What Lesson Gen's Make It Real plan must account for

- Author with the Stage's coordinates: 400 x 400, top-left origin, y down, shapes anchored on their centre. State coordinates in lesson text only alongside `stageGuides.marks`, so students can see them.
- Do not assume guides are on: lessons that need them set `stageGuides.grid`.
- Target pictures (`stageTarget`) and the guides share the same 400 x 400 space, so a mark can sit on a target feature.
- Guides never count as drawing: do not write checks against them.
- Until this ships, keep Make It Real placement tasks to centre-anchored shapes at multiples of 50.

## Notes

New task field `stageGuides` (python module). Needs `docs/authoring/python.md` Stage section, `lesson-schema.md`, validation (grid is 25 or 50, marks have numeric x/y within 0-399 and a label of 24 characters or less), and a CHANGELOG entry (Affects: python Stage tasks. Existing lessons: unaffected. Resolves: this request).

## Resolution

<!-- Filled in by whoever builds it: PR link, activity/module id, docs link. -->
