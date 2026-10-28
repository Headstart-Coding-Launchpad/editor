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
- **Exported** to YAML from the web app or the CLI. CLI: `node cli/cli.mjs lessons reports list <lessonId> [--since <ISO>]` (newest first: `startedAt`, `endedAt`, `studentCount`) and `lessons reports get <lessonId> <startedAt> --yaml` (the same anonymised YAML as the web export). Web app: the report modal after **End Session**, or Teacher
  view → session menu → **Reports** → open a report, then **Export YAML** (`reportToYamlText`, via `TeacherReportModal.jsx`). `sessions share-links` reads only the share links
  ([Share links](#share-links)).
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

Information tasks (`type: information`) are never in `taskSummary[]` or `tasks[]`; they appear only
in [`taskTimeline`](#tasktimeline). Every other task appears once in `taskSummary[]` and once in
each student's `tasks[]`, even when nobody attempted it.

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
| `taskTimeline[]` | When the class moved onto each task, oldest first, information tasks included ([taskTimeline](#tasktimeline)). | Omitted when not recorded (sessions before 2026-10-09) | 2026-10-09 |
| `quizGroups[]` | First-try quiz results per quiz group ([quizGroups](#quizgroups)). | Omitted when the lesson has no quiz group | 2026-09-30 |
| `teacherSandbox` | The class's teacher-sandbox visits, flagged as a possible lesson gap ([teacherSandbox](#teachersandbox)). | Omitted when the class never went into the sandbox | 2026-09-30 |
| `badgeSummary` | Per-badge counts ([badgeSummary](#badgesummary)). | Omitted when no badge was suggested or awarded | 2026-09-30 |
| `shortcutSummary` | `{ <shortcutId>: <number of students who used it> }` for the Keyboard Wizard shortcuts. | Omitted when nobody used one | 2026-09-30 |
| `polls[]` | The teacher's live class polls, oldest first ([polls](#polls)). | Omitted when the teacher ran no poll | 2026-10-01 |
| `peerHelp[]` | Every peer help request: who helped whom (as student labels) and everything sent ([peerHelp](#peerhelp)). | Omitted when nobody asked for peer help | 2026-10-02 |
| `shareLinks[]` | Share links for parents made at End Session ([Share links](#share-links)). | Omitted when no student had code work to share (and on reports before 2026-10-21) | 2026-10-21 |
| `sizeNote` | Plain-text note saying sandbox code was left out to fit the 1 MiB limit. | Only on a trimmed report | 2026-09-30 |
| `teacherFeedback` | The teacher's end-of-session rating and notes ([Teacher feedback](#teacher-feedback)). | Omitted unless the teacher saved some | 2026-09-01 |

## Students

`students[]`, one per student. A student is anyone who appears anywhere in the session data:
the live roster, the attempt, override, carry-fallback or support-reveal logs, badges, badge
signals, or a teacher-sandbox snapshot.

| Path | Meaning | Present | Added |
|---|---|---|---|
| `students[].studentLabel` | `Student N`. | Always | 2026-07-16 |
| `students[].studentKey` | A stable anonymous key (`s_…`, a one-way hash of the device id): the same child on the same device gets the same key in every session, so links and results can be matched across sessions without names. A child on a new device or with a cleared browser gets a new key. | Always (reports from 2026-10-21) | 2026-10-21 |
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
| `ratingScale` | The scale the confidence ratings in `distinctAttempts` were given on: `10`. A confidence entry without it is from before 2026-10-09 and was rated 1–5. | Confidence quizzes only | 2026-10-09 |
| `completed` | Graded: passed, passed by a tutor's hand override, or auto-checked correct when the class moved on (`auto_passed`). Moving the class on past a graded code task the student never passed **no longer** makes it complete (quizzes and activities moved past still count as complete, and that includes Code Arrange, which is an activity) (since 2026-10-01; see [Overrides](#overrides)). Ungraded: responded at all. | Always | 2026-07-13 (changed 2026-10-01) |
| `attempts` | Total submissions including identical resubmissions: Σ(1 + `retries`) over `distinctAttempts`. A failed [live scrub](python.md#live-scrubbing-scrub) release (`source: scrub`, not passed) is not counted: see `scrubChecks`. | Always | 2026-07-13 (scrub releases left out 2026-10-22) |
| `finalResult` | See [finalResult](#finalresult). | Always | 2026-07-13 (values changed 2026-07-22) |
| `timeOnTaskMs` | From when the teacher (last) moved the class onto the task to the passing attempt / override / correct auto-check, or, if not completed, to the latest attempt. Null when there's no start time or no attempt/override. | Always (may be null) | 2026-07-14 |
| `override` | `{ taskId, overriddenAt (ms), attemptNumber (attempts made before it), previousCheckState: failed \| unattempted, source?: teacher \| class_advance }`. Only when the student never passed. `source` is missing on records written before 2026-10-01. See [Overrides](#overrides). | Omitted when none | 2026-07-22 (`source` 2026-10-01) |
| `autoCheck` | The [auto-check on leave](#auto-check-on-leave): `{ result: passed \| failed \| not_run, suggestion (the hint a run would have shown, or null), submission (the work checked), checkedAt (ms) }`, the latest one. *Graded only.* | Omitted unless the student never passed and was auto-checked | 2026-10-01 |
| `teacherAssisted` | `true`: the passing attempt came after the teacher used **Edit answers** on this student's quiz or activity answer, or Code Arrange tiles, on this task (teacher code edits don't set it). | Omitted unless true | 2026-09-17 |
| `carryFallback` | Carry-through couldn't use the requested source task: `taskId`, `field` (the carry field), `requestedSourceTaskId`, `resolvedSourceTaskId` (what was used instead, or null), `skippedSourceTaskIds[]`, `fallbackAt` (ms), `files[]` (only when the fallback recorded files). | Omitted when none | 2026-07-22 |
| `crossLessonCarry` | A task with `carryCodeFromLesson` / `carryBlocksFromLesson` ([two-lesson projects](AUTHORING_GUIDE.md#two-lesson-projects-carry-from-an-earlier-lesson)): `{ outcome, sourceLessonId, sourceTaskId, reason? }`. `outcome`: `found` (their earlier-lesson work was found and handed to them), `none` (nothing saved for them; `reason` `not_saved`, `too_large` or `error`), `starter` (the tutor chose **Use the starter**), `no_class` (the session had "No class"). A student who started from the starter also has a `carryFallback` with `crossLesson: true`, `reason`, `sourceLessonId` and `sourceTaskId`. Anonymous: no class-list names or ids. A student who already had their own work for the task keeps it whatever the outcome. | Omitted when the task has no cross-lesson carry or the student never reached it | 2026-10-14 |
| `supportReveals[]` | Each support reference opened: `taskId`, `stageIndex`, `stageLabel`, `source` (`student`, `teacher`, `teacher-auto`), `attemptNumber` (attempts made before it), `revealedAt` (ms). See [Support reveals](#support-reveals). | Omitted when none | 2026-07-22 |
| `pastes` | Large pastes into the editor: `{ count, chars }` (chars = total pasted). Pasting the student's own copied code doesn't count. | Omitted when none | 2026-09-29 |
| `sideQuests[]` | Each [side-quest](AUTHORING_GUIDE.md#side-quests) the student opened on this task, by index: `{ index, title, kind, openedAt (ms, first open), runs, errorRuns, done, doneAt (ms or null) }`. `done` is self-reported (the student's ✓ I've done it!), never checked. `title`/`kind` come from the lesson and are missing if the side-quest was since removed. Never any code. | Omitted when none | 2026-10-09 |
| `typing` | How the student typed on this code task ([Typing](#typing)): `{ charsTyped, activeTypingMs, charsPerMin, corrections, longestPauseMs, autocompleteAccepts, copyDistance? }`. Code tasks only (Python, Turtle, HTML); keyboard devices only. | Omitted when the student typed nothing, on touch devices, on other modules (Scratch, Arcade Kit, …), and on quizzes and activities | 2026-10-09 |
| `inspector` | The student's use of the [HTML Inspector](html.md#html-inspector) on this task: `{ used: true, opens, selects }`, where `opens` counts turning inspect mode on and `selects` counts choosing an element. Counts only, never page content. HTML tasks with `inspector` enabled, live lessons only. | Omitted when the student never used it | 2026-10-14 |
| `course` | [Turtle course mode](turtle.md#course-mode-course): `{ runs, goalReached, goalRuns, crashes, pickups, lastGoalReached }`: Runs of the course task, whether any run reached the goal (on every map) and how many did, crashes (maps crashed, over all runs), and the last run's pickups (over its maps) and goal. Counts only, never code. Live lessons only. | Omitted when the student never ran the course | 2026-10-15 |
| `slowMoUsed`, `slowMoRuns`, `slowMoSteps` | The student used slow-mo on this task: `slowMoUsed: true`, how many slow-mo runs they started (Slow-mo, or Step before a run) and the steps. [Scratch slow-mo](scratch.md#slow-mo): `slowMoSteps` counts presses of Step. [Python / Turtle slow-mo](python.md#slow-mo-slowmo): `slowMoRuns` counts recordings and `slowMoSteps` the steps viewed (each line shown going forward, by Step or while playing; a step viewed again after Step back counts again). Counts only, never code. Tasks with `slowMo.enabled`, live lessons only. | Omitted when the student never used it | 2026-10-14 |
| `linesUsed`, `changesFromStarter` | A [puzzle](python.md#puzzle-rules-puzzle-and-the-max_lines-check) task (`puzzle`): the lines of code (not blank, not only a comment) in the student's passing run, and how many lines of code they changed, added or removed compared with the task's starter. Read from the passing attempt's code. | Omitted when the task has no `puzzle` or the student never passed | 2026-10-15 |
| `scrubs`, `scrubNumbers`, `scrubColours`, `scrubBooleans` | The student changed values by [live scrubbing](python.md#live-scrubbing-scrub) on this task: `scrubs` in all, `scrubNumbers` numbers (a drag or the slider), `scrubColours` colours (the picker) and `scrubBooleans` True / False flips (a click; only when there were any, from 2026-10-20). Each finished scrub that changed the value counts once. Counts only, never code. Python, Turtle and HTML tasks with `scrub`, live lessons only. | Omitted when the student never scrubbed | 2026-10-14 |
| `scrubChecks` | How many [live scrub](python.md#live-scrubbing-scrub) releases failed their checks (`scrub.checkOnRelease`): the `distinctAttempts` entries with `source: scrub` that did not pass, each counting its `retries`. These are explorations, not failed attempts, so they are not in `attempts`, `retries`, `commonFailures` or the badge metrics. A student who only ever failed scrub releases reads `not_attempted` with `scrubChecks` set. | Omitted when none | 2026-10-22 |
| `tileMisses[]` | Code Arrange [tile feedback](lesson-schema.md#tile-feedback): each time the student dropped a tile into a blank where the task marks it known-wrong, oldest first: `{ slotId (the blank), tileId, at (ms) }`. Not attempts: they never count towards `attempts` or `distinctAttempts`. At most 100 per task. | Omitted when none | 2026-10-09 |
| `tutorTileHighlights[]` | Each time the tutor highlighted a tile on this student's board as "look again" from StudentModal (code_arrange slot mode, Match, Fill in the Gaps drag mode), oldest first: `{ targetId (the blank: code_arrange slot id, Match prompt pair id, or Fill in the Gaps blank id), tileId (the tile in it then, or null for an empty blank), note (the tutor's note; omitted when none), at (ms) }`. Support, not grading: never attempts, never changes `completed` or `finalResult`. At most 50 per task. See [Tutor Tile Highlights](../agents/classroom-behaviours.md#tutor-tile-highlights-teachertilehighlights). | Omitted when none | 2026-10-09 |
| `predictions` | A predict-mode [name-tag panel](python.md#name-tag-panel-showvariables) task (`showVariables.mode: predict`): `{ reveals, first, last, firstAllCorrect, lastAllCorrect }`. `first` / `last` are the first and latest revealed predictions, each `[{ name, value (what the student typed or picked, ≤ 200 characters: a True / False or choice button's text, e.g. `True`, `"red"`), correct }]` in `predict` order, then the **type predictions** (`showVariables.predictType`, 2026-10-16) in `predictType` order as `{ name, value (the picked type label: text, number, true/false, list), correct, kind: 'type' }` — so a `"5"` against `5` confusion shows directly; `reveals` counts the Runs that revealed predictions (a Run with unchanged predictions isn't counted again; at most 30). `firstAllCorrect` is the measure of predicting before running. Not attempts. | Omitted when the student never ran with a prediction typed | 2026-10-14 |
| `runCountPredictions` | A [run counts](python.md#run-counts-runcounts-count) task with `runCounts: predict`: `{ reveals, first, last, firstAllCorrect, lastAllCorrect }`, as `predictions`, with `first` / `last` each `[{ line, value, ran, correct }]` in marked-line order: `line` the marked line as the starter shows it, `value` the student's "how many times?" (≤ 20 characters), `ran` the real count (0 for a line that never ran). Measures the off-by-one misconception directly (predicted 4, ran 3). Logged in the same `predictionLog` reveal as the panel's predictions. Not attempts. | Omitted when the student never ran with a count typed | 2026-10-16 |
| `itemProgress` | `{ correct, total }` items right in the latest submission. | `taskType: activity` only, when submitted | 2026-09-28 |
| `lastDraft` | The last text the student typed but never submitted (an open or checked short answer, or typed fill-in-the-gaps shown as `print · ___`), from the live [answer drafts](quiz-tasks.md#live-drafts-what-the-tutor-sees-before-submit). Never an attempt. At most 1000 characters. | Omitted when the student submitted the task or typed nothing | 2026-10-09 |
| `finalRun` | `{ code, unchecked?, truncated?, at }`: the code of the student's **last Run** of a code task (Python, Turtle and other run-based modules) in this session, from `students/{id}/lastRuns`. `unchecked: true` on a task with no check (a Make It Your Own or Take it further), where no attempts are ever logged. Also on a checked task when they ran different code after their last attempt (attempts stop at the pass). Never an attempt or a pass. Code over 20,000 characters is cut, with `truncated: true`. Anonymous like the rest of the report; the code can hold whatever the student typed. | Omitted when the student never ran the task, or their last attempt already holds that code | 2026-10-22 |
| `exampleOpens[]` | Each ["See an example" fence](markdown-renderer.md#worked-examples-see-an-example) in the task's explainer the student opened during the live lesson: `{ example (1 = the first in the explainer), openedAt (ms, first open), afterMs (first open after the task started for the class), lastOpenedAt (ms, only when opened again), opens }`. Use it to see whether the worked example helped: compare `afterMs` with the student's attempts and `finalResult`. | Omitted when none | 2026-10-14 |
| `typingHistory` | A Keyboard typing task (`type_text`, `type_code`, `falling_words`) for a student the tutor matched to the class list who has scores from earlier lessons: this session's score beside the previous ones, `{ mode, cpm, accuracy, previousCpm, previousAccuracy, bestCpm, firstCpm }` ([below](#typing-history)). No names. | Omitted when unmatched or no earlier scores | 2026-10-14 |
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
| `distinctAttempts[].placements` | Code Arrange only: the tiles on the board when Run was pressed, `{ <blank id>: <tile id> }` (a tile id is a blank's own id, i.e. that blank's correct tile, or a distractor's id). Lets you tell a wrong-blank guess (a right tile in another blank) from a wrong-content one (a distractor). A retry keeps the first entry's. Omitted on other tasks, indent-mode tasks, and attempts before 2026-10-09. |
| `distinctAttempts[].source` | `scrub`: the attempt was made by the checks that run when a [live scrub](python.md#live-scrubbing-scrub) drag ends (`scrub.checkOnRelease`), not by pressing Run. Omitted on attempts from a Run (and on attempts before 2026-10-16). A scrub release that did **not** pass is kept here (so nothing is lost) but is not an attempt: it is left out of `attempts`, `retries`, `commonFailures`, `avgAttempts`, `errorAttempts`, `uniqueFailedAttempts` and `finalResult` (from 2026-10-22), and counted in `scrubChecks` instead. A scrub release that passes is the pass and counts as usual. |

The first five fields date from 2026-07-13; `placements` from 2026-10-09; `source` from 2026-10-16.

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
| `crossLessonCarryCounts` | `{ found, none, starter, no_class }` counts of the students' `crossLessonCarry` outcomes (zero counts left out). | Omitted when no student has one | 2026-10-14 |
| `supportRevealCount` | Total `supportReveals` across students. | Always | 2026-07-22 |
| `supportRevealStudentCount` | Students with at least one reveal. | Always | 2026-07-22 |
| `supportRevealSources` | `{ teacher, student }` counts (always present, may be 0), plus `teacher-auto` when any. | Always | 2026-07-22 |
| `pasteCount` | Total large pastes. | Omitted when none | 2026-09-29 |
| `pastedStudentCount` | Students who pasted. | Omitted when none | 2026-09-29 |
| `sideQuestStudentCount` | Students who opened at least one side-quest on this task (they had passed it while the class was still on it: a sign the class waited here). | Omitted when none | 2026-10-09 |
| `sideQuestDoneCount` | Side-quests marked done on this task, across students (self-reported). | Omitted when no side-quest was opened | 2026-10-09 |
| `exampleOpenStudentCount` | Students who opened a worked example (`exampleOpens`) in this task's explainer. | Omitted when none | 2026-10-14 |
| `timeToFirstEdit` | `{ medianMs, minMs, maxMs, studentCount }` over students' `timeToFirstEditMs`. | Omitted when none | 2026-09-30 |
| `timeOnTaskSpread` | `{ medianMs, p90Ms, maxMs, studentCount }` over students' non-null `timeOnTaskMs`: the gap between the median and the slowest student. `p90Ms` is the nearest-rank 90th percentile (with fewer than 10 students it is the slowest or second slowest). | Omitted when no student has a time | 2026-10-09 |
| `typingSummary` | `{ charsPerMin: { medianPerMin, minPerMin, maxPerMin, studentCount }, correctionsMedian }` over the students' `typing` ([Typing](#typing)). `charsPerMin` counts students with a rate (omitted when none has one); `correctionsMedian` covers every student with `typing`. | Omitted when nobody typed (always on quizzes and activities) | 2026-10-09 |
| `inspectorUsedCount` | Students who used the HTML Inspector on this task (their `inspector`). | Omitted when none | 2026-10-14 |
| `courseGoalReachedCount`, `courseCrashedCount` | Students who reached the goal on some run of this course task / who crashed at least once (their `course`). | Omitted when nobody ran the course | 2026-10-15 |
| `slowMoUsedCount` | Students who used slow-mo (Scratch, Python or Turtle) on this task (their `slowMoUsed`). | Omitted when none | 2026-10-14 |
| `scrubChecks` | Failed scrub releases on this task across students (the sum of their `scrubChecks`). | Omitted when none | 2026-10-22 |
| `scrubUsedCount` | Students who scrubbed a value on this task (their `scrubs`). | Omitted when none | 2026-10-14 |
| `predictionStudentCount` | Students with `predictions` on this task. | Omitted when nobody predicted | 2026-10-14 |
| `predictionFirstAllCorrectCount` | Of those, students whose first revealed predictions were all right. | Omitted when nobody predicted | 2026-10-14 |
| `predictionFirstByName[]` | Per predicted variable, `{ name, correct, total }` over the students' first revealed predictions: which variable the class misread. A type prediction tallies apart, with `kind: 'type'` (2026-10-16). | Omitted when nobody predicted | 2026-10-14 |
| `runCountStudentCount` | Students with `runCountPredictions` on this task. | Omitted when nobody predicted a count | 2026-10-16 |
| `runCountFirstAllCorrectCount` | Of those, students whose first revealed counts were all right. | Omitted when nobody predicted a count | 2026-10-16 |
| `runCountFirstByLine[]` | Per marked line, `{ line, correct, total, offByOne }` over the students' first revealed counts; `offByOne` counts the wrong predictions exactly one away from the real count. | Omitted when nobody predicted a count | 2026-10-16 |
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
| `ratingDistribution` | Confidence only: `{ 1: n, …, 10: n }` from each student's latest rating. Before 2026-10-09 the keys were 1–5. | 2026-07-22 (1–10 since 2026-10-09) |
| `ratingScale` | Confidence only: `10`, the scale of `ratingDistribution`. Missing in reports before 2026-10-09, whose ratings are out of 5, so read a missing `ratingScale` as 5. | 2026-10-09 |
| `optionDistribution[]` | Poll only: `{ id, text, count }` per option, in the task's option order, counting each student's latest choice (students can change their choice). With `multiple: true` a student counts once for every option they ticked, so counts can add up to more than `respondedCount`. | 2026-10-01 |
| `shownResponses[]` | Open short answer with `showResponses: teacher_picks` only: each answer the teacher showed on the presentation window, in the order first shown, as `{ studentLabel, text, showName, shownAt, hiddenAt }`. `text` is the answer as it was when shown; `showName` is whether the name was on screen last; `hiddenAt` is `null` if it was still on screen at the end. Omitted when none were shown. | 2026-10-02 |
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
| `tileMisses[]` | Code Arrange | `{ slotId, tileId, count, studentCount }` per blank and dropped tile, most common first, from the students' `tileMisses`. Omitted when nobody dropped a known-wrong tile. | 2026-10-09 |
| `itemResults[]` | Real or AI | `{ itemId, tell, reliable, revealed, rightPick }` per pair, counts of students (latest attempt each) who played it and picked the AI side. Omitted when nobody submitted. | 2026-10-22 |
| `recommenderResults` | Recommender | `{ students, avgRated, avgFeedKinds, openedWhyCount, bubbleCount }` from each student's latest attempt: items rated, groups in their feed, who opened Why?, and who ended in a one-kind bubble. Omitted when nobody submitted. | 2026-10-28 |
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
| `polls[].showResults` | `true` if the results were public (the default; live on the presentation and on students' screens once they voted), `false` if the teacher kept them private. |
| `polls[].createdAt`, `closedAt` | When it was launched and closed (ms); `closedAt` is null while open. |
| `polls[].respondedCount` | Students who answered. |
| `polls[].responses[]` | `{ studentLabel, choice (option index), choiceText, answeredAt }`, each student's final answer (students can change it while the poll is open). |
| `polls[].notResponded[]` | Labels of students in the class who didn't answer. A student who first joined after the poll closed isn't listed. |

## taskTimeline

The class's current task over time: one `{ taskId, startedAt }` entry each time the teacher moved
the class onto a task, oldest first, **information tasks included**. Written by the teacher's
device with the task change itself (`setTaskId`, `startSession` for the first task, and leaving
the teacher sandbox back onto a different task; `taskTimeline` in `useSession.js`), so it is the
teacher's clock, like `startedAt`. Added 2026-10-09.

| Path | Meaning |
|---|---|
| `taskTimeline[].taskId` | The task the class moved onto. |
| `taskTimeline[].startedAt` | When (ms). The class was on it until the next entry's `startedAt`, or `endedAt` for the last. |

- The first entry is the task at **Start session** (`startedAt` = the report's `startedAt`).
  Moving between tasks in the waiting room before the start is not recorded.
- Consecutive entries for the same task are collapsed. Going back to an earlier task adds a new
  entry, so a task can appear more than once.
- A jump (task 2 → task 9) means the teacher skipped the tasks between; a task the class never
  reached is simply absent. Compare `students[].joinedAtTaskId` to tell a late arrival's untouched
  tasks from skipped ones.
- Time in the teacher sandbox is **not** a separate entry: it falls inside the task the class
  left. Use `teacherSandbox.visits[]` (`enteredAt`, `exitedAt`) to take it out. Going live on a
  composed lesson's sandbox module, which silently switches task, adds no entry.
- `timeOnTaskMs` / `avgTimeOnTaskMs` still measure from the *latest* time the class moved onto a
  task (`taskStartTimes`), not from the timeline.

## Typing

`students[].tasks[].typing` and `taskSummary[].typingSummary` measure how a student typed on a code
task, so a slow typist can be told from a slow reader or a stuck student. Measured on the
student's own device from the code editor (`src/shared/typingStats.js`, `useStudentTypingStats`),
added up per task in memory and written with the student's Run, a task change and a hidden tab,
never per keystroke. Added 2026-10-09.

| Path | Meaning |
|---|---|
| `typing.charsTyped` | Characters inserted by keystrokes. Never pastes (see `pastes`), dropped text or accepted autocomplete suggestions. Enter counts once (its auto-indent doesn't count); an auto-closed bracket counts with the key that opened it. |
| `typing.activeTypingMs` | Time spent in typing bursts: the gaps between consecutive keystrokes (typed characters and corrections), counting only gaps of 5 s or less. A gap over 5 s ends a burst. |
| `typing.charsPerMin` | `charsTyped / activeTypingMs`, per minute, rounded. `null` under 5 s of active typing (too little to be a rate). |
| `typing.corrections` | Backspace and Delete presses in the editor (holding the key down counts once). |
| `typing.longestPauseMs` | The longest gap between two keystrokes on the task (any length; the wait before the first keystroke is `timeToFirstEditMs`, not this). |
| `typing.autocompleteAccepts` | Autocomplete suggestions accepted. |
| `typing.copyDistance` | Tasks with `copyCode` only: the edit distance (characters inserted, deleted or changed) between the copyCode and the student's code at their **first Run** on the task, ignoring trailing whitespace on each line and at the end. For HTML it is the closest file. Omitted when the student never ran it. |

- Recorded only in a live lesson on Python, Turtle and HTML code tasks, on keyboard devices.
  Omitted on touch devices (on-screen keyboard speeds aren't comparable), in solo study, in the
  personal and teacher sandbox, on every other module (Scratch, Arcade Kit, Electronics
  MicroPython, Filesystem, Desktop), and on quizzes, activities and Code Arrange.
- The counts are as of the student's last Run, task change or hidden tab before the session
  ended: typing after that on the last task is not reported. A reload carries on from the counts
  already written.
- Counts span every visit to the task: if the class comes back to it, typing adds to the same
  totals.

### Typing history

`students[].tasks[].typingHistory` puts a matched student's Keyboard typing score next to their
earlier ones, for typing courses that compare lessons (Typing for Coders). It comes from the
typing history the tutor's browser keeps on the student's class-list entry (see
[keyboard.md](activities/keyboard.md#typing-history-showhistory)), pushed to the session as
`typingHistory/{anonymousId}` and copied into the report when it is built. The report stays
anonymous ("Student N"): it holds numbers only. Added 2026-10-14.

| Path | Meaning |
|---|---|
| `typingHistory.mode` | `type_text`, `type_code` or `falling_words`. |
| `typingHistory.cpm` / `.accuracy` | This session: the average characters a minute and accuracy (0–1) of the finished items in the latest submission. Omitted when the student never submitted. |
| `typingHistory.previousCpm` / `.previousAccuracy` | The most recent earlier session in this mode (the average of its finished items). |
| `typingHistory.bestCpm` | The best single item before this session (characters a minute, then accuracy). |
| `typingHistory.firstCpm` | The earliest session in this mode (its average), for "from 40 to 75" comparisons. |

## peerHelp

The safeguarding record of peer help (a finished student helping a stuck one; see
`docs/agents/classroom-behaviours.md` "Peer Help"), one entry per request, oldest first. Keeps
every item, including the ones the teacher rejected and notes the word filter blocked. Built
from `peerHelp/{lessonId}` (`buildPeerHelpAudit` in `src/shared/peerHelp.js`). Students appear
under the report's anonymous labels like everywhere else, so the report alone can't say which
child a label was. Added 2026-10-02.

| Path | Meaning |
|---|---|
| `peerHelp[].requestId` | The request's random id. |
| `peerHelp[].taskId` | The task it was asked on. |
| `peerHelp[].stuck`, `helper` | Student labels; `helper` is null if nobody claimed it. |
| `peerHelp[].offeredAt`, `claimedAt`, `endedAt` | When the teacher offered it, a helper claimed it, and it ended (ms; null if not reached). |
| `peerHelp[].endedBy` | `stuck`, `helper`, `teacher` or `task_changed`. |
| `peerHelp[].notOkAt` | When the stuck student pressed 🚩 Not OK (null if they didn't). |
| `peerHelp[].delivered[]` | What reached the stuck student: `{ kind (mark, hint, edit, note), file, line, verdict, hintId, text, edits, response, createdAt }`. `response` is `useful`, `accepted`, `declined` or `not_ok`. |
| `peerHelp[].reviewed[]` | Edits and notes sent to the teacher: the same fields plus `status` (`pending`, `approved`, `rejected`, `blocked`) and `blockedReason` (`language`, `contact`). |

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
pending at session end); `awarded` counts badges still held. `autoAwarded` and `manual` count two
kinds of those, but a suggestion the tutor **accepted** counts only in `awarded`, so
`awarded` can be more than `autoAwarded + manual`. See [badges.md](badges.md).

## Teacher feedback

There are two kinds of teacher feedback inside a report, both with the same shape:
`{ rating, whatWorkedWell, whatDidntWork, submittedAt }`, where `rating` is a whole number 1–5
(or null when only notes were given), the notes are trimmed strings (`""` when blank), and
`submittedAt` is ms.

### Lesson-level `teacherFeedback`

- **One per session run**, on that run's report document. A lesson taught five times has up to
  five, one per report; a class copy's runs are on the fork lesson's own reports.
- Given in the **one after-class feedback step** (rating, "What worked well", "What didn't work,
  or was broken", plus optional per-task notes). It appears after every way of ending a session:
  **End Session** opens the report with the step at the top; **End & Go to Home** shows the step
  (with **Skip**) before leaving. It can also be added or edited **later** from the lesson's
  past reports (**Reports** in the session, or Admin > Lessons > the lesson's reports): the
  report shows **Add feedback** or **Edit feedback**. Saving merges only `teacherFeedback` onto
  that run's report document, in the shape above.
- **Absent** when the step was skipped or left blank (no empty stub is ever written). Reports
  written before 2026-10-17 are unchanged; reports from "End & Go to Home" can now gain it
  afterwards.
- Added 2026-09-01; reachable after every ending and editable later from 2026-10-17.

### Per-task notes from the after-class step

- Optional: the tutor picks a task and writes a note (as many as they like). Each note is stored
  as an item in **`lessons/{lessonId}/feedback`**, the same store and shape the old in-lesson
  Feedback button wrote (`taskId`, `taskTitle`, `text`, `teacherEmail`, `submittedAt`), plus
  **`reportId`**: the id of the session run's report (its `sessionId`, which is also the report
  document id in `lessons/{lessonId}/sessionReports`).
- They are **not** inside the report YAML. Read them with the [feedback CLI](feedback-cli.md)
  (`feedback lesson <id>` shows `reportId`) or in Admin > Lessons. The in-lesson Feedback button
  no longer exists in the live tutor header; older items without `reportId` still read as before.
- Added 2026-10-17.

### Per-task `teacherRating`

- `taskSummary[].teacherRating`, at most one per task per session.
- Recorded **during** the session from the teacher's task rating panel (`setTaskRating`), into
  the Realtime Database at `sessions/{lessonId}/taskRatingLog/{taskId}` (last save wins; clearing
  every field removes it), and copied into the report when it's built.
- **Omitted** for tasks the teacher didn't rate. Information tasks aren't in reports, so a rating
  on one is not reported.
- Added 2026-09-09.

### How this differs from CLI feedback

The [feedback CLI](feedback-cli.md) reads a **different** store: free-text lesson and task notes
(`lessons/{lessonId}/feedback`; since 2026-10-17 the task notes come from the after-class step,
before that from the in-lesson Feedback button), plus platform feedback. Those items have `text`, `teacherEmail` and an
`archived` flag, are not tied to a session run, and can be added and archived from the CLI.
Report feedback (`teacherFeedback`, `teacherRating`) is rated, lives only inside the report, is
never archived, and is only visible through the exported report YAML.

## Share links

When the tutor ends a live session (End Session, or End & Go to Home), LaunchPad makes one
read-only share link per student who has code work (Python, Scratch, Turtle, web page or any
module with an Export work exporter), for the **last task in lesson order with work**: the live
work on the current task, otherwise the newer of the latest logged attempt and the student's
latest Run on that task (`students/{id}/lastRuns`, kept for every task since 2026-10-22). Before
then a task with no check (a Take it further) had no saved work, so the link fell back to the last
checked task. A Python link has **Run**: the code runs in the viewer's browser, asking any
`input()` in the output panel; nothing is saved. It is the same name-hidden snapshot
as Export work's share link (`sharedWork/{id}`, 30 days, revocable). Nothing is sent anywhere.
The report screen lists them under **Share links for parents** with Open, Copy, Revoke and
**Copy all**; the Reports panel and Admin lesson panel show the same list.

| Path | Meaning |
|---|---|
| `shareLinks[].studentKey` | The student's `studentKey` (matches `students[].studentKey`). |
| `shareLinks[].kind` | The module type (`python`, `scratch`, `html`, …). |
| `shareLinks[].taskId`, `taskTitle` | The task shared. |
| `shareLinks[].shareId`, `url` | The share document id and its public URL. |
| `shareLinks[].expiresAt` | When the link stops working (ms). |
| `shareLinks[].error` | Instead of the fields above when that student's link couldn't be made (work too big, or the write failed). |

Read them with the CLI (anonymous: `studentKey`, no names):

```bash
node cli/cli.mjs sessions share-links <lessonId> --yaml                 # every session of a lesson
node cli/cli.mjs sessions share-links <lessonId> --session <sessionId>  # one session
node cli/cli.mjs sessions share-links --since 2026-10-21 --yaml         # every lesson, since a date
```

Each row is `{ lessonId, lessonTitle, sessionId, sessionStartedAt, links: [{ studentKey, kind,
taskTitle, url, expiresAt }], notMade? }`, oldest session first; `notMade` counts links that
couldn't be made. Dates are ISO strings.

## Solo study log

> **Not recorded (2026-10-23).** Ryan chose not to log solo study (handoff #130). No student
> writes the log, so the command below and the Admin tab always return an empty log. The fields
> are kept here for reference.

Solo study (a Solo Challenge, or any lesson opened with `?solo=true` or `soloOnly`) has no live
session, so it is not in a session report. It has its own log, read with the CLI or the Admin
portal's **Solo & side-quests** tab:

```bash
node cli/cli.mjs lessons solo-log <lessonId>
```

The output is anonymised like a report: students are `Student 1`, `Student 2`… in the order they
started, with no names, ids or code. Times are ms.

| Field | Meaning |
|---|---|
| `lessonId`, `lessonTitle` | The lesson read. |
| `students[].studentLabel` | `Student N`, by start order. Not comparable with a session report's labels. |
| `students[].startedAt` | First time the student opened the lesson solo on a real device. |
| `students[].lastAt` | Latest logged event (arrival, checked Run or finish). |
| `students[].finishedAt` | When they reached the lesson-complete screen; `null` if they haven't. |
| `students[].taskCount`, `tasksPassed` | Graded (non-information) tasks in the lesson, and how many they passed. |
| `students[].firstAttemptPasses` | Tasks whose very first checked Run passed. |
| `students[].tasks[]` | Per task: `{ taskId, title, attempts, passed, firstTry, firstAt, passedAt }`. `attempts` counts checked Runs up to and including the pass (nothing is counted after it). |

Recorded on discrete events only (arrival, each checked Run, completion screen), never per
keystroke, and never any code. Not recorded in a live lesson, the presentation window, a Builder
preview, the playground or a personal sandbox. A restored or automatic result (idle feedback,
Show complete) is not an attempt.

Side-quests per student per session are the `sideQuests[]` on each task in the session report
(above). The Admin tab flattens them across a lesson's ended sessions; the download adds them as
`sideQuests[]` beside `students[]`.

## Reading predict and scrub data (for pipeline-ui)

Fetch a report with the CLI (read-only; the YAML is anonymised, so there are no names):

```
node cli/cli.mjs lessons reports list <lessonId> [--since <ISO date>]
node cli/cli.mjs lessons reports get <lessonId> <startedAt> --yaml
```

Paths below are relative to the report root. `students[].tasks[]` is one entry per student per
task; `taskSummary[]` is one entry per task. Every field is omitted (not null or 0) when there is
nothing to say, so test for presence.

| YAML path | Type | Holds |
|---|---|---|
| `students[].tasks[].predictions` | object | Predict-mode name-tag panel task: `reveals` (int), `first` / `last` (lists of `{ name, value, correct, kind? }`; `kind: type` for a type prediction), `firstAllCorrect` / `lastAllCorrect` (bool). |
| `students[].tasks[].runCountPredictions` | object | Run-count predict task (`runCounts: predict`): `reveals`, `first` / `last` (lists of `{ line, value, ran, correct }`), `firstAllCorrect`, `lastAllCorrect`. |
| `taskSummary[].predictionStudentCount`, `.predictionFirstAllCorrectCount` | int | Students who predicted; of those, first prediction all right. |
| `taskSummary[].predictionFirstByName` | list | `{ name, correct, total, kind? }` per predicted variable (first prediction). |
| `taskSummary[].runCountStudentCount`, `.runCountFirstAllCorrectCount` | int | As above, for run counts. |
| `taskSummary[].runCountFirstByLine` | list | `{ line, correct, total, offByOne }` per marked line. |
| `students[].tasks[].scrubs`, `.scrubNumbers`, `.scrubColours`, `.scrubBooleans` | int | Values changed by scrubbing (`scrubBooleans` only when non-zero). |
| `students[].tasks[].scrubChecks` | int | Failed scrub releases (not attempts). |
| `students[].tasks[].distinctAttempts[].source` | string | `scrub` on an attempt made by a scrub release; absent on a Run. |
| `taskSummary[].scrubUsedCount` | int | Students who scrubbed on the task. |
| `taskSummary[].scrubChecks` | int | Failed scrub releases across students. |

```yaml
students:
  - tasks:
      - taskId: 3
        attempts: 1
        scrubs: 6
        scrubChecks: 4
        predictions:
          reveals: 1
          firstAllCorrect: false
          lastAllCorrect: false
          first: [{ name: total, value: '7', correct: false }]
          last: [{ name: total, value: '7', correct: false }]
        distinctAttempts:
          - { attemptNumber: 1, passed: false, retries: 0, submission: '...' }
          - { attemptNumber: 2, passed: false, retries: 3, source: scrub, submission: '...' }
```

## Not in reports

- Information tasks (except as `taskTimeline` entries).
- Student names, anonymous ids or devices.
- Attempts on tasks without a `check`, sandbox runs' code, or attempts after the student passed.
- Individual keystrokes or typing timestamps (only the per-task `typing` totals).
- Anything after the session ended. Solo study is not in a session report: see "Solo study log" above.
