# Show it: the tutor puts 2-3 students' builds on the big screen

- **Status:** planned
- **Kind:** module
- **Requested by:** Ryan (approved by Ryan), 2026-10-23
- **Lessons blocked:** none yet

## Need

Every Mouse & Keyboard and AI Level 1 lesson has a 3-minute Show it after the build: the tutor picks two or three students' builds (their station, their AI) and shows them side by side on the big screen, names hidden, so the class sees what others made. Code lessons would use it too, after the Milestone. Nothing does this today for activities, and code tasks only have the student-side Shared work gallery.

Closest existing capability (from `lessons capabilities`): The tutor's live student view (studentMirror, per module) shows one student's work at a time to the tutor, not a chosen 2-3 side by side for the class. allowSharing's Shared work gallery is code tasks only and is browsed by students, not presented by the tutor. Quiz showResponses: teacher_picks does tutor-picked answers, but only for quiz text.

Current workaround and why it falls short: The tutor screen-shares the live student view and clicks through students one by one. It shows one at a time with names visible, costs the 3 minutes in clicking, and doesn't work for activities that don't mirror (it fails the Show it step of every non-code lesson).

## Fun moment

Wow: their own station or AI appears on the big screen beside two classmates'. Dial: the tutor picks whose, a different few each week so everyone gets a turn. Theirs: it's their build, shown to the class (names hidden, so nobody is put on the spot). First used: Mouse & Keyboard Level 1 Lesson 1 (Power Up), then every non-code lesson's Show it. Play: students see what others chose and get ideas for their own.

## Example task

    - type: activity
      activityType: station
      showIt: true        # tutor can pick builds to present after the round
    # or, lesson-wide: the tutor's toolbar gets 'Show it' on any task with student work

## Checks wanted

None: Show it is tutor-led and marks nothing. Optional: the session report notes which tasks were shown (no student names).

## Devices

Presented from the tutor's laptop to the projector or a shared screen. Students' devices need do nothing. Works for activities (Station, Classifier, Next-Word) and code tasks (Stage, Turtle).

## Notes

Proposed courses that need this (see `Lesson Info/Courses/Proposed Courses/Checklists/` for whether each needs it at launch):

- Mouse and Keyboard (guides/Non-Code Lesson Format.md, The shape: Show it (3 min, every lesson); Mouse and Keyboard Skills.md §5 Lesson shape 'Show (3 min)'): Every non-code lesson ends its build with Show it; AI Level 1 uses it too (Lesson 12: the race of classmates' AIs)

Ryan, 2026-10-23: 'we don't have a show it feature in launchpad that's great - might be a platform request.' Simplest version that works first (Ryan's design brief): pick up to 3 students, show their current build side by side, names hidden, one button to stop. Phase it after Station Phase 1 if needed.

## Resolution

Built on branch `feature/show-it` (handoff #173, not pushed). Platform feature, no lesson field: the
tutor's class menu > 📺 Show it picks up to 3 student cards; `sessions/{lessonId}/showIt` drives a
`ShowItPanel` on the presentation window and every student screen (Build 1/2/3, names hidden).
Works for activities and code tasks (Python + Stage/output, Turtle, HTML, Scratch). Docs:
`docs/agents/classroom-behaviours.md` ("Show it"), `docs/FEATURES.md`, `docs/authoring/CHANGELOG.md`.
The session report does not note shown tasks (a stopped Show it leaves no log). Needs a
database rules deploy (`showIt`) and a browser check.
