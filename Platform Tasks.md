# Platform Tasks

Implementation plan for the LaunchPad platform work originally captured in `Platform Asks.md`, updated after the implementation-requirements interview on 22 July 2026.

This document is intended to be worked through by implementation agents. It records decisions, phase order, expected data shapes, affected surfaces, acceptance criteria, and test expectations.

## Current Product Decisions

These decisions are now settled and should not be re-opened during implementation unless a blocker is discovered.

1. Session report `finalResult` values are:
   - `passed`
   - `failed`
   - `not_attempted`
   - `not_applicable`
   - `overridden_failed`
   - `overridden_unattempted`
2. Confidence rating changes count as distinct attempts.
3. Open short-answer tasks with no check complete on submit and report as `not_applicable`.
4. Advancing the whole class should record an override for every student who has not passed the current task.
5. Override actor identity does not need to be stored.
6. Carry-through walks authored carry chains only. If the chain ends with no saved state, fall back to the authored starter content.
7. `priority` applies to every task type and defaults to `core`.
8. Task variants are code-task-only for v1.
9. Student-initiated support reveal should be visible to the teacher as an assisted/reference-opened marker.
10. PA4 ordering quizzes remain blocked until PA3 report fixes are complete and the authoring trial has produced evidence.

## Implementation Principles

- Keep the app frontend-only. Do not add a backend server or API.
- Preserve login-less student operations.
- Keep student identity and saved work semantics unchanged.
- Do not write student code to Firebase per keystroke unless `activeStudentView` matches.
- Use existing shared modules for task flattening, checks, carry-through, reports, Markdown, file keys, Pyodide, iframe, and localStorage.
- Keep CLI validation, Builder validation, authoring docs, runtime docs, and reports in sync when lesson schema or session shape changes.
- Preserve existing destructive teacher stage push behaviour, but make any new non-destructive reveal path explicit.
- Prefer small PRs. Each phase below is designed to be independently reviewable.

## Phase 1: PA3 Report Correctness

Status: Complete on branch `codex/platform-phase-1-reports` on 22 July 2026.

Completed implementation:

- Reports now include all non-information tasks, including check-less quiz interactions.
- Per-student report entries and task summaries include `taskType`; quiz entries include `quizType`.
- Fill-blank and match attempts store detailed submissions keyed by blank/pair id.
- Confidence attempts store numeric ratings and summarize rating distribution.
- Open short-answer without a check reports as response-only, with `finalResult: not_applicable`.
- Confidence and open short-answer summaries use `respondedCount` instead of pass/fail completion metrics.
- Fill-blank and match summaries include missed-blank/missed-pair breakdowns.
- Runtime report docs and focused tests were updated.

Verification:

- `npm test -- src/shared/__tests__/lessonReport.test.js src/app/__tests__/studentQuizContent.test.js src/app/components/__tests__/TeacherReportModal.test.jsx`
- `npm run docs:check`
- `npm test`

Goal: Session reports must include every completed or attempted non-information task, not only tasks with explicit checks.

### Scope

Implement:

- T1: Fix report task-inclusion rule.
- T2: Add `taskType` and `quizType` to report entries.
- T3: Record submissions for check-less task types.
- T4: Fix summary aggregates for no-pass/fail tasks.

Prepared during Phase 1 and completed during Phase 2:

- T23 override recording. Phase 1 defined override-aware report values; Phase 2 added the session write routes.

### Primary Surfaces

- `src/shared/lessonReport.js`
- `src/shared/__tests__/lessonReport.test.js`
- `src/app/hooks/useStudentCodeState.js`
- `src/app/hooks/useSession.js`
- `src/app/components/QuizTask.jsx`
- `src/app/components/quiz/*.jsx`
- `src/app/components/TeacherReportModal.jsx`
- `docs/agents/runtime-model.md`
- `docs/FEATURES.md` if the report shape description changes there

### Inclusion Rule

Information tasks are excluded.

Every other task should be included in each student's report row when either:

- the task has any attempt-log entries for the student,
- the student currently has an answer recorded for the active task in the live session,
- the task is a reportable no-check task and the report needs a per-student not-attempted row for summary consistency.

For Phase 1, report summaries may include all non-information tasks so a teacher can see zero-response no-check tasks. Per-student rows should include the same task set to keep report shape predictable.

### Report Entry Type Fields

Every per-student task entry and every `taskSummary` entry must include:

```yaml
taskType: code | quiz | draft
```

Quiz entries must also include:

```yaml
quizType: multiple_choice | match | fill_blank | short_answer | confidence
```

Code tasks are reported explicitly as `taskType: code` even though code tasks omit `taskType` in lesson JSON today.

Information tasks remain excluded, so `taskType: information` should not appear in Phase 1 reports.

### Submission Shapes

Multiple choice should preserve existing answer id behaviour.

Fill-blank submissions should be object-shaped and keyed by blank id:

```yaml
submission:
  blankId:
    value: "student answer"
    expected: "correct answer"
    correct: true
```

