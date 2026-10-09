# Pinned "Keep showing live code" reference can't be turned off

- **Status:** shipped
- **Kind:** bug
- **Requested by:** Ryan (approved by Ryan), 2026-10-09
- **Lessons blocked:** none yet

## Need

Once the tutor pins the live code reference ("📌 Keep showing live code"), it seems it can't be turned off. The code agrees, in three places:

1. **The student can't close it.** `docs/agents/classroom-behaviours.md` calls the panel "dismissible", but `SupportStagePanel` has no close prop or button (rendered from `LessonTaskContent.jsx`).
2. **A class-wide pin can only be removed from the Live tab.** That tab appears only while Presentation is showing the displayed task (`TeacherEditorPanel.jsx`). Once Presentation closes or moves on there's no way to unpin it. `teacherLiveReferenceVisibleToAll` stays set, so the panel comes back the next time Presentation returns. Changing task doesn't clear it either.
3. **The per-student toggle ignores the class pin.** The StudentModal Support menu only reads and toggles `students/{id}/teacherLiveReferenceVisible`. With the class pin on, a tutor can't turn it off for one student, though the header badge shows it's on.

## Checks wanted

- The tutor can turn off a class pin from somewhere that is always visible (e.g. the session toolbar or Support menu), whether or not Presentation is showing.
- The per-student toggle reflects the class pin, and a tutor can hide the panel for one student while it stays on for everyone else.
- The student can collapse or close the panel, as the docs describe. Decide whether it reopens when the tutor's live code changes, or stays closed until the tutor pins it again.
- Tests cover all three paths. Either the docs or the behaviour changes so the two agree.

## Devices

The close and collapse control must be a visible button and must work on touch.

## Notes

Part of the 2026-10-09 principle: **tutors see what students are doing at all times (submitted or not) and can do something to assist.** Sibling requests filed the same day:
- confidence 1–10
- badge suggestion task names
- vocab and emoji badges
- tutor highlights a wrong arrange tile
- closable live-code reference
- live short-answer drafts

It's tagged here because the tutor has to stay in control of what students see.

## Resolution

Branch `fix/live-code-reference-unpin` (2026-10-09). Docs: `docs/agents/classroom-behaviours.md` "Teacher-Live-Code Reference", `docs/agents/runtime-model.md`.

**Root cause of the tutor toggle not turning it off.** The `StudentModal` "📌 Keep showing live code" toggle read and wrote only `students/{id}/teacherLiveReferenceVisible`, while the student's client shows the reference when *either* that or `teacherLiveReferenceVisibleToAll` is set (`getTeacherLivePin`). With a class pin on, the modal's toggle showed "Keep showing live code" (off), and was disabled unless Presentation was on that task. Clicking it wrote a redundant per-student pin, and clicking again wrote null. Both left the class pin in force, so the panel never went away. The only control that cleared the class pin was on the Live tab, which disappears once Presentation is not showing the displayed task. The class pin also survived `endSession` (only `createSession` cleared it).

**Decisions (Ryan, 2026-10-09).**
- Students cannot close or collapse the reference. The docs that called it "dismissible" now say "read-only", and a test asserts the panel has no buttons. The Devices note about a touch close button no longer applies.
- The session toolbar shows **📌 Live code on · Turn off** whenever a class pin is set, so it can be turned off whether or not Presentation is showing the task.
- `students/{id}/teacherLiveReferenceVisible` is now three-way: a pin time (on), `false` (hidden for this student while the class pin is on), or null (follow the class pin). `StudentModal` shows the effective state, class pin included. It can hide the panel for one student and offers "📌 Show class live code again" to undo that. Pinning or unpinning for the class clears every per-student `false`.
- The class pin is **not** cleared on task change, because a pin means "every task" (the one-off reveal is the per-task mode). It is now cleared by `endSession`.
- No database rules change: teachers already write the students node and nothing validates this field.
