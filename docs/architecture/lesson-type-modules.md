# Lesson Type Modules

A lesson type (python, arcade, turtle, scratch, html, filesystem, desktop, electronics) is a
**workspace module**: one folder, `src/modules/<type>/`, whose definition tells the classroom,
teacher view, Builder, CLI and validators everything they need. This page is the reference for
the module contract (v2). Why it is shaped this way: [ADR 0004](../adr/0004-lesson-type-module-registry.md)
and [ADR 0010](../adr/0010-module-contract-v2-and-work-slot.md). Bounded exercises are
**activities** instead ([activities.md](activities.md), [ADR 0009](../adr/0009-activity-registry.md));
the decision test is in [modular-activities-plan.md](modular-activities-plan.md).

**The rule:** core code never compares against a module or task type name. It reads the
definition (`getModuleDefinition(type)` from `src/modules/definitions.js`, or the UI module from
`registry.js`) looked up by the task's **effective** module (`getEffectiveLessonForTask` /
`deriveTaskContext().moduleType`) — never a composed lesson's raw `type`. Outside
`src/modules/**` and `src/activities/**` the type-branch ratchet is at zero and ESLint rejects a
new comparison (see [Guard rails](#guard-rails)). A behaviour that differs between modules
becomes a definition field with a default in `defineModule.js`.

## Contract

Each module is split in two:

| File | Holds | Imported by |
|---|---|---|
| `definition.js` | `defineModule({...})`: pure data and hooks. No JSX, React, DOM or runtimes; explicit `.js` extensions on relative imports. | `src/modules/definitions.js` → CLI, validation, shared type lists, the app |
| `index.js` | `defineUiModule(definition, { StudentWorkspace, BuilderWorkspace, CheckEditor, FeedbackCheckEditor?, TeacherLiveView, getLayoutStyles, runtime })` | `src/modules/registry.js` → the app |
| `checks.js` | `CHECKS`: module-owned check types | `src/modules/checks.js` (the check registry) |

`defineModule` (`src/modules/defineModule.js`) validates every field below, fills the optional
ones with defaults and freezes the result; a missing or ill-typed field throws with its name.
`definitions.js` exposes `MODULE_TYPES` (ordered by `meta.order`), `getModuleDefinition`,
`getModuleTypesWhere`, `getModuleTypesWithCapability`, `CARRY_THROUGH_FIELDS` and
`getModuleLabel(type, surface)`; `src/modules/moduleContract.js` holds the shared builders the
definitions use. `moduleDefinitionsNode.test.js` loads every definition in a real Node process.

## Contract v2 reference

### `meta`

| Field | Meaning |
|---|---|
| `label`, `order` | Canonical name; registry order (admin lists, `MODULE_TYPES`). |
| `shortLabel`, `icon`, `pickerHint` | Builder composed-lesson module picker. |
| `pickerOrder` (optional) | Position in that picker and the CLI's type list (`LESSON_MODULE_TYPES`); defaults to `order`. |
| `language` | `'python'` \| `'html'` \| null: explainer code blocks and editors. |
| `playground` | Has a `/playground/:type` route; needs `lifecycle.playgroundTask`. |
| `surfaceLabels` (optional) | Wording per surface: `lessonIntro`, `builderMeta`, `print`, `stageReference`. |
| `teacherEditCopy` | `{ action, consent }` for the teacher's live edit; required with `capabilities.teacherEditor`. |

### `capabilities`

Required booleans: `sideExplainer` (explainer as a side rail, else an accordion), `modulePanes`
(the workspace reports `visiblePanes`), `teacherLiveReference` (teacher live code can be a
student's stage reference), `unifiedStages` (Starter/Complete live in `codeStages` roles; the
unified remote-reset selector and read-only support references), `teacherStageReveal`
(StudentModal's Reveal menu), `highlights` (teacher code highlights; needs a `'code'`/`'files'`
mirror), `downloadCode` (`.launchpad` download), `fixedExplainer` (Scratch's fixed column; needs
`sideExplainer`, no `modulePanes`), `topicLibrary`.

Optional booleans (default false): `teacherFillHeight` (TeacherView's centre column fills and
clips), `teacherSandboxRow` (the teacher sandbox workspace fills a plain flex row),
`teacherUnifiedStageTabs` (teacher code tabs show stage roles with no Starter/Complete tabs),
`explainerBlockMenu` (explainer editor's Scratch block-reference menu), `typeSpriteDefaults`
(Shared Assets default sprites/backdrops in `lessonTypeAssets/{type}`).

| Field | Values |
|---|---|
| `stageReveal` | `'progressive'` (support stages as read-only references, complete previewed first; python, html) \| `'offer'` (offer the next stage after two failed checks) |
| `studentMirror` | How StudentModal mirrors a watched student: `'code'`, `'files'` (= the files wire channel), `'blocks'`, `'view'` (the module's `TeacherLiveView`) |
| `cardSummary` (optional) | StudentCard line: `'output'`, `'blocks'`, `'fs'`, null |
| `focusPanes` (optional) | Extra `{ id, label }` panes the teacher can highlight/force |
| `teacherEditor` (optional) | `{ surface: 'code'\|'files'\|'blocks'\|'view', workspace?, design? }`, declared exactly when `workSlot.teacherEdit` is |
| `sandboxState` | Teacher sandbox work kind: `'code'` (one code string), `'blocks'`, `'fs'`, `'desktop'`, `'files'` |
| `run` | What Run does (`handleRun` dispatches on it): `'runtime'` (needs `runResult` and a UI `runtime`), `'preview'` (html iframe), `'workspace'` (the workspace runs/checks and reports), `'none'` (default). Remote "Run on student" is offered when not `'none'`. |

`runResult` (exactly for `'runtime'`): `errorLine`, `turtle`, `liveCode` booleans.
`moduleDefinitions.test.js` / `moduleRunCapability.test.js` pin the built-in values.

### Authoring, state and validation hooks

- Builder: `makeCodeTaskFields`, `makeNewStage`, `initCompleteTab`/`initStageTab` (optional),
  `defaultCheck`, `carryThroughField` / `carryThroughLabel` / `getCarryThroughUpdates` /
  `getNewStarterUpdates`, `completeField`, `stageLabels`, `explainerInlineCodeLanguages`,
  `explainerCodeBlockLanguages`, `supportsInteractionMode` / `supportsIncorrectChecks` /
  `supportsTests` / `supportsVariableChecks` / `supportsDomChecks` (and optional
  `supportsCopyCode`, `supportsOutputChecks`), `inheritsCheckTypes` (check types owned elsewhere
  the module can evaluate).
- State: `defaultState`, `initialState(task)`, `serializeState` / `deserializeState`,
  `getDisplayState(task, stage, liveState, tab)` (what the teacher tabs show).
- Validation, shared by the Builder and the CLI (`src/shared/lessonValidation.js`):
  `validateTask(task, { n, lesson, errors, warnings })`, `hasStarterContent`, `hasCheckValue`,
  `validateTaskInBrowser` (Builder only). Every message is documented in
  `docs/authoring/validation-errors.md` (`validationErrorsDoc.test.js`).

### `lifecycle`

`resetTarget(task, action, ctx)` (the state a teacher remote reset — `starter`, `complete`,
`stage_<n>` — puts in front of the student, in the module's shape), `hasComplete(task)`,
`teacherCompleteTab(task)`, `sandboxStarter(lesson, task)` (`getSandboxState` is its alias),
`composedSandboxFields(firstTask)`, `hasPersonalSandbox(lesson)` (`alwaysPersonalSandbox`, or
`personalSandboxWhenLessonHas(field)`), and optional `playgroundTask()` (the playground's one
task; exactly when `meta.playground`).

### `storage`

Adapters onto the localStorage shapes in `docs/agents/runtime-model.md`, which must not change:
`layout: 'record'` via `recordStorage({ workKey, taskMeta, sandboxMeta })` (one
`headstart_{lessonId}_{taskId}_{anonymousId}` record; meta fields written only when passed, in
declared order) or `layout: 'perFile'` via `perFileStorage()` (html, `{ content }` per file).
Hooks: `toTaskRecord` / `fromTaskRecord`, `toSandboxRecord` / `fromSandboxRecord`.
`createStudentPersistence` routes `saveWork` / `readWork` / `saveSandboxWork` /
`readSandboxWork` through them (personal sandbox, presentation's in-memory store, else
localStorage).

### `wire`

How work travels over Realtime Database: `sandboxChannel` `'code'` (`currentCode` /
`sandboxCode` string) or `'files'` (html; `sandboxFiles`, must match `sandboxState: 'files'`),
`toCode` / `fromCode` (`codeStringWire` identity, `jsonWire` JSON, `filesWire` null plus
`toFilesMap`), `liveExtras` (always both teacherLive extras, explicit `null`s — teacherLive is an
`update()` merge) and `submission(work)` (logged with an attempt).

### Checking and the generic work slot

Every module declares `checking` and `workSlot` together; `useStudentCodeState` keeps one work
slot, `{ moduleType, taskId, value }`, read through `workValueFor(moduleType)` (the module's
stable default when the slot holds another module's work, so a composed lesson never saves,
publishes or checks a leftover value).

`checking.trigger`: `'change'` (every edit writes a run and is checked — only for discrete
edits; filesystem, desktop), `'run'` (checked when the work runs: runtime modules, html's
preview or Submit, a `'workspace'`-run module's report through `handleWorkspaceRun`),
`'workspace'` (the workspace evaluates and reports through `reportRun`; scratch).
`checking.buildContext(work, extras)` builds the evaluator context (`codeCheckContext` gives
`{ ...extras, code }`).

`workSlot`, field form (`starterField`, `sandboxField`, `stageField`; the source hooks are
derived) or hook form (`starter`, `stage`, `complete`, `sandbox`, `fromResetTarget`, `stored`,
`fromStored`; `codeWorkSlot()` and `filesWorkSlot()` build them), plus `empty(task)`,
`normalise(work)` (applied whenever work is restored, never to the student's own edits),
`kind` (`'code'`: own save restored only in solo, carry via `carryCodeFrom`, restoring clears
the run output; `'state'`: own save always restored, carry via `carryThroughField`), the flags
`taskReset`, `teacherSandboxReset`, `remoteResetPersists`, `teacherEdit`, `workspaceOwned`
(scratch; the workspace loads its own work and receives restored work as pushed state), and
optional `teacherStarter(task)` (TeacherView's Starter-tab work; defaults to `starter`,
electronics shows `starterCircuit`). A slot on the `'code'` channel stores one record; on
`'files'` it stores per file.

The one pipeline: `handleWorkChange(next, { moduleType, interaction })` (per trigger: save,
teacherLive, `writeStudentCode` **only while watched**, idle feedback; the preview is never
rebuilt per keystroke), `evaluateAndReport`, `handleRun` → `runWithRuntime` / the preview,
`handleWorkspaceRun(work)`, `reportRun({ passed, suggestion, work })`. Loading (own save, carry,
starter), the personal sandbox, remote reset, show stage/complete, Reset, teacher-edit apply,
sandbox push, watch-start writes, the teacherLive payload and the share snapshot all read the
definition. A module whose sandbox kind is `'code'` or `'files'` is code work: the `code` /
`files` aliases, `handleCodeChange` / `handleFileChange` speak it and an information task clears
it. Runtime state (`output`, `runStatus`, `turtleResult`, `inputPrompt`, `errorLine`, html's
`iframeSrc`) stays outside the slot. `moduleWorkSlot.test.js` and the Phase 0
`useStudentCodeState.*` characterisation suites pin the bytes written.

### Teacher surfaces

- **TeacherView** (`src/app/teacherSandboxWork.js`) keeps one work value per
  `capabilities.sandboxState` kind plus a draft; stage / module switch / reload restore the draft,
  else the session's work (`wire.fromCode(sandboxCode)` or the decoded `sandboxFiles`), else
  `lifecycle.sandboxStarter`; Go Live / Push / Reset write through the wire. The displayed task's
  Starter tab uses `workSlot.teacherStarter`. Layout reads `teacherFillHeight`;
  `TeacherEditorPanel` reads `teacherUnifiedStageTabs`, `teacherSandboxRow` and
  `lifecycle.teacherCompleteTab`.
- **Student sandbox push** (`useSandboxCodePush`), **teacherLive** display and publish
  (`useTeacherLivePublish`, explicit null extras), **workspace sharing** (snapshot, seed, copy)
  and **StudentModal / StudentCard / StudentWorkspaceBody** all go through `wire`, `storage` and
  the capabilities above; StudentModal takes the registry's `TeacherLiveView`.

### UI half

`StudentWorkspace` (props from `LessonTaskContent`: `lesson`, `task`, `cs`, viewing / forced /
teacher-edit flags, `display*` states; edits only through `cs`), `BuilderWorkspace` (TaskEditor's
tab state and handlers), `CheckEditor` (+ optional `FeedbackCheckEditor`), `TeacherLiveView`
(`displayState`, `readOnly`, `onChange` in the sandbox), `getLayoutStyles()` (`sharedStyles.js`),
`runtime` (`{ init, isReady, stop, provideInput, run, buildPreviewSrc, waitForPreviewText }` for
a `'runtime'` module, else null).

## Check-Type Registry

`src/modules/checkRegistry.js` (pure) builds one registry in `src/modules/checks.js` from
`CORE_CHECKS`, every module's `CHECKS` and the shared input checks. A definition is
`{ type, owner, subject?, operators?, fields?, aliases?, timing, requiresRun, submitAllowed,
contextKey?, evaluate(check, output, ctx), validate?(check, ctx) }`; `owner` is `core`,
`module:<type>` or `input`; duplicate ids throw. `evaluateSingleCheck` normalises core aliases,
looks up and calls `evaluate` (unknown types are `false`); `RUN_REQUIRED` / `SUBMIT_ALLOWED` are
derived. Scratch evaluates its own checks in the workspace. `checkRegistryParity.test.js` holds
parity with the frozen pre-registry dispatcher.

## Guard rails

- `src/modules/__tests__/typeBranchRatchet.test.js` counts literal type comparisons (and inline
  type arrays) per file outside the plugin folders; counts only go down, everything outside
  `src/builder/` must be zero, and non-type matches go on its reasoned, self-checking allowlist
  (empty today; prefer a named constant or map).
- `eslint.config.js` `no-restricted-syntax` rejects `=== / !== / case` against a type name in
  `src/**` and `cli/**` outside `src/modules/**` and `src/activities/**` (src/builder is ignored
  until its migration merges; then remove that ignore and the ratchet's exemption).
- Registry-driven tests fail when a module misses a surface: `moduleInterface`,
  `moduleTypeParity` (every parity list or an honest `KNOWN_GAPS` reason),
  `StudentViewModules` (real click-through per module), `moduleDefinitionsNode` (every folder
  registered and Node-safe), `authoringDocExamples`, `validationErrorsDoc`. Value pins describe
  the built-in modules (`__tests__/helpers/builtInModules.js`).

## Adding a module

Use the kit; the `new-module` skill (`.claude/skills/new-module/SKILL.md`) walks the whole loop
from an authoring request to the real-browser checks.

```bash
npm run new:module -- <type> "<Label>" [--dry-run]
```

`scripts/new-module.mjs` copies `src/modules/_template/` (a working "write text, press Check"
module: `run: 'workspace'`, `trigger: 'run'`, `codeWorkSlot`, core code checks, every group
filled with safe defaults and `TODO(new-module)` markers) to `src/modules/<type>/`, registers it
in `definitions.js`, `registry.js` and `checks.js`, adds the type to the ratchet and ESLint rule,
records the scaffold's deliberate parity gaps in `KNOWN_GAPS`, adds its `StudentViewModules`
click-through, writes `docs/authoring/<type>.md` (with a validated example) and indexes it in
`docs/README.md`, `docs/CODEBASE_MAP.md`, `validation-errors.md`, `AGENTS.md`,
`lesson-schema.md`, `task-types.md` and `MODULE_FEATURE_MATRIX.md`. It rejects reserved and
taken types (and names core code already compares against), refuses to overwrite and writes
nothing until every edit is planned. The untouched scaffold passes `npm test`, lint, format,
`docs:check` and `vite build`; `scripts/__tests__/newModule.test.mjs` tests the generator.

Then decide each definition group, build the real workspaces, add module checks, update the
tests (keep the click-through; Run then Stop for a runtime module), resolve the `KNOWN_GAPS`
entries, rewrite the docs, and verify in a real browser.

## Usually Changes With

- `src/modules/defineModule.js`, `src/modules/moduleContract.js` and `src/modules/_template/`
  (a new field needs a default and a template entry)
- `src/modules/__tests__/moduleDefinitions.test.js`, `moduleInterface.test.js`,
  `moduleTypeParity.test.js`, `derivedTypeLists.test.js`
- `src/app/hooks/useStudentCodeState.js`, `src/app/teacherSandboxWork.js`,
  `src/app/components/LessonTaskContent.jsx`, `src/app/views/teacher/TeacherEditorPanel.jsx`
- `docs/architecture/feature-impact-map.md`, `docs/authoring/<type>.md`, `docs/CODEBASE_MAP.md`,
  `docs/TESTING.md`