Match submissions should be object-shaped and keyed by pair id:

```yaml
submission:
  pairId:
    prompt: "Prompt text"
    value: "student matched answer"
    expected: "Correct answer"
    correct: true
```

Confidence submissions should be the numeric 1 to 5 rating.

Open short-answer submissions should be the submitted text.

### Final Result Rules

Use these rules in `buildSessionReport`:

- No entries: `not_attempted`.
- Any passing attempt on a checked task: `passed`.
- Attempted checked task with no pass: `failed`.
- Confidence task with any response: `not_applicable`.
- Open short-answer with no check and any response: `not_applicable`.
- Future override metadata should map to `overridden_failed` or `overridden_unattempted` without claiming a pass.

`completed` remains a separate boolean:

- Checked task: true only when a check passes or a future override says the student was moved on.
- Confidence: true when a rating is submitted.
- Open short-answer with no check: true when text is submitted.
- Fill-blank and match: true when the implicit quiz result passes.

### Summary Rules

For checked tasks, existing summary behaviour should remain compatible:

- `completedCount`
- `completionRate`
- `avgAttempts`
- `avgTimeOnTaskMs`
- `commonFailures`

For confidence tasks:

```yaml
taskId: 6
title: How Confident Do You Feel?
taskType: quiz
quizType: confidence
totalStudents: 3
respondedCount: 3
ratingDistribution:
  1: 0
  2: 0
  3: 1
  4: 1
  5: 1
```

Confidence tasks should not affect lesson-level pass/fail completion figures.

For open short-answer without a check:

- `respondedCount`
- `avgTimeOnTaskMs`
- no pass/fail completion rate
- no average attempts unless a deliberate product decision later asks for it

For fill-blank:

```yaml
blankFailures:
  - blankId: "name"
    expected: "player"
    count: 2
    values:
      - value: "player_name"
        count: 1
      - value: "name"
        count: 1
```

For match:

```yaml
pairFailures:
  - pairId: "print"
    prompt: "Shows text"
    expected: "print()"
    count: 2
    values:
      - value: "input()"
        count: 2
```

### Phase 1 Acceptance Criteria

- A lesson containing `fill_blank`, `match`, `confidence`, and open `short_answer` tasks produces report entries for all of them.
- Information tasks remain absent.
- Every report task entry names `taskType`.
- Every quiz report task entry names `quizType`.
- Confidence and open short-answer entries use `finalResult: not_applicable` when answered.
- Fill-blank and match submissions identify the specific blank or pair result, not only pass/fail.
- Confidence summary shows a 1 to 5 rating distribution.
- Fill-blank summary identifies most-missed blanks.
- Existing code-task and multiple-choice reporting remains compatible except for the added `taskType` and `quizType` fields.
- Unit tests cover the new report shapes.

## Phase 2: Override Recording

Status: Complete on branch `codex/platform-phase-2-overrides` on 22 July 2026.

Completed implementation:

- Added teacher/admin-only `overrideLog/{anonymousId}/{taskId}` records in Realtime Database.
- Manual pass overrides write an override record when the student has no real passing attempt.
- Whole-class task advance writes override records for each student who has not passed the task being left.
- Override records include task id, server timestamp, total attempt count at the moment of override, and previous check state (`failed` or `unattempted`).
- Reports map overrides to `overridden_failed` or `overridden_unattempted`, keep `completed: true`, and do not mark failed `distinctAttempts` as passed.
- Task summaries include `overrideCount`, `overriddenFailedCount`, and `overriddenUnattemptedCount`.
- Teacher report UI shows override counts and per-student override detail.
- Runtime docs, RTDB rules, and focused tests were updated.

Verification:

- `npm test -- src/app/hooks/__tests__/useSession.test.js src/shared/__tests__/lessonReport.test.js src/app/components/__tests__/TeacherReportModal.test.jsx`
- `npm run docs:check`
- `npm test`

Goal: Reports must distinguish tasks students genuinely passed from tasks teachers moved them past.

### Scope

Implement T23 in full.

### Primary Surfaces

- `src/app/hooks/useSession.js`
- `src/app/views/TeacherView.jsx`
- `src/app/components/StudentModal.jsx`
- `src/app/components/student-modal/OverrideDropdown.jsx`
- `src/shared/lessonReport.js`
- `database.rules.json`
- Runtime docs and report tests

### Required Recording

Record per student per task:

- override happened,
- task id,
- timestamp,
- attempt number at the moment of override,
- previous check state: attempted and failed, or never attempted.

Do not store teacher identity.

Manual pass override and whole-class advance are both reportable override routes.

### Result Mapping

- Override after one or more failed attempts: `finalResult: overridden_failed`.
- Override before any attempt: `finalResult: overridden_unattempted`.
- `completed: true` because the student moved on.
- `passed` must remain false in `distinctAttempts` unless a real check passed.

### Summary Additions

Each task summary should include:

