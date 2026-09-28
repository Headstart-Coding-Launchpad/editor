# Activities: Host, Data Flow and Write Rules

How a hosted activity (`taskType: 'activity'` + `activityType`, or a legacy quiz) runs in the
classroom. The plan
and the Workspace-module-vs-Activity decision test are in
[modular-activities-plan.md](modular-activities-plan.md); authoring pages are in
`docs/authoring/activities/` ([binary](../authoring/activities/binary.md),
[keyboard](../authoring/activities/keyboard.md), [mouse](../authoring/activities/mouse.md)).

Status: Binary, Keyboard and Mouse run through the host (plan step 2.3a), and so do quizzes
(steps 2.2 / 2.3b, see [Quizzes](#quizzes-legacy-activities)). `code_arrange` still uses
`CodeArrangeTaskContainer` and is only *resolved* to an activity id (`resolve.js`); it moves onto
the host in step 4.9.

## Pieces

| Piece | File | Job |
|---|---|---|
| Pure definition | `src/activities/<id>/definition.js` | Contract from `defineActivity.js`: `initialState`, `solutionState`, `serialize` / `deserialize` (tolerant), `storage`, `classifyChange`, `completion`, `grade`, `isGraded`, `buildSubmission`, `getProgress`, `summarize`, `requires`, `touchFallback`, `teacherEditable`, `submitsAnswers`, `previewState`, `report` (`typeFields`, `normalizeSubmission`, `summaryFields`), `printHtml`, `validateTask`. Node-safe (CLI, validation, reports, print). |
| Pure registry | `src/activities/registry.pure.js` | `getTaskActivity(task)` (unknown `activityType` / `quizType` → `unknown` fallback), `isHostedActivityTask`, `isLegacyQuizTask`, `allowsStudentBroadcast`. |
| UI | `src/activities/<id>/ui.jsx` | `{ StudentView, TeacherLiveView?, CardSummary?, ownsLayout? }`. Views are controlled: `state`, `onChange(nextOrUpdater)`, `onSubmit(state?)`, `readOnly`, `device`, `teacher`, `result` (`{ submitted, passed }` of the answer shown). |
| UI registry | `src/activities/registry.js` | Merges definition + UI (`getTaskActivityUi`). Never imported by the CLI. |
| State hook | `src/app/hooks/useActivityState.js` | Owned by `useStudentCodeState` (exposed as `cs.activity`). All persistence, sync, grading, reset and teacher-edit rules. |
| Host | `src/activities/ActivityHost.jsx` | Chooses which state to show and applies the device rules. `ActivityView` is the presentational surface reused by the teacher. |
| Helpers | `src/activities/state.js`, `src/activities/device.js` | Reading serialised state (card summary, modal, broadcast); device badge; effective capabilities. |

`StudentView` routes an activity or quiz task to `LessonTaskContent` with `isActivityTask`, which
renders `ActivityHost` in the full-width quiz layout. Activity tasks are not code tasks
(`isCodeTask` is false): no Run, personal sandbox, share (`canTaskAllowSharing`), carry-through,
explainer rail or stage references.

## Data flow

```
ActivityHost ── state ──> <Activity>.StudentView
     ^                          │ onChange(next | prev => next), onSubmit()
     │                          v
     └──── cs.activity <── useActivityState
                                │ commit: save aux file (every change)
                                │ classifyChange(prev, next)
                                ├─ 'discrete'  → currentAnswer, debounced 300ms (always, live lesson)
                                ├─ 'continuous'→ currentAnswer, throttled 250ms, only while
                                │                session.activeStudentView === this student
                                └─ submit      → grade() → applyCheckFeedback,
                                                 writeStudentRun({ answer, status, checkPassed }),
                                                 logAttempt (graded activities)
```

Nothing new is stored in Firebase: the serialised state (JSON) goes on
`students/{id}/currentAnswer`, the same string field quiz answers use.

## Write rules (enforced once, in `useActivityState`)

- **Every change** is saved locally to the per-task aux file
  `headstart_{lessonId}_{taskId}___activity_state___{anonymousId}` as `{ content }`, through
  `createStudentPersistence` (an in-memory store in presentation and Builder preview).
- **Discrete** changes (a bit toggled, an item finished) write `currentAnswer` after a 300ms
  quiet period whether or not the teacher is watching, so every teacher card stays current.
- **Continuous** changes (keystrokes, typing a number) write `currentAnswer` at most every
  250ms and **only while the teacher is watching this student**. The watch is re-checked when
  the throttled write fires, so a trailing write never lands after the teacher stops watching.
- When the teacher starts watching, the latest state is flushed once.
- Leaving the task cancels pending mirror writes (a late write would land on the next task's
  card). Writes only happen in the live lesson phase; presentation tabs never write
  `students/…`.
- **Submit** (the activity's Check button, or an activity finishing itself): `grade(task,
  state)` → `applyCheckFeedback(passed, suggestion)` (the usual banner), then
  `writeStudentRun(id, { answer, status: 'submitted', checkPassed })` and, in the live lesson,
  `logAttempt` with `buildSubmission` and `teacherAssisted`. `completion: 'auto'` activities
  submit on the first passing discrete change, unless the UI submits final answers itself
  (`submitsAnswers`, the quizzes). `onSubmit(state)` with an explicit state (a quiz's "this
  answer is final") also saves that state and supersedes a pending teacher edit, without the
  debounced mirror write. `completion: 'none'` activities are never marked: only an explicit
  response is recorded (a confidence rating, logged with `passed: true`).
- The session sandbox keeps the quiz rules: answers and runs are mirrored there too, but no
  attempts are logged (in practice the sandbox shows the lesson's workspace, not the task).

## Teacher surfaces

- **StudentCard** summarises `currentAnswer` with the definition's `summarize` (e.g. `2/3
  correct`) plus a device badge (`describeActivityDevice`: touch screen / on-screen keyboard,
  read from the activity's own state).
- **StudentModal / StudentWorkspaceBody** render `ActivityView` read-only from `currentAnswer`.
  With **Edit answers** (only when `teacherEditable`), each teacher change calls
  `pushTeacherAnswerEdit` with the serialised state and `passed: true` only when the edited state
  grades as passed (otherwise `null`, like a partial quiz tile edit). The student's tab applies
  `teacherAnswerEdit` in `useActivityState`, marks the task teacher assisted, and reports a
  result only for a marked edit. The student's own next change clears the edit.
- **Stage** reset options for activities are `Start again` (`remoteResetAction: 'starter'` →
  `initialState`) and `Complete (show answers)` (`'complete'` → `solutionState`)
  (`buildStageOptions`). The `remoteResetPushedAt` already present when the tab first sees its
  student record is treated as history and never re-applied.
- **TeacherEditorPanel** shows the activity's solution state read-only, or the blank task for
  `previewState: 'initial'` (quizzes: the teacher's screen is often projected).
- The teacher's **advance override** (`canRecordAdvanceOverride`) is offered only for marked
  tasks: not for `completion: 'none'` or ungraded (`isGraded(task)` false) activities.

## Go Live

- Broadcasting a **student's** quiz or activity work is not offered (`allowsStudentBroadcast`):
  StudentModal hides "Go Live for All", `TeacherView.handleGoLiveForAll` refuses, and a student
  broadcast still running from an earlier code task stops publishing on these tasks
  (`canPublishTeacherLive`). A running broadcast can always be stopped.
- The **teacher's** own broadcast (Presentation View) publishes the serialised state as
  `teacherLive.answer` on every change (throttled) and when arriving on an activity task; a task
  change nulls `answer` first. Viewers read `displayAnswer` (`deriveStudentLiveDisplay`) and
  `ActivityHost` renders it read-only.

## Devices

`ActivityHost` compares the definition's `requires` (`physicalKeyboard`, `finePointer`, `hover`)
with `useInputCapabilities()` (media queries; a hardware keydown proves a keyboard):

| `touchFallback` | Missing requirement | Result |
|---|---|---|
| `virtual_keyboard` | physical keyboard | Notice + on-screen keyboard (`device.virtualKeyboard`); "I have a keyboard" override |
| `equivalent` | fine pointer / hover | Touch notice; the activity accepts touch equivalents (`device.touch`) |
| `block` | any | "Needs a keyboard / mouse" notice instead of the activity |

A touch-only device with no keyboard evidence counts as having no physical keyboard. Activities
record the device in their state (`state.device`, per-item `source: 'virtual'`) so grading and
the teacher badge need no extra Firebase field.

## Quizzes (legacy activities)

Each quiz sub-type is an activity: `quiz_multiple_choice`, `quiz_match`, `quiz_fill_blank`,
`quiz_short_answer`, `quiz_confidence` (`src/activities/quiz_<type>/`), built with
`defineQuizActivity` in `src/activities/quiz/quizActivity.js`. Stored lessons are unchanged:
`resolve.js` maps `taskType: 'quiz'` + `quizType` (missing → `multiple_choice`) to the id, and each
definition carries `legacy: { taskType: 'quiz', quizType }`. An unknown `quizType` gets the
`unknown` fallback.

| | multiple_choice | match | fill_blank | short_answer | confidence |
|---|---|---|---|---|---|
| State / `currentAnswer` | option id `"b"` | `{"p1":"p2"}` | `{"b1":"d1"}` (tile id) or typed text | free text | `"1"`..`"5"` |
| Final answer | option chosen | last tile placed | last tile (drag) / Submit (type) | Submit | rating chosen |
| `completion` / `isGraded` | on_submit / yes | auto / yes | auto / yes | on_submit / only with a `check` | none / no |
| Teacher "Edit answers" | no | yes | yes | no | no |

- Every change is discrete (debounced 300ms mirror, always); a final answer is submitted by the
  quiz UI (`onSubmit(answer, { passedOverride })`), so the host never auto-submits a quiz.
- Answers **persist** in the `__activity_state__` aux file (since 2.3b; before, a reload or
  task switch lost them). Only the answer comes back: the run status and banner start fresh.
- The UI (`src/activities/quiz/QuizActivityViews.jsx`) hosts the existing quiz components
  through `QuizTask` (`ownsLayout`: no activity header or frame); `CardSummary` renders the
  StudentCard answer (option, match/fill progress text, short answer, rating badge).
- Submissions, item progress, session-report fields (`{ taskType: 'quiz', quizType }`,
  normalised submissions, confidence `ratingDistribution`, `pairFailures` / `blankFailures`) and
  print sections come from the definitions; `studentQuizContent.js`, `taskItemProgress.js`,
  `lessonReport.js` and `printLesson.js` are adapters over them, and their output is pinned
  byte-for-byte by the Phase 0 tests. Validation still runs the shared legacy rules
  (`legacyValidation.js`), which each definition's `validateTask` wraps.
- Quiz-only rules kept via `isLegacyQuizTask`: the feedback banner shows only for a quiz with a
  `check` or an auto-marked match / fill-in-the-gaps; the StudentModal hides the stage dropdown
  and Edit Code on quizzes.
- The Builder's quiz editors and preview are unchanged (plan 2.4).

## Unknown activities

A task whose `activityType` this bundle doesn't know resolves to the `unknown` definition: the
host shows a friendly "not available" notice, it is never graded (`completion: 'none'`), and the
teacher cannot record an advance override for it. Validation reports it as an error, so it only
reaches students from a lesson authored against a newer version.

## Adding an activity

1. `src/activities/<id>/definition.js` (+ pure logic module) and one import in
   `registry.pure.js`; `activityInterface.test.js` checks the contract.
2. `src/activities/<id>/ui.jsx` and one import in `registry.js`. Keep controls ≥ 44px, keyboard
   accessible, and honour `prefers-reduced-motion` (`act-` CSS namespace, `docs/UI_STYLE_GUIDE.md`).
3. Classify changes carefully: anything per-keystroke or per-pointer-move must be
   `'continuous'`.
4. Tests: UI tests with `src/test/activityUiHarness.jsx`; a `StudentView` click-through.
5. `docs/authoring/activities/<id>.md` with a complete example (validated by
   `authoringDocExamples.test.js`), its messages in `validation-errors.md`, a CHANGELOG entry.
6. Verify pointer, drag, keyboard and touch behaviour in a real browser — jsdom can't.
