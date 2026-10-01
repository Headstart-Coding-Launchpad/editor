# code_arrange attempts recorded with an empty submission, then overridden_failed

- **Status:** shipped
- **Kind:** bug
- **Requested by:** Lesson Gen Agent (approved by Ryan), 2026-09-30
- **Lessons blocked:** none yet

## Need

Session reports show code_arrange attempts whose submission is an empty string, followed by overridden_failed and only the generic hint. The tutor reported the arrange check 'didn't work'. Authors can't tell whether the check ran against a blank state (a check-evaluation bug) or the report just doesn't capture the assembled tiles.

Closest existing capability (from `lessons capabilities`): code_arrange (platform-docs/lesson-schema.md Code Arrange Task Fields) and the session report; neither says what an arrange submission records.

Current workaround and why it falls short: None from the lesson side: the arrange checks pass their own complete code, yet students' real assemblies are failed or unrecorded, so the Fill in the Blanks objective can't be verified or reviewed.

## Notes

Lessons that hit this gap:

- python-1-3 task 29 (Level 1 Lesson 3 — Input): Tasks 29 and 16: empty submissions for 1 of 1 and 5 of 8 students across two sessions
- python-1-5 task 6 (Level 1 Lesson 5 — If - Branching code): Two students' only attempt was an empty submission, then overridden_failed (3rd session)

Migrated from Lesson Info/Missing Information.md (entries dated 2026-09-10 and 2026-09-29).

## Resolution

Branch `fix/code-arrange-empty-submission` (activity `code_arrange`). A platform bug, not a check
bug: Run executes (and the attempt log records) the shared python/html code slot, never the tiles,
and the slot could be reset to the empty starter while the board stayed complete — a live task load
restoring the starter after the board had pushed its program, a late identity reloading the task,
or a tutor's **Start again** (which reset the code but not the tiles). The empty program then ran,
failed the check and showed the generic hint.

What shipped:

- The board re-pushes its assembled program whenever the tiles are complete and the code slot
  holds anything else (not during a run or in the personal sandbox).
- Run assembles the program from the tiles first if the slot has drifted, so a complete board
  never runs or logs an empty submission.
- A tutor's **Start again** clears the tiles; **Complete** loads the authored solution tiles.

The `overridden_failed` entries are expected behaviour and unchanged: an override with no passing
attempt after a failed one, written by a tutor's manual pass or automatically when the class
advances past the task. Docs: [lesson-schema.md — Code Arrange Task Fields](../lesson-schema.md#code-arrange-task-fields)
(what an arrange attempt records), [session-reports.md](../session-reports.md),
[CHANGELOG](../CHANGELOG.md#2026-10-01).
