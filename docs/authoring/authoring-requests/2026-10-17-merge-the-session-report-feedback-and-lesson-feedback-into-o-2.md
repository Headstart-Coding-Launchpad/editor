# Merge the session report feedback and lesson feedback into one step after class (task rating stays in the lesson)

- **Status:** open
- **Kind:** tooling
- **Requested by:** Ryan (approved by Ryan), 2026-10-17
- **Lessons blocked:** none yet

## Need

Ryan wants the session report's teacher feedback and lesson feedback merged into one step after class (HSC Audit, Interview - LaunchPad.md theme 1: "Report, lesson feedback and task rating overlap; Ryan uses all three because they feed the agents. Consolidate."). Ryan's change, 2026-10-17: task rating is NOT part of this. It stays where it is, during the lesson.

Today there are two places for lesson-level comments:
- The report modal after End Session: `teacherFeedback` { rating 1-5, whatWorkedWell, whatDidntWork, submittedAt } on that run's report (session-reports.md, Teacher feedback). Absent when the tutor picks End & Go to Home, and can't be added later.
- The Feedback button during a lesson: free text in lessons/{lessonId}/feedback, for the whole lesson or one task (feedback-cli.md).

What Lesson Gen's tools read, which must not be lost:
- `teacherFeedback.rating`, `.whatWorkedWell`, `.whatDidntWork` on each report, same shape and location: read by scripts/list-session-reports.mjs, scripts/lesson-trends.mjs (Tutor column), the review-lesson-reports skill (writes Guide Feedback.md from it) and review-level. LG-P6's pilot measures use "teacherFeedback rating and notes" as the Tutor bar.
- `taskSummary[].teacherRating` (per-task rating): read by list-session-reports.mjs. Unchanged by this request.
- The Feedback-button store (lessons/{id}/feedback) is not read by any Lesson Gen skill or script today, so it can fold into the after-class step.

Want: one after-class step that always appears (including after End & Go to Home, or reachable from the report afterwards), holding the rating, the two notes, and an optional per-task note that replaces the Feedback button's task-level text.

Closest existing capability (from `lessons capabilities`): The report modal's teacherFeedback (session-reports.md, Teacher feedback) and the Feedback button (feedback-cli.md). Nothing is missing; there are two overlapping steps.

Current workaround and why it falls short: Ryan fills in both because they feed the agents. It costs tutor time every session, and teacherFeedback is lost whenever End & Go to Home is used.

## Checks wanted

- After any way of ending a session, the tutor reaches one feedback step, and saving it writes `teacherFeedback` { rating, whatWorkedWell, whatDidntWork, submittedAt } on that run's report in today's shape.
- The per-task rating panel during the lesson works exactly as now, and `taskSummary[].teacherRating` is unchanged.
- Existing reports and existing lessons/{id}/feedback items still read as before (export, feedback CLI).
- A task-level note given in the new step is stored somewhere the exported report YAML or the feedback CLI can read, and session-reports.md / feedback-cli.md say where.


## Devices

Tutor desktop and tablet.

## Notes

Ryan, 2026-10-17: "I don't want task rating to move to the end of the class." Keep the during-lesson task rating panel as it is.

## Resolution

Branch `feature/after-class-feedback-step` (not merged). One after-class step (`AfterClassFeedbackForm`) now appears after End Session (in the report), after End & Go to Home (`AfterClassFeedbackModal`, with Skip) and later from any saved report (Add / Edit feedback, in the tutor Reports panel and Admin > Lessons). It merges `teacherFeedback` onto the run's report in today's shape. Per-task notes go to `lessons/{lessonId}/feedback` with a new `reportId`; the CLI prints it. The in-lesson Feedback button is removed from the live header. Task rating and `taskSummary[].teacherRating` untouched. No Firestore rules change. Docs: session-reports.md, feedback-cli.md, FEATURES.md, CHANGELOG 2026-10-17.
