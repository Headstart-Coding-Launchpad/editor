# Lesson number field (lessonNumber) that sorts lessons within a level

- **Status:** shipped
- **Kind:** tooling
- **Requested by:** Ryan (approved by Ryan), 2026-10-05
- **Lessons blocked:** none yet

## Need

Since 2026-10-02 every new lesson, Solo Challenge, Solo Project and new version of a live lesson gets a random 10-character id, so the id no longer tells anyone which lesson it is, and LaunchPad lists lessons alphabetically by title. Ryan can't see which lesson in a level is Lesson 1, 2, 3 and so on, or find the one being taught this week, without opening each one. Lessons need an optional lessonNumber on the lesson envelope that sets their position within their level, shown next to the title and used as the sort order everywhere LaunchPad lists lessons. Titles are not an option: they describe content, not position, and change when a lesson is revised.

Closest existing capability (from `lessons capabilities`): lesson-schema-yaml.md Lesson Envelope: level/levelId/levelRef say which level a lesson belongs to and companionOf links a Solo Challenge to its parent, but nothing records a lesson's position within its level. lessons list returns id, title, levelId and draft only, sorted by title.

Current workaround and why it falls short: Look each id up in the authoring side's Lesson Tracker (pipeline-ui) before opening it in LaunchPad. That works for the authoring agents but not inside LaunchPad itself: Ryan and tutors picking or checking a lesson in the Admin list or lesson picker see an unordered, title-sorted list with nothing showing where a lesson sits in the 12-week level.

## Example task

    # Main lesson
    id: k3f9x2qp7a
    title: Boolean Flags
    levelId: python-level-1
    lessonNumber: 9
    
    # Its Solo Challenge — no number needed, sorts straight after its parent via companionOf
    id: m8d2r6tw1c
    title: Boolean Flags — Solo Challenge
    soloOnly: true
    companionOf: k3f9x2qp7a
    
    # Half-term Solo Project after Lesson 6 — same number as the lesson it follows
    id: z5h1q9vb4e
    title: Solo Project 1
    soloOnly: true
    levelId: python-level-1
    lessonNumber: 6
    

## Checks wanted

- lessonNumber is optional; when set it must be a positive integer, and lessons validate rejects anything else (0, negative, decimal, string).
- Builder and lessons upsert keep lessonNumber across saves, like intent and task order. A new version of a lesson upserted with a lessonNumber keeps it.
- Every list of lessons (the Admin lesson list, the student/teacher lesson picker, and `lessons list`) sorts within a level by lessonNumber ascending. Lessons with no lessonNumber come after numbered ones, by title, as they do now.
- A lesson with companionOf (a Solo Challenge) sorts directly after its parent and needs no lessonNumber of its own.
- When two lessons in a level share a number, the one without soloOnly comes first, then its companion, then any other soloOnly lesson (a Solo Project), then by title.
- The number is shown next to the title in those lists (e.g. "9 · Boolean Flags", Solo Challenge indented or tagged beneath it).
- `lessons list` (JSON and YAML) includes lessonNumber and companionOf for every lesson, so the authoring side can match ids to lessons without fetching each one.
- `lessons get` returns lessonNumber; lesson-schema-yaml.md's Lesson Envelope table documents it.


## Devices

No device-specific behaviour: a sort order and a small label in existing lists.

## Notes

Authoring side, once shipped: create-lesson-skeleton, create-solo-project-skeleton and the rebuild route will set lessonNumber from the Tracker row when they create a Draft or a new version, and a one-off backfill will set it on every existing lesson from its Tracker row's Launchpad id. Archived old versions (levelId lessons-archived) may keep their number; it is harmless there.

## Resolution

Branch `feature/lesson-number`: optional envelope `lessonNumber` (positive integer, validated), kept across Builder saves and `lessons upsert` when omitted (explicit `null` clears it). Shared order `src/shared/lessonOrder.js` used by the Admin lesson list, Builder lesson picker and `lessons list` (which now includes `lessonNumber`, `soloOnly`, `companionOf`); Solo Challenges sort after their parent. Shown as "9 · Title" in those lists, editable in the Builder meta panel, and as "Lesson 9" in the classroom header. Docs: [lesson-schema-yaml.md](../lesson-schema-yaml.md), [lesson-schema.md](../lesson-schema.md).
