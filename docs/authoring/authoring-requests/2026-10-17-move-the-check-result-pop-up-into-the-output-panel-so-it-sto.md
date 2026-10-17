# Move the check result pop-up into the output panel so it stops covering the code

- **Status:** shipped
- **Kind:** module
- **Requested by:** Ryan (approved by Ryan), 2026-10-17
- **Lessons blocked:** none yet

## Need

HSC Audit item 2. HSC Hub\Research\HSC Audit\Interview - LaunchPad.md: "Checks and hints: AI says the pop-up covers the code. Ryan hadn't noticed, but agrees it could move into the output panel (the old banner broke the layout)." HSC Hub\Research\HSC Audit\Visual Review\Visual Review.md, group 04 (Problem): "The fail pop-up covers the student's code ("print(H…") and the Run / Reset buttons; on a tablet it covers line 1 and the symbol bar." Cross-cutting issue 1: the Correct!/Not quite pop-ups cover Run, the file tabs and the code in groups 04, 10, 11, 19, 22 and 23. A student who fails a check needs to read the hint and their code at the same time.

Closest existing capability (from `lessons capabilities`): The check result / hint pop-up shown after Run (checks and hints, all workspace modules). It lacks a placement that doesn't overlap the editor and Run controls.

Current workaround and why it falls short: Students close the pop-up to see their code, then lose the hint. It fails every code task's 'read the hint, fix the line' loop, worst on tablets.

## Checks wanted

- Pass and fail results, and hints, show inside the output panel (or a strip attached to it) on Python, Turtle, HTML, Arcade and Scratch tasks.
- Nothing covers the editor, Run/Reset or the file tabs at desktop or tablet widths.
- The layout doesn't shift or break the way the old banner did: the editor and output keep their sizes when a result appears.
- Fail text names the Help button by its real label (the review found 'Tap Need Help' when the button says Help).

## Devices

Tablet 1024x768 is where the pop-up covers most. Check touch and narrow widths.

## Notes

Ryan's note: the old banner broke the layout, so the fix must not bring that back. Peer-help and thumbs-up toasts stack on the same area (groups 19, 22); worth placing them the same way.

## Resolution

Branch `feature/check-result-in-output-panel` (not merged). The check result now docks as a scrollable strip at the bottom of the output panel (new `src/shared/checkResultDock/`: `CheckResultSlot` in the Python/Turtle result pane and side output, HTML/Arcade preview, Scratch stage), absolutely positioned so nothing else is covered and the layout never shifts. It stays until dismissed or the next result. Scratch's Stage tab shows a dot while a result waits on the Blocks tab. Fail text takes the Help label from `HELP_BUTTON_LABEL`. Quizzes and collapsed output keep the old floating popup. Peer-help/thumbs-up toasts left where they are. Docs: docs/FEATURES.md, docs/agents/classroom-behaviours.md. No authoring change.

Ryan, 2026-10-17, after seeing it live: the docked strip "covers the variables panel. I think the bottom left was better." The dock was reverted on `fix/check-result-bottom-left`: the result is back to the floating bottom-left popup. The Help label fix (`HELP_BUTTON_LABEL`) stays.
