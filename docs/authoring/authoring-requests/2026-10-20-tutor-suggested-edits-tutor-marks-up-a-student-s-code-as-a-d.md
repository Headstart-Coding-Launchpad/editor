# Tutor suggested edits: tutor marks up a student's code as a diff, the student makes the changes

- **Status:** open
- **Kind:** module
- **Requested by:** Ryan (approved by Ryan), 2026-10-20
- **Lessons blocked:** none yet

## Need

Some students don't know where code goes or what to change, and fixing it for them means they learn nothing. The tutor needs to edit a student's code in a suggestion mode that leaves the student's code unchanged. The student then sees a diff in their editor: lines to remove (red/struck through) and lines to add (green, at the exact position), and makes the changes themselves. The marks clear as the student's code comes to match, and the student or tutor can dismiss them.

Closest existing capability (from `lessons capabilities`): teacherEditor (lessons capabilities: surface code) lets the tutor edit the student's code, but the edit changes the student's code directly, so the student does no work. Python stage targets have a 'diff view', but only for drawings against an authored target, not code a tutor writes live. #> line hints are authored ahead of time and can't point at one student's code.

Current workaround and why it falls short: The tutor explains verbally or edits the code for the student. Verbal help doesn't scale across a class and doesn't show the exact line. A direct edit skips the student's own work, which the Independent Coder and copy-accuracy signals depend on.

## Checks wanted

Outcome: a tutor suggestion never changes the student's saved code or attempts. The student sees each add/remove at the right line. Marks clear once the student's code matches the suggestion. Session report records that a suggestion was sent on that task (so review-lesson-reports can see where tutors had to step in).

## Devices

Must work on touch screens, Macs and Chromebooks. Tutor side is the existing tutor view, so desktop first.

## Notes

Related to #45 (anchoring line hints where new code goes in carried tasks). Both target 'student doesn't know where to put it'. Lesson-side, Code Writing Guide v44 now leaves a blank-line gap wherever new code will go.

## Resolution

<!-- Filled in by whoever builds it: PR link, activity/module id, docs link. -->
