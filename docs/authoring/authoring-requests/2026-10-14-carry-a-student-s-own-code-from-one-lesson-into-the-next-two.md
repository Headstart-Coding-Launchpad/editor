# Carry a student's own code from one lesson into the next (two-lesson projects)

- **Status:** shipped
- **Kind:** module
- **Requested by:** Ryan (approved by Ryan), 2026-10-14
- **Lessons blocked:** none yet

## Need

Two-lesson final projects (Lessons 11-12) build one program across both lessons. Lesson 12 should start from each student's own Lesson 11 program, so their own names, values and extensions carry on. Tutor, Python Level 1 Lesson 12 (python-1-12), 2026-10-07: "would be good if what they did carried on between lessons if it was there". carryCodeFrom only carries code between tasks inside one lesson.

Closest existing capability (from `lessons capabilities`): carryCodeFrom / carryBlocksFrom (platform-docs/lesson-schema-yaml.md, carry fields): carries a student's code from an earlier task in the same lesson only; nothing reads a student's saved code from another lesson.

Current workaround and why it falls short: Lesson 12's first build task starts from the Build Reference's Stage 12 code (the reference's end of Lesson 11). This teaches every objective, but each student's own Lesson 11 variations are lost and the program they open is not the one they wrote, which the tutor flagged as confusing.

## Notes

Raised at Ryan's request in the 2026-10-09 open-notes triage (Guide Feedback entry 'Students' own code doesn't carry between project lessons'). A fallback to the starter when the student has no saved Lesson 11 code would be needed, like the existing carry fallback.

## Resolution

Shipped 2026-10-14 on `feature/carry-from-lesson` (package W3-a of `docs/architecture/requests-2026-10-14-plan.md`).

- New task fields `carryCodeFromLesson` (Python, Turtle, HTML) and `carryBlocksFromLesson` (Scratch): `{ lesson: <stock lesson id>, task: <task id> }`. For Python Level 1 Lesson 12: `carryCodeFromLesson: { lesson: python-1-11, task: <the Lesson 11 build task id> }`, keeping the Build Reference's Stage 12 code as `starterCode` for the fallback.
- Tutor-mediated through the class roster: once the tutor matches a student, the tutor's screen hands them their saved Lesson 11 work. Unmatched students wait (with a "Use the starter" override for the tutor); nothing saved, "No class", solo, presentation and preview use the starter, logged in `carryFallbackLog`.
- Docs: [AUTHORING_GUIDE.md → Two-lesson projects](../AUTHORING_GUIDE.md#two-lesson-projects-carry-from-an-earlier-lesson), [lesson-schema.md](../lesson-schema.md), [validation-errors.md](../validation-errors.md), [session-reports.md](../session-reports.md) (`crossLessonCarry`), CHANGELOG 2026-10-14.
