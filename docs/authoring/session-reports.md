# Session Reports

A field reference for the session report: what each field means, its units, when it is present,
and the date it was added. Use it to read or review exported report YAML, or to write tooling that
reads reports.

> **Keep this page current.** Any change to the output of `src/shared/lessonReport.js`,
> `src/badges/reportMetrics.js`, or an activity's `report.summaryFields` / `report.typeFields`
> must update this page and add a [CHANGELOG.md](CHANGELOG.md) entry in the same PR
> ([workflows.md](../agents/workflows.md#doc-hygiene)).

## Where reports come from

- **Built** when the teacher ends a live session (`handleEndSession` in
  `src/app/views/TeacherView.jsx` → `buildSessionReport` in `src/shared/lessonReport.js`), from the
  Realtime Database session (`sessions/{lessonId}`) and the teacher-sandbox archive, just before
  the live data is wiped.
- **Stored** as one Firestore document per session run:
  `lessons/{lessonId}/sessionReports/{sessionId}`. A class copy (a fork lesson) has its own
  lesson id and so its own reports; the source lesson's reports never include a fork's runs.
  Publishing (or republishing) a class copy, and deleting a lesson, deletes that lesson's reports
  and lesson feedback.
- **Exported** to YAML only from the web app: the report modal after **End Session**, or Teacher
  view → session menu → **Reports** → open a report, then **Export YAML** (`reportToYamlText`, via `TeacherReportModal.jsx`). There is no CLI command that reads or
  exports reports.
- **Never regenerated.** A report is a snapshot written once (plus the optional teacher feedback
  added straight after). Older reports permanently lack fields added after they were written: use
  the **Added** dates below, and treat a missing field as "not recorded", never as zero.
- **Anonymous.** Students are `Student 1`, `Student 2`, … (`studentLabel`), numbered in the order
  they first appear in the session data. Export and display relabel any old report that still
  carries names or anonymous ids (reports before 2026-07-16 stored `anonymousId` / `displayName`);
  a reference to someone not in `students[]` reads `Former student`.
- The **live report** shown in the Reports panel during a session is the same builder run on the
  in-progress session; it is not saved, and it leaves out `teacherSandbox` until the sandbox
  archive has loaded.
- **Trimmed to fit.** A report over 900 KiB (Firestore's document limit is 1 MiB) loses the
  students' teacher-sandbox code first, then the teacher's pushed sandbox code, and gains
  `sizeNote` (see [`teacherSandbox`](#teachersandbox)).

Information tasks (`type: information`) are never in a report. Every other task appears once in
`taskSummary[]` and once in each student's `tasks[]`, even when nobody attempted it.

### Conventions

- Times ending `At` are Unix epoch **milliseconds** (a number). Durations ending `Ms` are
  milliseconds.
- "Omitted when empty" means the key is left out entirely, not written as `0`, `[]` or `null`.
- **Added** is the first commit that wrote the field into the report (`git log -S` on
  `lessonReport.js` / `reportMetrics.js`). Fields from the first version are dated 2026-07-13.

## Top level

| Path | Meaning | Present | Added |
|---|---|---|---|
| `lessonId` | The lesson's id (a fork's own id for a class copy). | Always | 2026-07-13 |
| `lessonTitle` | The lesson title at session end. | Always (may be null) | 2026-07-13 |
| `sessionId` | The session's `startedAt` as a string; also the Firestore document id. | Always | 2026-07-13 |
| `startedAt` | When the teacher started the session (ms). | Always | 2026-07-13 |
| `endedAt` | When the session ended (ms). | Always | 2026-07-13 |
| `students[]` | One entry per student who took part ([Students](#students)). | Always | 2026-07-13 |
| `taskSummary[]` | One entry per reportable task, in lesson order ([Task summary](#tasksummary)). | Always | 2026-07-13 |
| `quizGroups[]` | First-try quiz results per quiz group ([quizGroups](#quizgroups)). | Omitted when the lesson has no quiz group | 2026-09-30 |
| `teacherSandbox` | The class's teacher-sandbox visits, flagged as a possible lesson gap ([teacherSandbox](#teachersandbox)). | Omitted when the class never went into the sandbox | 2026-09-30 |
| `badgeSummary` | Per-badge counts ([badgeSummary](#badgesummary)). | Omitted when no badge was suggested or awarded | 2026-09-30 |
| `shortcutSummary` | `{ <shortcutId>: <number of students who used it> }` for the Keyboard Wizard shortcuts. | Omitted when nobody used one | 2026-09-30 |
| `polls[]` | The teacher's live class polls, oldest first ([polls](#polls)). | Omitted when the teacher ran no poll | 2026-10-01 |
| `sizeNote` | Plain-text note saying sandbox code was left out to fit the 1 MiB limit. | Only on a trimmed report | 2026-09-30 |
| `teacherFeedback` | The teacher's end-of-session rating and notes ([Teacher feedback](#teacher-feedback)). | Omitted unless the teacher saved some | 2026-09-01 |

## Students

`students[]`, one per student. A student is anyone who appears anywhere in the session data:
the live roster, the attempt, override, carry-fallback or support-reveal logs, badges, badge
signals, or a teacher-sandbox snapshot.

| Path | Meaning | Present | Added |
|---|---|---|---|
| `students[].studentLabel` | `Student N`. | Always | 2026-07-16 |
| `students[].joinedAt` | When the student first joined (ms, the student's clock). Written once and never overwritten by a later name entry or reload. | Omitted when unknown (sessions before 2026-10-01, or a student the teacher removed) | 2026-10-01 |
| `students[].joinedAfterMs` | `joinedAt` minus the session's `startedAt`, clamped to 0 for a waiting-room join. Compares the student's clock with the teacher's, so allow for a little skew. | Omitted when `joinedAt` or `startedAt` is unknown | 2026-10-01 |
| `students[].joinedAtTaskId` | The class's current task when the student first joined. Untouched tasks before it mean "not present yet", not "skipped". | Omitted when `joinedAt` is unknown | 2026-10-01 |
| `students[].rejoins[]` | Each later return to the session, oldest first: `{ at (ms), taskId }`. Counts a repeated name entry and a page reload back into the session (a second tab counts too). At most the latest 20. | Omitted when none | 2026-10-01 |
| `students[].badges[]` | Badges the student still holds at session end: `badgeId`, `emoji`, `title`, `source` (`rule` = a suggestion the tutor accepted, `auto` = auto-awarded, `manual` = awarded by hand), `reason` (the reason text), `taskId` (null when not task-based), `awardedAt` (ms). Revoked badges are left out. | Omitted when none | 2026-09-30 |
| `students[].topicsOpened[]` | Topic Library opens: `topicId`, `title` (`Topic Library` for opening the library itself), `context` (`task`, `sandbox` teacher sandbox, `personal` personal sandbox), `taskId` (task context only), `source` (`student`, or `teacher` when the teacher opened it for them), `openedAt` (ms). One entry per topic per task/context (first open). | Omitted when none | 2026-09-30 |
| `students[].shortcutsUsed[]` | First use of each Keyboard Wizard shortcut: `shortcutId`, `label`, `context`, `taskId`, `firstUsedAt` (ms). | Omitted when none | 2026-09-30 |
| `students[].personalSandbox` | Personal sandbox activity: `timeMs` (time spent), `runs`, `errorRuns` (runs with a console error), `fixes` (an error-free run straight after an error run, with changed code). No code. | Omitted when no time and no runs | 2026-09-30 |
| `students[].teacherSandbox` | The same four counters for the teacher's session sandbox. | Omitted when no time and no runs | 2026-09-30 |
| `students[].tasks[]` | One entry per reportable task ([Student tasks](#student-tasks)). | Always | 2026-07-13 |

### Student tasks

`students[].tasks[]`. Fields marked *graded only* are left out on ungraded tasks (a confidence
rating, a poll, a short answer with no `check`, an unknown activity).

| Path | Meaning | Present | Added |
|---|---|---|---|
| `taskId`, `title` | The task. `title` falls back to `Task <id>`. | Always | 2026-07-13 |
| `taskType` | `code` (code tasks and Code Arrange), `quiz`, or `activity`. | Always | 2026-07-22 |
| `quizType` | `multiple_choice`, `match`, `fill_blank`, `short_answer`, `confidence`, `poll` (since 2026-10-01). | Quizzes only | 2026-07-22 |
| `activityType` | The activity id (`binary`, `keyboard`, `mouse`, …). | Activities only | 2026-09-28 |
| `completed` | Graded: passed, passed by a tutor's hand override, or auto-checked correct when the class moved on (`auto_passed`). Moving the class on past a graded code task the student never passed **no longer** makes it complete (quizzes and activities moved past still count as complete) (since 2026-10-01; see [Overrides](#overrides)). Ungraded: responded at all. | Always | 2026-07-13 (changed 2026-10-01) |
| `attempts` | Total submissions including identical resubmissions: Σ(1 + `retries`) over `distinctAttempts`. | Always | 2026-07-13 |
| `finalResult` | See [finalResult](#finalresult). | Always | 2026-07-13 (values changed 2026-07-22) |
| `timeOnTaskMs` | From when the teacher (last) moved the class onto the task to the passing attempt / override / correct auto-check, or, if not completed, to the latest attempt. Null when there's no start time or no attempt/override. | Always (may be null) | 2026-07-14 |
| `override` | `{ taskId, overriddenAt (ms), attemptNumber (attempts made before it), previousCheckState: failed \| unattempted, source?: teacher \| class_advance }`. Only when the student never passed. `source` is missing on records written before 2026-10-01. See [Overrides](#overrides). | Omitted when none | 2026-07-22 (`source` 2026-10-01) |
| `autoCheck` | The [auto-check on leave](#auto-check-on-leave): `{ result: passed \| failed \| not_run, suggestion (the hint a run would have shown, or null), submission (the work checked), checkedAt (ms) }`, the latest one. *Graded only.* | Omitted unless the student never passed and was auto-checked | 2026-10-01 |
| `teacherAssisted` | `true`: the passing attempt came after the teacher used **Edit answers** on this student's quiz or activity answer, or Code Arrange tiles, on this task (teacher code edits don't set it). | Omitted unless true | 2026-09-17 |
| `carryFallback` | Carry-through couldn't use the requested source task: `taskId`, `field` (the carry field), `requestedSourceTaskId`, `resolvedSourceTaskId` (what was used instead, or null), `skippedSourceTaskIds[]`, `fallbackAt` (ms), `files[]` (only when the fallback recorded files). | Omitted when none | 2026-07-22 |
| `supportReveals[]` | Each support reference opened: `taskId`, `stageIndex`, `stageLabel`, `source` (`student`, `teacher`, `teacher-auto`), `attemptNumber` (attempts made before it), `revealedAt` (ms). See [Support reveals](#support-reveals). | Omitted when none | 2026-07-22 |
| `pastes` | Large pastes into the editor: `{ count, chars }` (chars = total pasted). Pasting the student's own copied code doesn't count. | Omitted when none | 2026-09-29 |
| `itemProgress` | `{ correct, total }` items right in the latest submission. | `taskType: activity` only, when submitted | 2026-09-28 |
| `timeToFirstEditMs` | Time from the task opening on the student's device to their first real edit (timed on the device). *Graded only.* | Omitted when unknown | 2026-09-30 |
| `errorAttempts` | Attempts whose run hit a real console error. *Graded only.* | Omitted when 0 | 2026-09-30 |
| `uniqueFailedAttempts` | Different failed submissions (by content hash). *Graded only.* | Omitted when 0 | 2026-09-30 |
| `firstPassInClass` | `true`: this student made the class's first real pass on the task (see `firstRealPass`). *Graded only.* | Omitted unless true | 2026-09-30 |
| `distinctAttempts[]` | One per attempt-log entry, oldest first ([below](#distinctattempts)). | Always (may be empty) | 2026-07-13 |

#### distinctAttempts

| Path | Meaning |
|---|---|
| `distinctAttempts[].attemptNumber` | The entry's number as logged. Restarts at 1 if the student reloads mid-task, so don't treat it as a unique index. |
| `distinctAttempts[].passed` | `true` / `false`; `null` on ungraded tasks. |
| `distinctAttempts[].retries` | How many more times this exact submission was resubmitted straight after it (e.g. pressing Run again without changing the code). |
| `distinctAttempts[].suggestion` | The failure hint shown to the student, or null. |
| `distinctAttempts[].submission` | The submitted code or answer. Code is a string; object-shaped work (files, Scratch workspaces, activity state) is an object, or a JSON string in reports read back from Firestore. |

All five fields date from 2026-07-13.

**How attempts are logged** (`logAttempt` in `src/app/hooks/useSession.js`): attempts are logged
only on tasks with a `check` (code tasks without one log nothing), only during the lesson (not the
sandbox), and stop once the student has passed. If a submission is byte-for-byte the same as the
student's previous one, the existing entry's `retries` goes up instead of a new entry being
written. So:

- `distinctAttempts` = one per log entry, i.e. each *change* the student submitted;
- `attempts` = Σ(1 + `retries`), so every press of Run counts;
- a student who presses Run 70 times on unchanged code shows e.g. `attempts: 73`, 3 distinct
  attempts and 68 retries. That is a real pattern (repeated runs without editing), not a bug, and
  it inflates the task's `avgAttempts`. Use `distinctAttempts` length or `uniqueFailedAttempts`
  for "how many different things did they try".

Auto-check-on-leave records (`auto: 'leave'` in `attemptLog`) are **not** attempts: they never
appear in `distinctAttempts` and never count towards `attempts`, `retries`, `commonFailures`,
`errorAttempts`, `uniqueFailedAttempts` or `firstRealPass`. They only set `autoCheck` and
`finalResult`.

#### finalResult

| Value | Meaning |
|---|---|
| `passed` | At least one attempt passed. |
| `failed` | Attempted, never passed, no override. |
| `not_attempted` | No attempt logged (and no override). |
| `not_applicable` | Ungraded task the student responded to. |
| `overridden_failed` | Never passed, but an override was recorded after at least one failed attempt. |
| `overridden_unattempted` | Never passed, and an override was recorded with no attempt. |
| `auto_passed` | Never passed, but the [auto-check on leave](#auto-check-on-leave) found the work correct. `completed: true`. Shown as "Correct (auto-checked)". |
| `auto_failed` | Never passed, and the auto-check on leave found the work incorrect. Shown as "Incorrect (auto-checked)". |
| `auto_not_run` | Never passed, made no attempt, and the task needs a run the student never made. Shown as "Not run". |

Reports before 2026-07-22 used `not attempted` (with a space) and had no override or
`not_applicable` values. The `auto_*` values date from 2026-10-01.

**Precedence** (`resolveTaskOutcome` in `src/shared/lessonReport.js`), first match wins:

1. a real passing attempt → `passed`;
2. a tutor's hand override (`source: teacher`) → `overridden_*`, complete;
3. the latest auto-check on leave: correct → `auto_passed`; incorrect → `auto_failed`; not run
   with no real attempt → `auto_not_run` (not run after real failed attempts falls through, so the
   runs the student did make decide it);
4. a class-advance override → `overridden_*`, **not** complete on a graded task (still complete on
   a check-less code task; a record from before 2026-10-01, with no `source`, still counts as
   complete);
5. no attempt → `not_attempted`, else `failed`.

The auto-check outranks the class-advance override because the student's device writes it just
after the teacher's device wrote the override, whose `previousCheckState` could not see it.

## Overrides

An override records a student moved on without a passing attempt. It is recorded (`overrideLog`,
`buildOverrideRecord` in `useSession.js`) in two ways, told apart by `source`:

1. **A tutor passes the student by hand** (the student card's override; `source: teacher`). This
   counts as complete.
2. **Automatically when the teacher moves the class on** (`recordClassAdvanceOverrides`, called
   from `handleTaskChange` in `TeacherView.jsx`; `source: class_advance`): for every student on
   the roster who hasn't passed the task being left, an override is written. This applies to
   every graded task (code tasks, Code Arrange, graded quizzes and activities), not to
   information or ungraded tasks. Since 2026-10-01 it does **not** count as complete on a graded
   code task (quizzes and activities moved past still count as complete): the student's result comes from the [auto-check on leave](#auto-check-on-leave) when
   there is one, else stays `overridden_*` with `completed: false`.

`previousCheckState` is `failed` when the student had made attempts, `unattempted` otherwise.
So `overridden_failed` usually means "the class moved on while this student was still stuck",
not that a tutor intervened. An override is only written once per student per task, and is
ignored by the report when the student later passes.

A checked code task logs attempts, but a code task **without** a `check` logs none, so moving the
class on from it normally gives every student `overridden_unattempted` (and, as a check-less task
isn't graded, `completed: true`).

## Auto-check on leave

When the teacher moves a live class to another task, each student's device that has not passed
the graded task being left grades its current work **without running it** (`autoCheckOnLeave` in
`useStudentCodeState.js`, called by `useStudentPhase` before the task changes) and logs the verdict
as an `attemptLog` entry with `auto: 'leave'`, `autoResult` and `passed: false`. The student sees
nothing. Rules (`evaluateTaskWithoutRun` in `src/modules/checks.js`):

- only checks a run can't change are judged: `code` checks, Python `code_structure`, filesystem
  and desktop checks, `input_*` checks, electronics circuit checks, Scratch block checks
  (`block_used`, `blocks_in_order`, `block_count`, judged against the saved blocks);
- **incorrect** when any judged completion check fails, or a judged blocking feedback check
  matches (with the hint a run would have shown);
- otherwise **not run** when any check needs a run (`output*`, `code_no_error`, Python variable
  checks, Turtle checks, HTML element checks, Scratch sprite/variable/`block_run` checks) or the
  task has Python `tests`; no code is executed;
- otherwise **correct**.

So a task mixing static and run checks is "not run" unless a static check already fails. Not
auto-checked: information tasks, quizzes and activities (they are submitted explicitly; moved
past unanswered they show `overridden_unattempted` and still count as complete), check-less tasks, solo, the
presentation window, Builder preview, and a student with no work for the task (nothing loaded or
saved, e.g. an untouched Scratch task). A student offline when the class moves on logs nothing.
If the class comes back to the task and moves on again, the latest auto-check wins.

## Support reveals

`supportReveals[]` / `supportRevealCount` record a student seeing help on a task, once per stage
per task (`recordSupportStageReveal`):

- a **support stage** (`codeStages` with `role: support`) opened by the student (`source:
  student`) or the teacher (`teacher`);
- the teacher's per-student auto-reveal (`teacher-auto`), including the complete stage when the
  teacher picks "solution";
- the teacher's live code shown as a reference: `stageIndex: teacherLive`,
  `stageLabel: Teacher's live code`, `source: teacher`.

None of these require a `check`, so **a reveal can attach to a checkless task** (for example a
Complete Example task, or any task while the teacher's live code is shown). There is no
`revealCount` field: count `supportReveals[]`, or use `taskSummary[].supportRevealCount`.

## taskSummary

`taskSummary[]`, one per reportable task, in lesson order. A graded task and an ungraded task have
different shapes.

### Graded tasks

| Path | Meaning | Present | Added |
|---|---|---|---|
| `taskId`, `title` | The task. | Always | 2026-07-13 |
| `priority` | `core` or `optional` (the task's `priority`, default `core`). | Always | 2026-07-22 |
| `taskType`, `quizType`, `activityType` | As in [Student tasks](#student-tasks). | As there | 2026-07-22 / 2026-09-28 |
| `totalStudents` | Students in the report. | Always | 2026-07-13 |
| `completedCount` | Students with `completed: true`: real passes, tutor hand overrides and `auto_passed`. Class-advance overrides on a graded task are **not** counted since 2026-10-01 (they were before). | Always | 2026-07-13 (changed 2026-10-01) |
| `completionRate` | `completedCount / totalStudents`, 2 dp (0–1). | Always | 2026-07-13 |
| `avgAttempts` | Σ`attempts` ÷ students whose `finalResult` isn't `not_attempted`, 2 dp. Counts `retries`, and overridden students with no attempts count in the divisor. | Always | 2026-07-13 |
| `avgTimeOnTaskMs` | Mean `timeOnTaskMs` over students who have one, rounded; null if none. | Always | 2026-07-14 |
| `commonFailures[]` | Up to 5 `{ suggestion, count }`, most common first: failed distinct attempts per hint (retries not counted). | Always (may be empty) | 2026-07-13 |
| `teacherAssistedCount` | Students with `teacherAssisted`. | Always | 2026-09-17 |
| `overrideCount` | `overriddenFailedCount + overriddenUnattemptedCount`. | Always | 2026-07-22 |
| `overriddenFailedCount`, `overriddenUnattemptedCount` | Students with that `finalResult` (an auto-checked student has an `auto_*` result instead). | Always | 2026-07-22 |
| `autoPassedCount`, `autoFailedCount`, `autoNotRunCount` | Students with `finalResult` `auto_passed` / `auto_failed` / `auto_not_run`. | Omitted when all 0 | 2026-10-01 |
| `carryFallbackCount` | Students with a `carryFallback`. | Always | 2026-07-22 |
| `carryFallbacks[]` | Fallbacks grouped by `field`, `requestedSourceTaskId`, `resolvedSourceTaskId`, `skippedSourceTaskIds`, each with a `count`, most common first. | Always (may be empty) | 2026-07-22 |
| `supportRevealCount` | Total `supportReveals` across students. | Always | 2026-07-22 |
| `supportRevealStudentCount` | Students with at least one reveal. | Always | 2026-07-22 |
| `supportRevealSources` | `{ teacher, student }` counts (always present, may be 0), plus `teacher-auto` when any. | Always | 2026-07-22 |
| `pasteCount` | Total large pastes. | Omitted when none | 2026-09-29 |
| `pastedStudentCount` | Students who pasted. | Omitted when none | 2026-09-29 |
| `timeToFirstEdit` | `{ medianMs, minMs, maxMs, studentCount }` over students' `timeToFirstEditMs`. | Omitted when none | 2026-09-30 |
| `errorStudentCount` | Students with `errorAttempts`. | Omitted when 0 | 2026-09-30 |
| `topicOpens` | `{ student, teacher }` Topic Library opens on this task (task context). | Omitted when 0 | 2026-09-30 |
| `firstRealPass` | `{ studentLabel, afterMs }`: the class's first *real* pass (not teacher-assisted, overridden, after the complete code was shown or revealed, or after a paste) and how long after the task opened (null if unknown). | Omitted when nobody really passed | 2026-09-30 |
| `teacherRating` | The teacher's live rating of this task ([Teacher feedback](#per-task-teacherrating)). | Omitted when unrated | 2026-09-09 |
| Activity summary fields | Added by the task's activity ([below](#activity-summary-fields)). | Per activity | — |

### Ungraded tasks

A confidence rating, a poll, a short answer with no `check`, or an unknown activity. These report who
responded instead of completion: there is no `completedCount`, `completionRate`, `avgAttempts` or
`teacherAssistedCount`.

| Path | Meaning | Added |
|---|---|---|
| `taskId`, `title`, `priority`, `taskType`, `quizType` / `activityType`, `totalStudents` | As for graded tasks. | — |
| `respondedCount` | Students who responded at least once. | 2026-07-22 |
| `ratingDistribution` | Confidence only: `{ 1: n, 2: n, 3: n, 4: n, 5: n }` from each student's latest rating. | 2026-07-22 |
| `optionDistribution[]` | Poll only: `{ id, text, count }` per option, in the task's option order, counting each student's latest choice (students can change their choice). | 2026-10-01 |
| `avgTimeOnTaskMs` | As for graded tasks. | 2026-07-14 |
| `commonFailures` | Always `[]`. | 2026-07-22 |
| `overrideCount`, `overriddenFailedCount`, `overriddenUnattemptedCount` | Always `0`. | 2026-07-22 |
| Carry-fallback, support-reveal, paste, `topicOpens`, `teacherRating` fields | As for graded tasks (`timeToFirstEdit`, `errorStudentCount` and `firstRealPass` never appear). | As above |

### Activity summary fields

Each activity's definition can add fields through `report.summaryFields(task, perStudent)`
(`src/activities/<id>/definition.js`; quizzes in `src/activities/quiz/quizActivity.js`). Today:

| Field | From | Shape | Added |
|---|---|---|---|
| `pairFailures[]` | Match quiz | `{ pairId, prompt, expected, count, values: [{ value, count }] }`, most-missed first; counts wrong pairings across every distinct attempt. | 2026-07-22 |
| `blankFailures[]` | Fill-in-the-blanks quiz | `{ blankId, expected, count, values: [{ value, count }] }`, as above. | 2026-07-22 |
| `ratingDistribution` | Confidence quiz | See [Ungraded tasks](#ungraded-tasks). | 2026-07-22 |
| `optionDistribution[]` | Poll quiz | See [Ungraded tasks](#ungraded-tasks). | 2026-10-01 |
| `avgItemProgress` | Every `taskType: activity` (Binary, Keyboard, Mouse, …) | Mean of `correct / total` over students with `itemProgress`, 2 dp (0–1). Added by the report itself, not `summaryFields`. Omitted when nobody submitted. | 2026-09-28 |

A new activity that adds summary fields documents them here (and in its own authoring page).

## quizGroups

A quiz group is a lesson group (`group:`) with at least `badgeOptions.quizMasterMinQuizzes`
(default 3) graded quizzes ([badges.md](badges.md#quiz-groups)). Added 2026-09-30.

| Path | Meaning |
|---|---|
| `quizGroups[].groupId`, `title` | The group. |
| `quizGroups[].quizTaskIds[]` | Its graded quizzes. |
| `quizGroups[].students[]` | Students who attempted at least one of them: `studentLabel`, `right` (quizzes right on the first try, as a real pass), `total`, `firstTryPercent` (0–100). |
| `quizGroups[].medianFirstTryPercent` | Median of the students' `firstTryPercent`, or null. |

## polls

Every live class poll the teacher ran from the **📊 Poll** button in the top bar (not the
`quizType: poll` task, which reports in `taskSummary`), oldest first. Built from the session's
`polls` and each student's `pollResponses` (`src/shared/classPolls.js`). Added 2026-10-01.

| Path | Meaning |
|---|---|
| `polls[].pollId` | The poll's RTDB key. |
| `polls[].question` | The question the teacher asked. |
| `polls[].options[]` | `{ index, text, count }` per option, in the order asked. |
| `polls[].status` | `closed`, or `open` if the session ended (or the in-progress report was built) while it was still open. |
| `polls[].showResults` | `true` if the teacher showed the results to the class. |
| `polls[].createdAt`, `closedAt` | When it was launched and closed (ms); `closedAt` is null while open. |
| `polls[].respondedCount` | Students who answered. |
| `polls[].responses[]` | `{ studentLabel, choice (option index), choiceText, answeredAt }`, each student's final answer (students can change it while the poll is open). |
| `polls[].notResponded[]` | Labels of students in the class who didn't answer. A student who first joined after the poll closed isn't listed. |

## teacherSandbox

Every time the teacher took the class into the session sandbox, reported as a *possible lesson
gap* (something the lesson didn't cover). Added 2026-09-30.

| Path | Meaning |
|---|---|
| `teacherSandbox.possibleLessonGap` | Always `true`. |
| `teacherSandbox.visits[]` | Oldest first: `visitId`, `enteredAt`, `exitedAt` (ms; the session end if the session ended in the sandbox), `durationMs`, `previousTaskId` / `previousTaskTitle` (the task the class left), `explainer` (the teacher's sandbox explainer). |
| `teacherSandbox.visits[].pushes[]` | What the teacher pushed, oldest first: `{ at, code }`, `{ at, files }` or `{ at, explainer }`, with `truncated: true` when cut at 20 KB. |
| `teacherSandbox.visits[].studentSnapshots[]` | Each student's last sandbox work: `{ studentLabel, at, code \| files, truncated? }`. |
| `teacherSandbox.studentSnapshotsDropped` | `true` when trimmed for size: every `studentSnapshots` is `[]`. |
| `teacherSandbox.pushesDropped` | `true` when trimmed further: pushes keep only `at`. |

Each student's own sandbox counters are on `students[].teacherSandbox`.

## badgeSummary

`{ <badgeId>: { suggested, awarded, autoAwarded, manual, dismissed, revoked } }`, added
2026-09-30. `suggested` counts rule-made suggestions (accepted, dismissed, auto-awarded, or still
pending at session end); `awarded` counts badges still held, split into `autoAwarded` and
`manual`. See [badges.md](badges.md).

## Teacher feedback

There are two kinds of teacher feedback inside a report, both with the same shape:
`{ rating, whatWorkedWell, whatDidntWork, submittedAt }`, where `rating` is a whole number 1–5
(or null when only notes were given), the notes are trimmed strings (`""` when blank), and
`submittedAt` is ms.

### Lesson-level `teacherFeedback`

- **One per session run**, on that run's report document. A lesson taught five times has up to
  five, one per report; a class copy's runs are on the fork lesson's own reports.
- Given in the **report modal that opens after the teacher ends the session** (**End Session** →
  report → rating and "What worked well" / "What didn't work, or was broken" → Save Feedback).
  Saving rewrites the report document with the block attached.
- **Absent** when the teacher left it blank or closed the modal, and always absent when the
  teacher ended with **End & Go to Home** (the modal never opens). It can't be added later: past
  reports open read-only.
- Added 2026-09-01.

### Per-task `teacherRating`

- `taskSummary[].teacherRating`, at most one per task per session.
- Recorded **during** the session from the teacher's task rating panel (`setTaskRating`), into
  the Realtime Database at `sessions/{lessonId}/taskRatingLog/{taskId}` (last save wins; clearing
  every field removes it), and copied into the report when it's built.
- **Omitted** for tasks the teacher didn't rate. Information tasks aren't in reports, so a rating
  on one is not reported.
- Added 2026-09-09.

### How this differs from CLI feedback

The [feedback CLI](feedback-cli.md) reads a **different** store: the free-text notes teachers
leave with the **Feedback** button during a lesson (`lessons/{lessonId}/feedback`, about the whole
lesson or one task), plus platform feedback. Those items have `text`, `teacherEmail` and an
`archived` flag, are not tied to a session run, and can be added and archived from the CLI.
Report feedback (`teacherFeedback`, `teacherRating`) is rated, lives only inside the report, is
never archived, and is only visible through the exported report YAML.

## Not in reports

- Information tasks.
- Student names, anonymous ids or devices.
- Attempts on tasks without a `check`, sandbox runs' code, or attempts after the student passed.
- Anything after the session ended (solo study is never reported).
