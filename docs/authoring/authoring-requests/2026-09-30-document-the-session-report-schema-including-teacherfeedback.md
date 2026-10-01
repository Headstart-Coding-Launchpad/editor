# Document the session report schema, including teacherFeedback

- **Status:** planned
- **Kind:** docs
- **Requested by:** Lesson Gen Agent (approved by Ryan), 2026-09-30
- **Lessons blocked:** none yet

## Need

Session report YAML gained a lesson-level teacherFeedback block (rating 1-5, whatWorkedWell, whatDidntWork, submittedAt), but neither platform-docs nor CHANGELOG.md records it, and it's unclear whether it is per session or per class copy.

Closest existing capability (from `lessons capabilities`): platform-docs/feedback-cli.md (no report schema).

Current workaround and why it falls short: Read raw report YAML to infer the shape; a tutor note sat unread until Ryan asked about it.

## Notes

Lessons that hit this gap:

- python-4b-1 (Python Level 4B, Lesson 1 row)
- python-1-1 task 9 (Level 1 Lesson 1 — Printing Messages): retries vs distinctAttempts undocumented: one student logged attempts 73 / distinctAttempts 3 / retries 68, inflating avgAttempts to 10
- python-1-3 task 12 (Level 1 Lesson 3 — Input): checkless Complete Example recorded revealCount 1; report schema doesn't say whether a reveal can attach to a checkless task

- python-1-11 (Level 1 Lesson 11 — Choose Your Own Adventure Part 1), 2026-10-01 — scope widened at Ryan's request: the report reviewer's tooling (`list-session-reports.mjs`) had never surfaced `quizGroups`, `badges`/`badgeSummary`, `taskSummary[].priority`, `errorAttempts`/`errorStudentCount`, `retries`, `topicsOpened`, `shortcutsUsed`, sandbox activity, `teacherSandbox` or per-task `teacherRating`, because no authoring-facing doc lists what a report can contain. The script was brought up to date by reading `src/shared/lessonReport.js` and `src/badges/reportMetrics.js` directly.

Migrated from Lesson Info/Missing Information.md (entry dated 2026-09-03).

### Wanted scope (added 2026-10-01)

A field reference page in `docs/authoring/` (e.g. `session-reports.md`, linked from `docs/README.md` and AGENTS.md's task table) covering every field the report YAML can contain, not just `teacherFeedback`:

- Each field's path (`students[].tasks[].distinctAttempts[].retries`, `taskSummary[].blankFailures`, …), meaning, units, and when it is present or omitted (many fields are only written when non-empty).
- Which fields are derived from which others (e.g. `completionRate` includes overrides; `avgAttempts` counts retries; confidence/short-answer tasks are excluded and use `respondedCount`).
- Activity-specific summary fields (`blankFailures`, `pairFailures`, `avgItemProgress`) and where new activities add theirs (`report.summaryFields`).
- The date each field was added, since reports are never regenerated and old ones permanently lack later fields.
- A doc-hygiene rule: a change to `lessonReport.js` / `reportMetrics.js` output updates this page and adds a `docs/authoring/CHANGELOG.md` entry, so downstream report tooling learns about new fields.

## Resolution

Branch `feature/authoring-docs-2026-10`: new field reference [session-reports.md](../session-reports.md) covering every report field (path, meaning, units, presence, date added), the attempts/retries/`avgAttempts` derivation, overrides (including the automatic class-advance overrides behind `overridden_failed`), support reveals (they can attach to checkless tasks; there is no `revealCount`), activity summary fields, and both kinds of teacher feedback: lesson-level `teacherFeedback` (one per session run, on that run's report; class copies have their own) and per-task `teacherRating`, cross-linked with [feedback-cli.md](../feedback-cli.md). A doc-hygiene rule in `docs/agents/workflows.md` now requires report output changes to update the page and add a CHANGELOG entry.