```yaml
overrideCount: 2
overriddenFailedCount: 1
overriddenUnattemptedCount: 1
```

## Phase 3: PA5 Carry-Through

Goal: Skipped carry source tasks must not cause students to lose their previous saved work.

### Scope

Implement T24.

### Primary Surfaces

- `src/app/studentTaskContent.js`
- `src/app/hooks/useStudentCodeState.js`
- `src/modules/*/index.js`
- `src/app/studentStorage.js`
- `src/shared/lessonReport.js`
- `docs/agents/classroom-behaviours.md`

### Behaviour

When a task carries from another task and the carried-from task has no saved state for that student:

1. Walk the authored carry chain.
2. Use the first earlier source task in that chain with saved state.
3. Treat saved empty content as real saved state.
4. If the chain ends without saved state, use the current task starter content.

Apply this across:

- Python `carryCodeFrom`
- HTML `carryCodeFrom`
- Scratch `carryBlocksFrom`
- Filesystem `carryFsFrom`
- Electronics `carryCircuitFrom`

Record report metadata when a fallback walks past the immediate carry source.

## Phase 4: PA2 Task Priority

Goal: Authors can mark tasks as core or optional, and teachers can see that in the room.

### Scope

Implement T6 through T11.

### Data Shape

```yaml
priority: core | optional
```

Default is `core` when omitted.

Priority applies to every task type.

### Primary Surfaces

- `cli/validate.mjs`
- `cli/yaml-converter.mjs`
- `src/builder/lessonUtils.js`
- `src/builder/components/TaskList.jsx`
- `src/builder/components/task-editor/TaskOptionsSection.jsx`
- `src/app/components/TaskNavigator.jsx`
- `src/shared/lessonReport.js`
- authoring docs

### Acceptance Criteria

- CLI and Builder validation accept only `core` and `optional`.
- YAML round-trip preserves explicit priority and preserves absence.
- Builder can set priority per task.
- Builder task list shows total split, such as `22 core, 8 optional`.
- Teacher live task list marks optional tasks clearly.
- Student views do not expose priority.
- Reports include priority in `taskSummary`.

## Phase 5: Stage Role Foundation

Goal: Make stage purpose machine-readable before adding reveal and variant behaviour.

### Scope

Implement T15.

### Data Shape

```yaml
codeStages:
  - role: support | core | extension | solution
    label: With a variable already created
```

Default omitted `role` to `support`.

### Behaviour

No runtime behaviour changes in this phase except validation and display labels where useful.

Existing destructive stage push remains available.

## Phase 6: Revealable Support Stages

Goal: Let a student see help that moves them forward without replacing their editor content.

### Scope

Replace the small `copyCode`-only approach with support-stage reveal.

### Behaviour

- Authors can mark a support stage as revealable.
- Teacher can reveal a support stage for one student.
- Student can reveal it themselves.
- Revealing does not change editor contents.
- Teacher view marks the student as assisted/reference-opened.
- Reports record reveal source and attempt number.

### Non-Goals

- No automatic reveal after N attempts.
- Do not remove destructive stage push.
- Do not turn support reveal into complete solution reveal by default.

## Phase 7: Code-Task Variants

Goal: Let teachers place individual students on support or extension variants with their own starter state and check while the class remains on the same task number.

### Scope

Implement T16 through T20 for code tasks only.

### Proposed Data Shape

```yaml
variants:
  - role: support
    label: With the variable already created
    starterCode: |
      name = "Ada"
    check:
      type: output_contains
      value: Ada
  - role: extension
    label: Combine two stored values
    starterCode: |
      first = "Ada"
      last = "Lovelace"
    check:
      type: output_contains
      value: Ada Lovelace
```

Equivalent starter/check fields should exist for HTML, Scratch, Filesystem, and Electronics according to each module's state model.

### Behaviour

- Variant assignment is per student.
- Student remains on the same task id.
- Student sees the variant starter only when assignment rules say it should replace or initialize their state.
- Student is graded against the variant check.
- Reports record active variant per student and summarize variant distribution.
- Carry-through from a variant carries the state the student actually saved.

## Phase 8: Documentation Cleanup

Goal: Keep authoring references accurate while implementation proceeds.

### Scope

- T22: Add `copyCode` to Python and HTML field-reference tables.
- Update report shape docs after PA3 and override work.
- Update carry-through docs after PA5.
- Update priority docs after PA2.
- Update stage and variant docs after PA1.

## Suggested PR Split

1. PA3 report correctness.
2. Override recording.
3. Carry-through walk-back.
4. Task priority.
5. Stage roles.
6. Revealable support stages.
7. Code-task variants.
8. Docs-only cleanup if any small reference defects remain.

## Verification Expectations

For each implementation PR:

- Run focused unit/component tests for changed areas.
- Run `npm test`.
- Run `npm run docs:check` when docs, source files, or documented behaviours change.
- Update `docs/CODEBASE_MAP.md` and `docs/TESTING.md` when adding, removing, or significantly reshaping source/test targets.
