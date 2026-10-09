# Session report: timeline of the class's current task, including information slides

- **Status:** shipped
- **Kind:** tooling
- **Requested by:** Ryan (approved by Ryan), 2026-10-09
- **Lessons blocked:** none yet

## Need

Lessons are now planned to 40 minutes inside a :00-:45 slot, split into Opening and recap, Learning objectives, Lesson content and Closing, each with a target range (Lesson Writing Guide.md's Pacing). Reports only record time on code and quiz tasks, which across 42 taught sessions averaged 20.5 of a 43-minute session; the other ~22.5 minutes (information slides, tutor explanation, discussion, changeovers) is invisible. In mdoawus915 (Python Level 2B Lesson 6, 2026-10-06) 21 minutes were on recorded tasks and 25.4 were not. So the report review can't say which section ran long, where the class was at :45, or whether a skipped task was skipped by the tutor or never reached. The report should record when the session's current task changed, for every task including information tasks.

Closest existing capability (from `lessons capabilities`): Reports already carry joinedAtTaskId (request #30), so the session knows its current task at any moment, but no report field records when that task changed. Per-task avgTimeOnTaskMs covers code and quiz tasks only and measures student working time, not the class's time on the task; information tasks don't appear in reports at all.

Current workaround and why it falls short: list-session-reports.mjs now prints on-task minutes per section and the session's unrecorded remainder, and infers skipped core tasks from tasks with no student record. That fails Lesson Writing Guide.md's Pacing ranges for the slide-heavy sections (Opening and recap, Learning objectives, Closing) - their time sits in the unrecorded remainder - and it can't place the class at :45 or tell a tutor skip from a late arrival's untouched tasks.

## Example task

    taskTimeline:                  # the session's current task over time, every task including information slides
      - taskId: 1
        startedAt: 1791284540870   # when the class (session) moved onto this task
      - taskId: 2
        startedAt: 1791284601200
      - taskId: 9                  # a jump records the tutor skipping tasks 3-8
        startedAt: 1791284755000
    

## Notes

Shape is a sketch. Ryan asked for this 2026-10-08 alongside the 40-minute budget (Guides v26). list-session-reports.mjs will read it once present: section times from the timeline instead of task sums, and the task the class was on at :45.

## Resolution

Branch `feature/session-report-timeline-typing`. The teacher's device appends
`{ taskId, startedAt }` to `sessions/{lessonId}/taskTimeline` in the same update as each change of
the session's current task once the session has started (`startSession` for the first task,
`setTaskId`, and `exitSandbox` when it restores a different task), information tasks included; no
student writes. Each report gains a top-level `taskTimeline: [{ taskId, startedAt }]`, oldest
first, with consecutive repeats collapsed (a return to an earlier task adds an entry), omitted for
sessions without one (before 2026-10-09). The shape is the one sketched above.

- The first entry is the task at Start session (`startedAt` = the report's `startedAt`); the class
  was on each task until the next entry, or `endedAt` for the last.
- Teacher-sandbox time is not its own entry: it sits inside the task the class left
  (`teacherSandbox.visits[]` has `enteredAt` / `exitedAt`). Go Live on a composed lesson's sandbox
  module, which silently switches task, adds no entry.
- Docs: [session-reports.md](../session-reports.md) "taskTimeline";
  [CHANGELOG.md](../CHANGELOG.md) 2026-10-09.
