# Tutor view of side quests: what each task offers and how each student is getting on

- **Status:** shipped
- **Kind:** module
- **Requested by:** Ryan (approved by Ryan), 2026-10-14
- **Lessons blocked:** none yet

## Need

A tutor teaching live can't find a task's side quests, see which students are on them, or see how they're doing. Tutor feedback 2026-10-13: 'I can't see sidequests in LaunchPad when teaching - How do I find them? How do I see if students are on them? How do I see how they're getting on?'

Closest existing capability (from `lessons capabilities`): sideQuests (AUTHORING_GUIDE.md Side-quests; CHANGELOG 2026-10-09): the student card shows '🗺️ on side-quest n/m' and the session report has sideQuests[] and sideQuestStudentCount/DoneCount. Lacks: a tutor-side list of the current task's side quests (title, kind, explainer), a class count of who is on or done with each, and a way to open a student's side-quest code from their card or StudentModal.

Current workaround and why it falls short: The tutor reads '🗺️ on side-quest n/m' on each card and asks students to show their screen. This fails the side-quest goal (fast finishers doing worthwhile work while the class waits): the tutor can't check or help that work, and can't tell a student who is stuck on a side quest from one who is idle.

## Notes

From tutor feedback relayed by Ryan, 2026-10-13.

## Resolution

Shipped on branch `feature/side-quest-tutor-view` (package W1-d of
`docs/architecture/requests-2026-10-14-plan.md`). No new lesson fields.

- **Find them:** a 🗺️ Side-quests panel under the task in the teacher view lists the current
  task's side-quests (title, kind, explainer, starter code).
- **Who is on them:** each side-quest shows On it now / Done / Probably stuck counts. Probably
  stuck = on it and 2 error runs in a row, or no Run for 5 minutes. A count lists the students.
- **How they're getting on:** clicking a student, or the 🗺️ chip on their card, opens their
  StudentModal on a read-only Side-quest view (status, code, output/drawing/preview), with a
  Main task / Side-quest switch.
- Side-quest code is synced to `students/{id}/sideQuestCode` on every Run, and per keystroke
  only while the tutor watches that student (Ryan approved, 2026-10-14).
- Docs: [AUTHORING_GUIDE.md](../AUTHORING_GUIDE.md#side-quests), CHANGELOG 2026-10-14.
