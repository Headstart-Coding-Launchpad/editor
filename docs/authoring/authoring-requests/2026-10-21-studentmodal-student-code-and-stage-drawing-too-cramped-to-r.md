# StudentModal: student code and Stage drawing too cramped to read

- **Status:** shipped
- **Kind:** module
- **Requested by:** Ryan (approved by Ryan), 2026-10-21
- **Lessons blocked:** none yet

## Need

Ryan, after teaching the LG-P6 pilots on 2026-10-20 (Python L1 Lessons 8 and 10): 'I struggle to see code while they're running stage - It's all a bit too cramped.' Clarified 2026-10-21: this is the tutor's StudentModal, not the student's own editor. On Stage tasks the modal shows the student's code alongside their Run's drawing (shipped with P6-2), and the code is hard to read and squeezed. Visual lessons rely on reading code and picture together (the picture is the model), so the tutor needs both readable to help a student.

Closest existing capability (from `lessons capabilities`): StudentModal's Stage view from the P6-2 change (CHANGELOG: 'The tutor sees each Run's drawing on the student card and in StudentModal'). It shows the code and drawing together but gives no way to enlarge the code, resize the split or scale the drawing.

Current workaround and why it falls short: Tutor walks to the student's screen or asks them to toggle tabs. Fails the LG-P6 aim of the tutor reading code and picture together from the dashboard during a running class.

## Notes

Supersedes #84, which wrongly described the student's own Stage task layout. Possible routes: a larger modal or full-screen option, a draggable code/drawing split, a smaller drawing with click-to-enlarge, or a larger code font in the modal.

## Resolution

Shipped 2026-10-22: live on `main` (5221fe93, Ryan's OK in session). Not yet clicked through in a real browser (HSC Hub #93).

Built on branch `fix/student-modal-code-stage-split` (2026-10-22), merged 2026-10-22. In
StudentModal the code and the Stage drawing sit side by side when the modal is at least 640 px
wide, so the code keeps its full height and the drawing is a large square; narrower, they stack
as before. A **Bigger picture** toggle gives the drawing more room either way. Code font is
unchanged (15 px). Docs: python.md Tutor view, stage.md section 9.
