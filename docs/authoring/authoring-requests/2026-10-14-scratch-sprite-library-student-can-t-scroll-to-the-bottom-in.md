# Scratch sprite library: student can't scroll to the bottom in Make It Your Own

- **Status:** shipped
- **Kind:** bug
- **Requested by:** Ryan (approved by Ryan), 2026-10-14
- **Lessons blocked:** none yet

## Need

A student repeatedly reports she can't see all the Scratch sprites to add during Make It Your Own: she can't scroll to the bottom of the sprite library. Tutor wonders if it's the viewport. Tutor feedback 2026-10-13.

Closest existing capability (from `lessons capabilities`): Scratch Make It Your Own opens the full sprite library (scratch.md; Scratch Lesson Guide's Make It Your Own). Expected: every library sprite reachable by scrolling. Observed: the list can't be scrolled to its end for this student (likely a fixed-height container clipped by a small or zoomed viewport).

Current workaround and why it falls short: The tutor adds the sprite for her. It fails Make It Your Own's point, which is free choice from the whole library.

## Devices

Unknown device and zoom; worth checking small laptop screens, Chromebooks and browser zoom above 100%.

## Notes

From tutor feedback relayed by Ryan, 2026-10-13. One student, recurring; lesson not named.

## Resolution

Shipped on `fix/scratch-eager-checks-library-backdrop` (package W1-b, 2026-10-14). The student Add sprite and Add backdrop pickers are now portalled to the page (`src/modules/scratch/AddPickerPopover.jsx`) and positioned from the Add tile by `pickerPosition.js`: below the tile when there's room, else above, with the height capped to the space on screen so the list scrolls to its end. They follow scroll and resize, and close on an outside click or Escape. Docs: scratch.md sprite-library note; CHANGELOG 2026-10-14.
