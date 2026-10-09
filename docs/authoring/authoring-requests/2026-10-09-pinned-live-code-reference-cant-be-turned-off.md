# Pinned "Keep showing live code" reference can't be turned off

- **Status:** open
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

<!-- Filled in by whoever builds it: PR link, activity/module id, docs link. -->
