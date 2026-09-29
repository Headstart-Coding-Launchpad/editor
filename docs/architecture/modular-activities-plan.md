# Modular Activities & Modules Plan

Status: **Implemented** on `feature/modular-activities` (agreed 2026-09-28; every phase below is done, see [Status](#status)). Each numbered step shipped as one focused PR with tests green and **no change to stored data formats**. What is left is real-browser verification.

## Status

| Phase | State |
|---|---|
| 0 — Safety net (0.1–0.5) | Done: CI `vite build` + Node import test, characterisation suites, registry parity + StudentView click-through, type-branch ratchet. |
| 1 — Shared foundations (1.1–1.5) | Done: `definition.js` / `index.js` split, derived type lists, check-type registry, shared `validateTask`, drift fixes. |
| 2 — Activity tier + kit (2.1–2.7) | Done: activity registry and resolver, quizzes and Binary (all eight modes) as activities, `ActivityHost`, Builder/YAML, `npm run new:activity`, `lessons capabilities`, authoring requests, [ADR 0009](../adr/0009-activity-registry.md). |
| 3 — Input, Keyboard, Mouse (3.1–3.3) | Done. |
| 4 — Module contract v2 (4.1–4.9) | Done: lifecycle, storage, wire, generic work slot for every module, teacher surfaces, capability gates, Builder `authoring`, type branches at **zero** outside the plugin folders (ratchet + ESLint `no-restricted-syntax`), `src/modules/_template/` + `npm run new:module` + the `new-module` skill, [lesson-type-modules.md](lesson-type-modules.md) rewritten for v2, [ADR 0010](../adr/0010-module-contract-v2-and-work-slot.md); `code_arrange` on the activity contract. |
| 5 — Learning carries into Desktop (5.1) | Done: Desktop records input and exposes the `input_*` checks. |

### Outstanding real-browser checks

jsdom cannot catch pointer stacking, layout, iframe, Blockly or touch problems, so these still
need a person in a real browser (a teacher tab plus a student tab, ideally one on a tablet):

- **Quizzes as activities:** answers persist across reload; teacher card/modal show answers;
  Edit answers; Start again / show answers; Go Live only broadcasts the teacher's own quiz and
  it renders the state; composed lesson with a quiz between code tasks.
- **Binary / Keyboard / Mouse:** every mode by mouse, keyboard and touch; the on-screen keyboard
  and `hardwareOnly` items; device badge; teacher view/edit/reset; Builder preview.
- **Module contract v2 (4.3–4.7), per module:** edit/run/check in solo and live; reload keeps
  work; carry-through; personal sandbox; teacher tabs (Starter / stages / Complete), Send to all,
  remote reset to each stage, Run on student, teacher live edit (python, turtle, arcade, scratch,
  html, electronics), teacher sandbox go live / push / reset / leave, share with class, the
  presentation broadcast, StudentModal mirrors and highlights, focus panes (scratch,
  electronics); a composed lesson switching modules.
- **Plan 4.8 (behaviour-neutral, confirm nothing moved):** TeacherView centre column fill vs
  scroll for each module and the Starter tab's work (electronics shows `starterCircuit`); the
  teacher sandbox layout for scratch and html; the four playgrounds; admin Shared Assets
  (Scratch sprites/backdrops, no "Web editor" toggle on HTML); the explainer editor's Scratch
  Blocks menu; no topic library on Scratch; the support-stage reference panel for each module;
  the Builder for every module (new task, draft notices, Run, print, sandbox starter modal).
- **Code arrange** in a python and an html lesson (drag, Run, teacher mirror).
- **Desktop input checks** (double-click vs single click, drag, shortcuts).
- **A scaffolded module** (`npm run new:module`, then removed): the template module renders,
  saves, checks and mirrors in a real browser before a real module is built on it.

## Why

Adding a lesson module today touches 20–38 files outside `src/modules/<type>/` and has always needed follow-up fixes (Turtle: 22-file gap-fix PR the same day; Arcade: teacher editor crash; Desktop: broken production build; Electronics: teacher surfaces weeks later). Root causes:

- ~385 inline lesson-type comparisons in 41 files outside `src/modules/` — worst are `src/app/hooks/useStudentCodeState.js` (~100), `src/app/views/TeacherView.jsx` (~42), `src/builder/lessonUtils.js` (~36), `src/app/views/StudentView.jsx` (~36), `cli/validate.mjs` (~23).
- ~8 hand-maintained type lists and ~9 label/icon maps that have already drifted (Desktop missing from share/copy/print/`deriveTaskContext`, labels missing Turtle/Desktop/HTML).
- Two validators: `cli/validate.mjs` is a hand copy of `src/builder/lessonUtils.js` validation.
- Quiz sub-types and `code_arrange` are hard-coded across ~18 files (66 branch sites).
- CI never runs `vite build`; there are no scaffolds and lesson agents can only learn capabilities from prose docs.

New activities and modules will be built by Claude, often from lesson-agent requirements, so the goal is: **adding one is a single-folder change, scaffolded, with tests that fail if a surface is forgotten.**

## Decisions (from the planning interview)

| Topic | Decision |
|---|---|
| Keyboard and Mouse | **Activities** with their own full-screen task surface (not Desktop apps, not workspace modules). |
| Binary | **Activity**. v1 = `make_number`, `to_decimal`, `to_binary`, `add` (with carries); then `overflow`, `hex`, `ascii`, `pixels` as follow-up PRs. |
| Quizzes / code_arrange | Become Activities (each quiz sub-type is one activity). `code_arrange` migrates last. |
| Information / draft tasks | Stay core. |
| New activity identifier | `taskType: 'activity'` + `activityType: '<id>'`. YAML shorthand `type: binary`. |
| Legacy data | Unchanged: `taskType: 'quiz'` + `quizType`, `taskType: 'code_arrange'` are mapped by a resolver. |
| Activity needs | Teacher live view + force/reset + full Builder UI + YAML/CLI. **No** sandbox or playground. |
| Order | Safety net → foundations → **Activities first** → workspace-module restructure. |
| Quiz persistence | Quiz answers **persist across reload** once migrated (behaviour change). |
| Validation wording | **One shared wording** for Builder + CLI; update `validation-errors.md` + authoring CHANGELOG. |
| Keyboard, no physical keyboard | Built-in **on-screen keyboard** fallback; authors may mark items "hardware only". |
| Keyboard layout | **UK only** for now; layout table designed so US can be added. |
| Typing speed | Accuracy always; **WPM optional per task** (target set by author). No cross-lesson history. |
| Stale open tabs | **No** reload prompt. Reader support (incl. unknown-activity fallback) ships and settles before any lesson uses a new activity. |
| Capability requests from lesson agents | Agents drop a Markdown file in **`docs/authoring/authoring-requests/`**. |
| Go Live on quiz/activity tasks | **Remove broadcasting a student's quiz/activity**; only the teacher's own broadcast is allowed on these tasks, and it must actually render the activity state (today `teacherLive.answer` is published but never displayed). |

## The Model

### Workspace module vs Activity

| | Workspace module | Activity |
|---|---|---|
| Student does | builds/edits something open-ended | completes a bounded exercise with a defined target |
| Leaves behind | an artefact (code, circuit, files, desktop) | a result (done, score, attempts) |
| State | persists and carries through to later tasks | scoped to one task |
| Stages | starter / support / complete | initial setup + goal only |
| Sandbox & playground | yes | no |
| Runtime / Run | often | no |
| Placement | its own lesson module (composed lessons group by module) | anywhere, between any tasks |
| Live view, force/reset, Builder, YAML/CLI | yes | yes |

**Decision test for a new idea:** does a later task build on what the student produced? Would a teacher demo freely in it? Is there a meaningful free-play mode? If all "no", it is an Activity.

### Four plugin families

1. **Workspace modules** — `src/modules/<type>/` (python, turtle, html, scratch, filesystem, desktop, electronics, arcade).
2. **Activities** — `src/activities/<id>/` (quiz sub-types, code_arrange, binary, keyboard, mouse, …).
3. **Check types** — one registry; every check declares `evaluate`, Builder `fields`, `validate`, timing and owner.
4. **Shared services** — input recorder, live publishing, persistence, validation, print, reports.

Every plugin splits into a **pure `definition.js`** (no JSX/DOM; imported by the CLI, validation, reports, print, YAML) and a **UI part**. A node-environment test enforces the split.

## Activity contract (summary)

```
src/activities/
  registry.pure.js   # imports every <id>/definition.js (CLI-safe)
  registry.js        # merges definitions with ui.jsx
  resolve.js         # getActivityId(task) incl. legacy mapping
  ActivityHost.jsx   # state, persistence, live sync, force/reset, grading — once for all activities
  _template/         # copied by the scaffold
  <id>/definition.js, <id>/ui.jsx, <id>/__tests__/
```

`definition.js`: `id, label, category, icon, description`, `legacy?`, `yaml { type, toTask, fromTask }`, `availableIn(lesson)`, `hostModules?`, `requires? { physicalKeyboard, finePointer, hover }`, `touchFallback`, `defaultTask`, `validateTask` (shared Builder + CLI), `hasStarter`, `hasCheckValue`, `initialState`, `solutionState`, `sealedFields` (answer-bearing task fields obfuscated in the stored lesson, see `src/shared/lessonSeal.js`), `serialize` / `deserialize` (tolerant), `storage { persist, filename }`, `liveChannel`, `classifyChange(prev,next) → 'discrete'|'continuous'`, `completion`, `grade`, `isGraded`, `checks`, `buildSubmission`, `getProgress`, `summarize`, `teacherEditable`, `report`, `printHtml`.

`ui.jsx`: `StudentView`, optional `TeacherLiveView` (defaults to read-only `StudentView`; editable variant is the teacher force/edit surface), `BuilderEditor`, optional `CardSummary`.

Adding an activity = new folder + one import line in each registry file. `activityInterface.test.js` checks every folder is registered, `defaultTask` validates, serialize round-trips, the solution grades as passed, and `definition.js` imports no JSX.

### Data-model fit (no Firebase model change)

- Legacy mapping in `resolve.js`: `quiz` + `quizType` → `quiz_multiple_choice` / `quiz_match` / `quiz_fill_blank` / `quiz_short_answer` / `quiz_confidence`; `code_arrange` → `code_arrange`; `activity` → `activityType`; unknown → a controlled "activity not available" fallback.
- Live state reuses the existing `students/{id}/currentAnswer` string (legacy quiz strings unchanged; new activities JSON, capped ~2 KB). `code_arrange` keeps `currentCodeArrangeSlots`.
- localStorage reuses the existing per-task aux-file key `headstart_{lessonId}_{taskId}_{filename}_{anonId}` (`__code_arrange_slots__` for code_arrange, `__activity_state__` for everything else, including migrated quizzes).
- Force/reset reuses `remoteResetAction` (`starter` → `initialState`, `complete` → `solutionState`) and `teacherAnswerEdit`.
- **Discrete** changes (answer chosen, bit toggled, item finished) sync debounced like quiz answers today. **Continuous** changes (keystrokes, drags) sync only while `activeStudentView` matches, throttled — enforced once in `ActivityHost`, tested there.
- Avoid the names `currentActivity` (RTDB editor activity) and `taskActivity` (Builder draft field) — use `activityType`.
- Reports: new activities add the value `taskType: 'activity'` + `activityType` to session reports; `TeacherReportModal` / `TeacherReportsPanel` / `reportToYamlText` must handle it.

### Check-type registry

`registerCheckType({ type, owner, subject, operators, fields, aliases?, timing, requiresRun, submitAllowed, contextKey, evaluate, validate })`. Each module's `checks.js` and each activity's `definition.js` export their checks; duplicate ids throw. `evaluateSingleCheck` becomes lookup + call (the electronics `code`-check override moves into the `code` definition). The Builder renders check fields from `fields`; Builder and CLI validate via `validate`. A parity test runs the existing `checks.test.js` corpus through old and new dispatchers before the old one is deleted.

### Input recorder — `src/shared/input/`

Pure core + one hook: `events.js` (normalised key events with modifiers, Caps Lock, hardware/virtual source; pointer events with `pointerType`, `data-input-id` targets), `recorder.js` (bounded in-memory ring buffer, never synced), `gestures.js` (double-click, long-press, double-tap, drag, hover dwell, scroll-to-target, shortcuts, Shift vs Caps Lock, Enter vs pointer activation), `layouts.js` (UK table; US later), `summary.js` (small serialisable summary: accuracy, optional WPM, shiftUsed, capsLockUsed, shortcuts, clicks, dblclicks, rightClicks, longPresses, drags, scrolls, pointerTypes), `capabilities.js` + `useInputCapabilities()`, and `checks.js` (owner `input`: `input_gesture`, `input_modifier`, `input_shortcut`, `input_accuracy`, `input_wpm`) evaluated against `ctx.input` so Desktop can reuse them. Raw event logs never leave the device.

## Phases

Sizes: S < 300 lines, M 300–900, L > 900 (tests included).

### Phase 0 — Safety net (no behaviour change)

| # | PR | Size |
|---|---|---|
| 0.1 | CI: add `npx vite build` to `.github/workflows/ci.yml`; node-env test that imports `cli/validate.mjs` and all module checks. | S |
| 0.2 | Characterisation tests for `useStudentCodeState` (all 8 modules: change, run/submit, reset targets, stages, personal sandbox with/without `lessonModule.id`, teacher-edit apply, sandbox push, watch-start writes, teacherLive payload incl. explicit nulls, share snapshot, presentation in-memory store) asserting exact localStorage keys/JSON and RTDB writer arguments. Known bugs recorded as `it.fails`. | L |
| 0.3 | Characterisation tests for quiz + code_arrange: shared fixtures (`src/test/fixtures/legacyActivityTasks.js`), submissions, item progress, both validators' messages, YAML round-trip, report and print snapshots, `handleQuizSelect` side effects, StudentCard/StudentModal from `currentAnswer`, `teacherAnswerEdit`, `setTaskId` wipe list. Extend existing suites rather than duplicating. | M–L |
| 0.4 | Registry-driven parity test (extends `moduleTypeParity.test.js`) + real `StudentView` click-through per module (load, primary action, Run/Stop where applicable, no throw, `writeStudentRun` shape). | M |
| 0.5 | Type-branch ratchet: count module/task-type literal comparisons per file outside plugin folders; the snapshot may only go down. Update `docs/agents/runtime-model.md` with undocumented fields (`currentTurtleResult`, `teacherLive.turtleResult`, `teacherLive*`/`teacherEditApply*` fields, `module_{id}_sandbox` key). | S |

### Phase 1 — Shared foundations

| # | PR | Size |
|---|---|---|
| 1.1 | Split every module into Node-safe `definition.js` + UI `index.js` via `defineModule`; add `src/modules/definitions.js`; CLI imports definitions and derives `VALID_TYPES`. | M |
| 1.2 | Derive `LESSON_MODULE_TYPES`, `PLAYGROUND_LESSON_TYPES`, `SIDE_EXPLAINER_TYPES`, `MODULE_PANES_TYPES`, `TEACHER_LIVE_REFERENCE_TYPES`, `CODE_STRING_TYPES`, `STAGE_OPTION_METADATA`, `TASK_CARRY_FIELDS` and all label/icon maps from `meta` + `capabilities`. | M |
| 1.3 | Check-type registry (above) with old/new dispatcher parity. | M |
| 1.4 | Shared `validateTask` per module, called from both `lessonUtils.js` and `cli/validate.mjs`; one wording; update `validation-errors.md`, authoring CHANGELOG; amend ADR 0008. | M–L |
| 1.5 | Fix drift bugs (flip the `it.fails` tests): Desktop share snapshot / copy / seed / print / `deriveTaskContext`; Turtle live-reference returns null; `loadSavedDesktop` / `loadPersonalSandboxDesktop` use `safeParse`; arcade show-complete doesn't set `arcadeDesign`; watch-start and `handleScratchCheck` bypass in-memory persistence; unguarded `mod.runtime.buildPreviewSrc` in `handleRun`; `MODULE_FEATURE_MATRIX.md` / `task-types.md` missing Desktop. | M |

### Phase 2 — Activity tier + the building kit

| # | PR | Size |
|---|---|---|
| 2.1 | Pure activity registry, `resolve.js`, central predicates in `taskUtils.js` (`getTaskKind`, `taskHasWorkspace`); replace task-type branch sites mechanically; unknown-activity fallback renders safely. **Ships before any lesson uses `taskType: 'activity'`.** | M |
| 2.2 | Quiz definitions: move validation, submission, progress, report, print, YAML into `src/activities/quiz_*/definition.js`; old helpers become adapters. | M–L |
| 2.3 | `ActivityHost` + `useActivityState`; route quizzes through it (LessonTaskContent, StudentCard/StudentModal, TeacherEditorPanel, TeacherView advance-override); quiz answers persist via `__activity_state__`; remove student-source Go Live for quiz/activity tasks and render teacher-broadcast activity state. | L |
| 2.4 | Builder: task format grid Code / Information / Quiz / Activity (+ Arrange in composed lessons); activity gallery; editors from `BuilderEditor`; preview via `ActivityHost`; split `QuizEditors.jsx` per activity. YAML shorthand `type: <activity>`. | M–L |
| 2.5 | **Kit:** `npm run new:activity <id> "<Label>"` (copies `src/activities/_template/`, registers it, stubs tests and `docs/authoring/activities/<id>.md` with a valid example, indexes docs so `docs:check` passes); `.claude/skills/new-activity/SKILL.md` (scaffold → implement → verify loop incl. click-through and `vite build`); `node cli/cli.mjs lessons capabilities` emitting JSON of modules, activities, check types and fields from the registries; `docs/authoring/authoring-requests/` intake (README with template; `scripts/check-docs.mjs` exempts request files from the per-file index rule); `docs/architecture/activities.md` + ADR "Activity registry". | M |
| 2.6 | **Binary v1** built with the kit: `make_number`, `to_decimal`, `to_binary`, `add` (with carries). | M |
| 2.7 | Binary follow-ups, one small PR each: `overflow`, `hex`, `ascii`, `pixels`. | S each |

### Phase 3 — Input library, Keyboard, Mouse

| # | PR | Size |
|---|---|---|
| 3.1 | `src/shared/input/` + `input` check types + `requires` / `touchFallback` enforcement in `ActivityHost` + teacher device badge. Scratch key normalisation moves onto it (Arcade's in-iframe copy is documented as a mirror). | M |
| 3.2 | **Keyboard** activity: modes `type_text` (capitals via Shift, `requireShiftForCapitals`, `minAccuracy`, optional `targetWpm`), `find_key`, `symbols` (UK: Shift+2 = `"`, Shift+' = `@`, Shift+3 = `£`), `shortcuts` (capturable combos only; `validateTask` rejects browser-reserved Ctrl/Cmd+W/T/N/Q, Ctrl+Tab, Ctrl+Shift+T/N, Alt+F4 and suggests a quiz item instead). On-screen keyboard fallback; per-item `hardwareOnly`. | M–L |
| 3.3 | **Mouse** activity: stage with positioned targets; items `click`, `double_click`, `right_click`, `drag`, `scroll`, `hover`, sequences; touch equivalents (double-tap, long-press, touch drag, swipe; hover skipped/blocked per task); method checks (double-click vs Enter). No live cursor streaming in v1. | M–L |

### Phase 4 — Workspace module contract v2

| # | PR | Size |
|---|---|---|
| 4.1 | Pure module lifecycle hooks: `resetTarget`, `hasComplete`, `sandboxStarter`, `composedSandboxFields`, `defaultTypeFields`, `missingStarter`, `printTask`. | M |
| 4.2 | Storage adapters (`toTaskRecord`/`fromTaskRecord`/sandbox variants) and wire codec (`toCode`/`fromCode`, `sandboxChannel`, `liveExtras`, `submission`, `watchStartWrites`); `saveWork`/`readWork` in `createStudentPersistence` — byte-identical per Phase 0 tests. | M |
| 4.3 | Generic `work` slot + `handleWorkChange` / `evaluateAndReport` in `useStudentCodeState`; migrate **filesystem + desktop** (collapses the duplicated `apply*CheckAndPublish`). | M |
| 4.4 | Migrate electronics, python, turtle, arcade; extract `runWithRuntime`; run dispatch by `capabilities.run`. Highest live-classroom risk — land between classes. | L |
| 4.5 | Migrate html (per-file) and scratch (workspace-owned checks via `reportRun`). | L |
| 4.6 | TeacherView sandbox + `liveState`/`onChange`, `useSandboxCodePush`, `useTeacherLivePublish` (always emit explicit nulls for extras), StudentView display state — all via `wire`. | M–L |
| 4.7 | Capability gates in StudentView, StudentModal, StudentWorkspaceBody, StudentCard, LessonTaskContent; drop direct TeacherLiveView imports. | M |
| 4.8 | Ratchet to zero outside plugin folders (+ ESLint `no-restricted-syntax`); `src/modules/_template/`, `npm run new:module`, `.claude/skills/new-module/SKILL.md`; rewrite `lesson-type-modules.md` for v2 + ADR. | M |
| 4.9 | `code_arrange` onto the activity contract (`hostModules: ['python','html']`, legacy `liveChannel` and filename). | M |

### Phase 5 — Learning carries into Desktop

| # | PR | Size |
|---|---|---|
| 5.1 | Desktop records input via the shared recorder and exposes the `input_*` checks (e.g. moved a file by dragging, copied with Ctrl+C, opened with double-click). | M |

Critical path to Binary: **0 → 1 → 2.1–2.6**. Keyboard/Mouse follow Phase 3. Phase 4 can proceed after Phase 2 in parallel with Phase 3.

## Authoring requests (lesson agents)

Lesson agents that need something the platform lacks write `docs/authoring/authoring-requests/<yyyy-mm-dd>-<slug>.md` using the template in that folder's README:

- **Kind:** activity | module | check type | activity mode
- **Need:** what the lesson must teach and why existing capabilities fall short (reference `lessons capabilities` output)
- **Example task:** the YAML the agent wishes it could write
- **Checks wanted:** outcome and/or method
- **Devices:** touch / keyboard considerations
- **Lesson(s) blocked:** ids or titles

The `new-activity` / `new-module` skills start from a request file, apply the Workspace-module-vs-Activity test, and link the resulting PR back into the file (status: open → planned → shipped).

## Definition of done for any new activity or module

- Built from the scaffold; lives in one folder plus the registry import lines.
- `activityInterface` / `moduleInterface` / parity tests pass with no allowlist entries added.
- Real `StudentView` click-through test (and Run/Stop for runtime modules).
- Builder UI, YAML shorthand, CLI validation (shared `validateTask`) and `lessons capabilities` output all include it.
- Teacher live view, force/reset (and sandbox/carry for modules) verified in a real browser — jsdom misses pointer-stacking bugs.
- `docs/authoring/activities/<id>.md` (or `docs/authoring/<type>.md`) with a validated complete example; authoring CHANGELOG entry.
- `npm test`, `npm run docs:check`, `npm run lint`, `npm run format:check`, `npx vite build` all pass.

## Risks

1. **Quizzes are used in every live lesson** — Phase 0 characterisation tests land first; 2.3 lands between classes.
2. **Mixed-version tabs** — no reload prompt, so reader support (2.1) must deploy and settle before any lesson uses `taskType: 'activity'` or new check types; RTDB payload shapes stay readable by old tabs.
3. **teacherLive merge semantics** — generic payloads must keep sending explicit `null` extras.
4. **Per-keystroke writes** — enforced centrally (`ActivityHost`, module `publish` policy) and tested.
5. **Composed lessons** — never gate on raw `lesson.type`; use the per-task effective type.
6. **Report enum** — `taskType: 'activity'` in reports needs report UI support in 2.2/2.3.
7. **Capability detection is heuristic** — always offer a manual "I have a keyboard" override.

## Separate housekeeping

- `.codex/config.toml` (gitignored) holds a plaintext GitHub PAT and points at the removed `mcp/server.mjs` — rotate the token and remove the stale entry.
