# Activities: Host, Data Flow and Write Rules

How a hosted activity (`taskType: 'activity'` + `activityType`) runs in the classroom. The plan
and the Workspace-module-vs-Activity decision test are in
[modular-activities-plan.md](modular-activities-plan.md); authoring pages are in
`docs/authoring/activities/` ([binary](../authoring/activities/binary.md),
[keyboard](../authoring/activities/keyboard.md), [mouse](../authoring/activities/mouse.md)).

Status: Binary, Keyboard and Mouse run through the host (plan step 2.3a). Legacy quiz and
`code_arrange` tasks still use `QuizTask` / `CodeArrangeTaskContainer` and are only *resolved*
to activity ids (`resolve.js`); they move onto the host in steps 2.3b and 4.9.

## Pieces

| Piece | File | Job |
|---|---|---|
| Pure definition | `src/activities/<id>/definition.js` | Contract from `defineActivity.js`: `initialState`, `solutionState`, `serialize` / `deserialize` (tolerant), `storage`, `classifyChange`, `grade`, `getProgress`, `summarize`, `requires`, `touchFallback`, `teacherEditable`, `validateTask`. Node-safe (CLI, validation, print). |
| Pure registry | `src/activities/registry.pure.js` | `getTaskActivity(task)` (unknown `activityType` → `unknown` fallback), `isHostedActivityTask`, `allowsStudentBroadcast`. |
| UI | `src/activities/<id>/ui.jsx` | `{ StudentView, TeacherLiveView? }`. Views are controlled: `state`, `onChange(nextOrUpdater)`, `onSubmit()`, `readOnly`, `device`. |
| UI registry | `src/activities/registry.js` | Merges definition + UI (`getTaskActivityUi`). Never imported by the CLI. |
| State hook | `src/app/hooks/useActivityState.js` | Owned by `useStudentCodeState` (exposed as `cs.activity`). All persistence, sync, grading, reset and teacher-edit rules. |
| Host | `src/activities/ActivityHost.jsx` | Chooses which state to show and applies the device rules. `ActivityView` is the presentational surface reused by the teacher. |
| Helpers | `src/activities/state.js`, `src/activities/device.js` | Reading serialised state (card summary, modal, broadcast); device badge; effective capabilities. |

`StudentView` routes an activity task to `LessonTaskContent` with `isActivityTask`, which renders
`ActivityHost` in the full-width quiz layout. Activity tasks are not code tasks
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
  `writeStudentRun(id, { answer, status: 'submitted', checkPassed })` and, for graded
  activities, `logAttempt` with `buildSubmission` and `teacherAssisted`. `completion: 'auto'`
  activities submit on the first passing discrete change.

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
- **TeacherEditorPanel** shows the activity's solution state read-only.

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

## Unknown activities

A task whose `activityType` this bundle doesn't know resolves to the `unknown` definition: the
host shows a friendly "not available" notice, it is never graded (`completion: 'none'`), and the
teacher cannot record an advance override for it. Validation reports it as an error, so it only
reaches students from a lesson authored against a newer version.

## Adding an activity

Start from the kit rather than by hand. Claude Code's `new-activity` skill
(`.claude/skills/new-activity/SKILL.md`) walks the whole loop, from an authoring request to the
real-browser checks.

```bash
npm run new:activity -- <id> "<Label>" [--category computing|digital_skills|quiz|code] [--dry-run]
```

`scripts/new-activity.mjs` copies `src/activities/_template/` into `src/activities/<id>/`,
replacing the placeholders (`template_activity`, `TemplateActivity`, `Template Activity`), and:

- adds the definition import to `registry.pure.js` (before the `unknown` fallback in
  `ACTIVITIES`) and the UI import to `registry.js` (`ACTIVITY_UIS`);
- writes `docs/authoring/activities/<id>.md` from `_template/doc.md.tmpl`, with a complete
  example lesson that passes CLI validation;
- adds the `docs/README.md` index entry, `docs/CODEBASE_MAP.md` rows and a `### <Label>`
  section in `docs/authoring/validation-errors.md` for the starter messages;
- prints the next steps.

It validates the id (lowercase identifier, not reserved, not already used), refuses to
overwrite any file, works out every edit before writing anything, and `--dry-run` prints the plan
(created files, and the lines added to each updated file) without writing. The untouched
scaffold is a working "type the answer" activity, so `npm test`, `npm run docs:check`, ESLint,
`npm run format:check` and `npx vite build` pass straight after it runs; every place to change
is marked `TODO(new-activity)`. `_`-prefixed folders are skipped by the registry, interface and
validation-doc tests, and the template's StudentView click-through skips itself until the
activity is registered. The generator is tested by `scripts/__tests__/newActivity.test.mjs`.

Then, in the new folder:

1. `<id>.js` (pure logic: validation, solutions, grading, hints) and `definition.js` (the
   contract above; `activityInterface.test.js` checks it). Classify changes carefully: anything
   per-keystroke or per-pointer-move must be `'continuous'`. Set `requires` / `touchFallback`.
2. `ui.jsx`: keep controls ≥ 44px, keyboard accessible, and honour `prefers-reduced-motion`
   (`act-` CSS namespace, `docs/UI_STYLE_GUIDE.md`).
3. Tests: pure tests, UI tests with `src/test/activityUiHarness.jsx`, and the real `StudentView`
   click-through (`__tests__/studentView.test.jsx`).
4. Rewrite `docs/authoring/activities/<id>.md` (keep a complete example; validated by
   `authoringDocExamples.test.js`) and the activity's rows in `validation-errors.md`; add a
   CHANGELOG entry.
5. Verify pointer, drag, keyboard and touch behaviour, and the teacher surfaces, in a real
   browser — jsdom can't.

Workspace modules have no scaffold yet (plan step 4.8); `.claude/skills/new-module/SKILL.md`
holds the manual checklist.
