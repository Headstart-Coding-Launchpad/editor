# Tutor highlights a wrong tile in arrange and drag-and-drop tasks

- **Status:** open
- **Kind:** activity mode
- **Requested by:** Ryan (approved by Ryan), 2026-10-09
- **Lessons blocked:** none yet

## Need

A tutor can already watch a student's `code_arrange` board live in StudentModal and can rewrite the answer with "Edit answers". They can't point at the problem and leave the student to fix it:
- Code highlights are switched off for these tasks (`StudentModal.jsx`).
- The Focus (pane highlight) menu is hidden for activity and quiz tasks.
- Ink only covers explainer content in the Presentation window.

Ryan wants the tutor to tap a tile on the student's board and have that tile highlighted on the student's screen as "look again", without moving it or giving the answer away. This should cover drag-and-drop quiz types (match, fill-the-blanks drag) as well as `code_arrange`.

## Checks wanted

- In StudentModal, the tutor taps a placed tile (or blank) to toggle a highlight. The student sees that tile outlined, with an optional short tutor note, straight away.
- The highlight clears when the student moves that tile, when the tutor taps it again, or when the task changes.
- More than one tile can be highlighted. The tutor can clear them all at once.
- The student card shows that a highlight is active.
- Nothing about completion or attempts changes. A highlight is support, not grading. Session reports record that the tutor highlighted a tile (task, slot or tile id).

## Devices

The tutor taps without hovering, so this works from a tablet. On the student side the outline must be visible on touch screens and must not block dragging the tile.

## Notes

This is different from `2026-10-09-tile-level-feedback-for-code-arrange-flag-known-wrong-tile-p.md`, where authors pre-write hints for known-wrong placements and they show automatically on Run. This request is tutor-driven and live. Both could share the student-side "this tile is wrong" outline.

Part of the 2026-10-09 principle: **tutors see what students are doing at all times (submitted or not) and can do something to assist.** Sibling requests filed the same day:
- confidence 1–10
- badge suggestion task names
- vocab and emoji badges
- tutor highlights a wrong arrange tile
- closable live-code reference
- live short-answer drafts

## Resolution

<!-- Filled in by whoever builds it: PR link, activity/module id, docs link. -->
